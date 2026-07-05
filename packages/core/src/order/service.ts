/**
 * Order Service (Backend-Arch §4). The one module every channel writes to. Orders are stored as an
 * append-only event log; the materialized Order/OrderItem rows are DERIVED from that log by replay
 * and are safe to rebuild at any time (DB-10). Payment, status and item mutations all go through
 * events so POS, QR, kiosk and online behave identically and offline batches merge deterministically.
 */
import { prisma, transactionally, type Prisma } from "@shopmaster/db";
import { resolveCapabilities, type OrderEventType, type PaymentRail, type OrderDTO, type Channel, type Fulfillment, type OrderStatus, type Tier, type BusinessType } from "@shopmaster/shared";
import { replayOrder, type ReplayEvent, type MaterializedOrder } from "./replay.js";
import type { TaxConfig } from "../pricing-tax.js";
import { charge, getPaymentAdapter } from "../payments/index.js";
import { emitDomainEvent } from "../events/emitter.js";
import { assertTenant, type TenantContext } from "../tenancy.js";
import { upsertCustomerForOrder } from "../crm.js";

export interface IngestEvent {
  orderId: string;
  type: OrderEventType;
  payload: unknown;
  deviceId?: string;
  staffId?: string;
  deviceTimestamp: string; // ISO
  idempotencyKey: string;
}

/** Insert events (idempotent by idempotencyKey, BE-04/DB-08), then rebuild affected orders. */
export async function ingestEvents(
  ctx: TenantContext,
  events: IngestEvent[],
): Promise<{ inserted: number; duplicates: number; conflicts: number; orderIds: string[] }> {
  let inserted = 0;
  let duplicates = 0;
  for (const e of events) {
    const order = await prisma.order.findUnique({ where: { id: e.orderId } });
    if (!order || order.organizationId !== ctx.organizationId) continue; // tenancy guard (BE-10)
    try {
      await prisma.orderEvent.create({
        data: {
          organizationId: order.organizationId,
          locationId: order.locationId,
          orderId: e.orderId,
          type: e.type,
          payload: JSON.stringify(e.payload ?? {}),
          deviceId: e.deviceId ?? ctx.deviceId ?? null,
          staffId: e.staffId ?? ctx.staffId ?? null,
          deviceTimestamp: new Date(e.deviceTimestamp),
          idempotencyKey: e.idempotencyKey,
        },
      });
      inserted++;
    } catch (err: unknown) {
      if ((err as { code?: string })?.code === "P2002") {
        duplicates++; // retried sync after a dropped connection — already applied
        continue;
      }
      throw err;
    }
  }

  let conflicts = 0;
  const orderIds = [...new Set(events.map((e) => e.orderId))];
  for (const oid of orderIds) {
    const state = await rebuildOrder(oid);
    conflicts += state.conflicts.length;

    // Emit lifecycle events from whichever path fed the log — POS status change, or a kiosk/QR
    // sync batch that carries ORDER_CONFIRMED/ORDER_CLOSED directly (BE-03). Subscribers
    // (inventory, reporting) are idempotent, so a duplicate emit is harmless.
    const types = new Set(events.filter((e) => e.orderId === oid).map((e) => e.type));
    if (types.has("ORDER_CONFIRMED")) emitDomainEvent({ type: "order.confirmed", orderId: oid, organizationId: ctx.organizationId });
    if (types.has("ORDER_CLOSED")) emitDomainEvent({ type: "order.closed", orderId: oid, organizationId: ctx.organizationId });
  }
  return { inserted, duplicates, conflicts, orderIds };
}

