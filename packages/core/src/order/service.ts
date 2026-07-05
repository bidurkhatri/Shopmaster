/**
 * Order Service (Backend-Arch §4). The one module every channel writes to. Orders are stored as an
 * append-only event log; the materialized Order/OrderItem rows are DERIVED from that log by replay
 * and are safe to rebuild at any time (DB-10). Payment, status and item mutations all go through
 * events so POS, QR, kiosk and online behave identically and offline batches merge deterministically.
 */
import { prisma, type Prisma } from "@shopmaster/db";
import type { OrderEventType, PaymentRail, OrderDTO, Channel, Fulfillment, OrderStatus } from "@shopmaster/shared";
import { replayOrder, type ReplayEvent, type MaterializedOrder } from "./replay.js";
import type { TaxConfig } from "../pricing-tax.js";
import { charge } from "../payments/index.js";
import { emitDomainEvent } from "../events/emitter.js";
import { assertTenant, type TenantContext } from "../tenancy.js";

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

  await prisma.$transaction(async (tx) => {
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

  emitDomainEvent({ type: "order.created", orderId: order.id, organizationId: ctx.organizationId });
  return order.id;
}

export async function payOrder(
  ctx: TenantContext,
  orderId: string,
  req: { rail: PaymentRail; amountMinor: number; tenderedMinor?: number },
) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  assertTenant(ctx, order);

  const result = await charge({
    orderId,
    amountMinor: req.amountMinor,
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

const STATUS_EVENT: Record<"CONFIRMED" | "READY" | "CLOSED" | "VOID", OrderEventType> = {
  CONFIRMED: "ORDER_CONFIRMED",
  READY: "ORDER_READY",
  CLOSED: "ORDER_CLOSED",
  VOID: "ORDER_VOIDED",
};

export async function setOrderStatus(ctx: TenantContext, orderId: string, status: "CONFIRMED" | "READY" | "CLOSED" | "VOID") {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  assertTenant(ctx, order);
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
  if (status === "CONFIRMED") emitDomainEvent({ type: "order.confirmed", orderId, organizationId: order!.organizationId });
  if (status === "CLOSED") emitDomainEvent({ type: "order.closed", orderId, organizationId: order!.organizationId });
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