/** Rebuild the materialized Order/OrderItems from the event log (DB-10). Deterministic. */
export async function rebuildOrder(orderId: string): Promise<MaterializedOrder> {
  const order = await prisma.order.findUnique({ where: { id: orderId }, include: { location: true } });
  if (!order) throw new Error(`Order not found: ${orderId}`);

  const events = await prisma.orderEvent.findMany({
    where: { orderId },
    orderBy: [{ deviceTimestamp: "asc" }, { receivedAt: "asc" }],
  });

  const replayEvents: ReplayEvent[] = events.map((e) => ({
    id: e.id,
    type: e.type as OrderEventType,
    payload: safeJson(e.payload),
    deviceId: e.deviceId,
    staffId: e.staffId,
    deviceTimestamp: e.deviceTimestamp,
    receivedAt: e.receivedAt,
  }));

  const tax: TaxConfig = { taxRateBps: order.location.taxRateBps, taxInclusive: order.location.taxInclusive };
  const state = replayOrder(replayEvents, tax);

  await transactionally(async (tx) => {
    await tx.orderItem.deleteMany({ where: { orderId } });
    for (const it of state.items) {
      await tx.orderItem.create({
        data: {
          orderId,
          menuItemId: it.menuItemId,
          lineId: it.lineId,
          nameSnapshot: it.nameSnapshot,
          unitPriceMinor: it.unitPriceMinor,
          qty: it.qty,
          modifiers: it.modifiers.length ? JSON.stringify(it.modifiers) : null,
          lineTotalMinor: it.lineTotalMinor,
          station: it.station,
          note: it.note ?? null,
          voided: it.voided,
        },
      });
    }

    await tx.order.update({
      where: { id: orderId },
      data: {
        status: state.status,
        channel: state.channel ?? order.channel,
        fulfillment: state.fulfillment ?? order.fulfillment,
        tableId: state.tableId ?? order.tableId,
        customerName: state.customerName ?? order.customerName,
        customerPhone: state.customerPhone ?? order.customerPhone,
        deliveryAddress: state.deliveryAddress ?? order.deliveryAddress,
        note: state.note ?? order.note,
        subtotalMinor: state.totals.subtotalMinor,
        taxMinor: state.totals.taxMinor,
        totalMinor: state.totals.totalMinor,
        paidMinor: state.paidMinor,
        tipMinor: state.tipMinor,
        closedAt: state.status === "CLOSED" ? (order.closedAt ?? new Date()) : order.closedAt,
      },
    });

    // Persist conflict resolutions to the audit trail (DB-09). Idempotent: clear + rewrite.
    await tx.auditLogEntry.deleteMany({
      where: { organizationId: order.organizationId, action: "SYNC_CONFLICT_RESOLVED", target: { startsWith: `order:${orderId}` } },
    });
    for (const c of state.conflicts) {
      await tx.auditLogEntry.create({
        data: {
          organizationId: order.organizationId,
          action: "SYNC_CONFLICT_RESOLVED",
          target: `order:${orderId}:line:${c.lineId}`,
          before: JSON.stringify(c.winner),
          after: JSON.stringify(c.loser),
        },
      });
    }
  });

  return state;
}

export async function createOrder(
  ctx: TenantContext,
  input: {
    channel: Channel;
    fulfillment: Fulfillment;
    locationId?: string;
    tableId?: string;
    qrToken?: string;
    customerName?: string;
    customerPhone?: string;
    deliveryAddress?: string;
    note?: string;
    loyaltyOptIn?: boolean; // CRM-01: opt-in to rewards, keyed by customerPhone
  },
): Promise<string> {
  let locationId = input.locationId;
  let tableId = input.tableId ?? null;

  if (input.qrToken) {
    const table = await prisma.tableOrTab.findUnique({ where: { qrToken: input.qrToken } });
    if (table) {
      tableId = table.id;
      locationId = table.locationId;
    }
  }
  if (!locationId) {
    const loc = await prisma.location.findFirst({ where: { organizationId: ctx.organizationId } });
    locationId = loc?.id;
  }
  if (!locationId) throw new Error("No location available for organization");

  const location = await prisma.location.findUnique({ where: { id: locationId }, include: { organization: true } });
  assertTenant(ctx, location);
  const currency = location!.organization.currency;

  const order = await prisma.order.create({
    data: {
      organizationId: ctx.organizationId,
      locationId,
      tableId,
      channel: input.channel,
      fulfillment: input.fulfillment,
      currency,
      customerName: input.customerName ?? null,
      customerPhone: input.customerPhone ?? null,
      deliveryAddress: input.deliveryAddress ?? null,
      note: input.note ?? null,
      status: "OPEN",
    },
  });

  await ingestEvents(ctx, [
    {
      orderId: order.id,
      type: "ORDER_CREATED",
      payload: {
        locationId,
        channel: input.channel,
        fulfillment: input.fulfillment,
        currency,
        tableId: tableId ?? undefined,
        customerName: input.customerName,
        customerPhone: input.customerPhone,
        deliveryAddress: input.deliveryAddress,
        note: input.note,
      },
      deviceTimestamp: new Date().toISOString(),
      idempotencyKey: `${order.id}:created`,
      staffId: ctx.staffId,
      deviceId: ctx.deviceId,
    },
  ]);

  // Opt-in loyalty (CRM-01): attach this order to a rewards profile keyed by the phone given —
  // but only if the merchant's tier actually includes loyalty (authoritative capability guard).
  const org = location!.organization;
  const loyaltyEnabled = resolveCapabilities(org.tier as Tier, org.businessType as BusinessType).features.loyalty;
  if (loyaltyEnabled && input.loyaltyOptIn && input.customerPhone) {
    await upsertCustomerForOrder(ctx, {
      orderId: order.id,
      contactMethod: input.customerPhone,
      name: input.customerName,
      optInMarketing: true,
    });
  }

  emitDomainEvent({ type: "order.created", orderId: order.id, organizationId: ctx.organizationId });
  return order.id;
}

export async function payOrder(
  ctx: TenantContext,
  orderId: string,
  req: { rail: PaymentRail; amountMinor: number; tipMinor?: number; tenderedMinor?: number },
) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  assertTenant(ctx, order);

  const tipMinor = req.tipMinor ?? 0;
  // The tender covers goods + tip (PAY-06); cash change is computed against the combined total.
  const chargeMinor = req.amountMinor + tipMinor;
  const result = await charge({
    orderId,
    amountMinor: chargeMinor,
    currency: order!.currency,
    rail: req.rail,
    tenderedMinor: req.tenderedMinor,
  });

  const status = result.status === "CAPTURED" ? "CAPTURED" : result.status === "AUTHORIZED" ? "AUTHORIZED" : "FAILED";
  const payment = await prisma.payment.create({
    data: {
      organizationId: order!.organizationId,
      orderId,
      rail: req.rail,
      amountMinor: req.amountMinor,
      tipMinor,
      currency: order!.currency,
      status,
      processorToken: result.processorToken ?? null,
      tenderedMinor: req.tenderedMinor ?? null,
      changeMinor: result.changeMinor ?? null,
    },
  });

  if (result.status === "CAPTURED") {
    await ingestEvents(ctx, [
      {
        orderId,
        type: "PAYMENT_CAPTURED",
        payload: {
          paymentId: payment.id,
          rail: req.rail,
          amountMinor: req.amountMinor,
          tipMinor: tipMinor || undefined,
          tenderedMinor: req.tenderedMinor,
          changeMinor: result.changeMinor,
          processorToken: result.processorToken,
        },
        deviceTimestamp: new Date().toISOString(),
        idempotencyKey: `${orderId}:pay:${payment.id}`,
        staffId: ctx.staffId,
        deviceId: ctx.deviceId,
      },
    ]);
    emitDomainEvent({ type: "order.paid", orderId, organizationId: order!.organizationId, amountMinor: req.amountMinor });
  }

  return { payment, result };
}

/** Refund a captured payment (POS-11) via its rail adapter; audited, recomputes the order's paid total. */
export async function refundPayment(ctx: TenantContext, orderId: string, paymentId: string) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  assertTenant(ctx, order);
  const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
  if (!payment || payment.orderId !== orderId) throw new Error("Payment not found");
  if (payment.status !== "CAPTURED") throw new Error("Only captured payments can be refunded");

  const adapter = getPaymentAdapter(payment.rail as PaymentRail);
  const result = await adapter.refund(payment.processorToken ?? "", payment.amountMinor);

  await prisma.payment.update({ where: { id: paymentId }, data: { status: "REFUNDED" } });
  const captured = await prisma.payment.aggregate({ where: { orderId, status: "CAPTURED" }, _sum: { amountMinor: true } });
  await prisma.order.update({ where: { id: orderId }, data: { paidMinor: captured._sum.amountMinor ?? 0 } });

  await prisma.auditLogEntry.create({
    data: {
      organizationId: order!.organizationId,
      actorId: ctx.staffId ?? null,
      action: "PAYMENT_REFUNDED",
      target: `payment:${paymentId}`,
      before: JSON.stringify({ status: "CAPTURED", amountMinor: payment.amountMinor, rail: payment.rail }),
      after: JSON.stringify({ status: "REFUNDED" }),
    },
  });

  return { payment: await prisma.payment.findUnique({ where: { id: paymentId } }), result };
}

const STATUS_EVENT: Record<"CONFIRMED" | "READY" | "CLOSED" | "VOID", OrderEventType> = {
  CONFIRMED: "ORDER_CONFIRMED",
  READY: "ORDER_READY",
  CLOSED: "ORDER_CLOSED",
  VOID: "ORDER_VOIDED",
};

export async function setOrderStatus(ctx: TenantContext, orderId: string, status: "CONFIRMED" | "READY" | "CLOSED" | "VOID") {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  assertTenant(ctx, order);
  // ingestEvents emits order.confirmed / order.closed from the event types, covering every path.
  await ingestEvents(ctx, [
    {
      orderId,
      type: STATUS_EVENT[status],
      payload: {},
      deviceTimestamp: new Date().toISOString(),
      idempotencyKey: `${orderId}:status:${status}:${Date.now()}`,
      staffId: ctx.staffId,
      deviceId: ctx.deviceId,
    },
  ]);
}

type OrderWithRels = Prisma.OrderGetPayload<{ include: { items: true; payments: true; table: true } }>;

function toOrderDTO(order: OrderWithRels): OrderDTO {
  return {
    id: order.id,
    organizationId: order.organizationId,
    locationId: order.locationId,
    tableId: order.tableId,
    tableLabel: order.table?.label ?? null,
    channel: order.channel as Channel,
    fulfillment: order.fulfillment as Fulfillment,
    status: order.status as OrderStatus,
    currency: order.currency as OrderDTO["currency"],
    subtotalMinor: order.subtotalMinor,
    taxMinor: order.taxMinor,
    totalMinor: order.totalMinor,
    paidMinor: order.paidMinor,
    tipMinor: order.tipMinor,
    balanceMinor: order.totalMinor - order.paidMinor,
    customerName: order.customerName,
    note: order.note,
    items: order.items
      .filter((i) => !i.voided)
      .map((i) => ({
        id: i.id,
        lineId: i.lineId,
        menuItemId: i.menuItemId,
        nameSnapshot: i.nameSnapshot,
        unitPriceMinor: i.unitPriceMinor,
        qty: i.qty,
        modifiers: (safeJson(i.modifiers) as { name: string; priceDeltaMinor: number }[] | null) ?? [],
        lineTotalMinor: i.lineTotalMinor,
        station: i.station,
        voided: i.voided,
      })),
    payments: order.payments.map((p) => ({
      id: p.id,
      rail: p.rail as PaymentRail,
      amountMinor: p.amountMinor,
      tipMinor: p.tipMinor,
      currency: p.currency as OrderDTO["currency"],
      status: p.status as OrderDTO["payments"][number]["status"],
      processorToken: p.processorToken,
      tenderedMinor: p.tenderedMinor,
      changeMinor: p.changeMinor,
    })),
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
  };
}

export async function getOrderDTO(orderId: string): Promise<OrderDTO | null> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: true, payments: true, table: true },
  });
  return order ? toOrderDTO(order) : null;
}

/** Kitchen display queue — confirmed/ready orders across all channels (POS-02 / KIOSK-05 / QR-06). */
export async function listKitchenOrders(ctx: TenantContext): Promise<OrderDTO[]> {
  const orders = await prisma.order.findMany({
    where: { organizationId: ctx.organizationId, status: { in: ["CONFIRMED", "READY"] } },
    include: { items: true, payments: true, table: true },
    orderBy: { createdAt: "asc" },
  });
  return orders.map(toOrderDTO);
}

export async function listOrders(ctx: TenantContext, statuses?: OrderStatus[]): Promise<OrderDTO[]> {
  const orders = await prisma.order.findMany({
    where: { organizationId: ctx.organizationId, ...(statuses ? { status: { in: statuses } } : {}) },
    include: { items: true, payments: true, table: true },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return orders.map(toOrderDTO);
}

function safeJson(s: string | null | undefined): unknown {
  if (!s) return null;
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}
