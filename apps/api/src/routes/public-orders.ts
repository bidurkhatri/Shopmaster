import { Router } from "express";
import { z } from "zod";
import { prisma } from "@shopmaster/db";
import { createOrder, ingestEvents, payOrder, getOrderDTO, type IngestEvent, type TenantContext } from "@shopmaster/core";
import { zFulfillment, zPaymentRequest, zSyncBatch } from "@shopmaster/shared";
import { h, HttpError } from "../http.js";
import { rateLimit } from "../rate-limit.js";

/**
 * PUBLIC customer ordering — QR/NFC table ordering and branded online ordering. These are the only
 * endpoints that accept requests with NO staff authentication (BE-13), so they carry their own
 * per-session rate limiting. The order id itself scopes the request; the tenant context is derived
 * from the order's organization, never trusted from the client.
 */
export const publicOrdersRouter = Router();

const perOrderLimit = rateLimit({ windowMs: 60_000, max: 60, key: (req) => `order:${req.params.id}` });
const createLimit = rateLimit({ windowMs: 60_000, max: 30 });
const zEventsBody = zSyncBatch.pick({ events: true });

const zPublicCreate = z.object({
  qrToken: z.string().optional(),
  orgSlug: z.string().optional(),
  fulfillment: zFulfillment.optional(),
  customerName: z.string().optional(),
  customerPhone: z.string().optional(),
  deliveryAddress: z.string().optional(),
  note: z.string().optional(),
  loyaltyOptIn: z.boolean().optional(), // CRM-01: join rewards with the phone provided
});

function publicCtx(organizationId: string): TenantContext {
  // No device/staff for public (QR/online) orders — leaving these undefined keeps the
  // OrderEvent device/staff foreign keys null rather than pointing at a non-existent row.
  return { organizationId, locationIds: [] };
}

publicOrdersRouter.post(
  "/public/orders",
  createLimit,
  h(async (req, res) => {
    const input = zPublicCreate.parse(req.body);

    let organizationId: string | undefined;
    let channel: "QR" | "ONLINE" = "ONLINE";
    let qrToken: string | undefined;

    if (input.qrToken) {
      const table = await prisma.tableOrTab.findUnique({
        where: { qrToken: input.qrToken },
        include: { location: true },
      });
      if (!table) throw new HttpError(404, "Table not found");
      organizationId = table.location.organizationId;
      channel = "QR";
      qrToken = input.qrToken;
    } else if (input.orgSlug) {
      const org = await prisma.organization.findUnique({ where: { slug: input.orgSlug } });
      if (!org) throw new HttpError(404, "Store not found");
      organizationId = org.id;
      channel = "ONLINE";
    } else {
      throw new HttpError(400, "Provide qrToken or orgSlug");
    }

    const ctx = publicCtx(organizationId);
    const orderId = await createOrder(ctx, {
      channel,
      fulfillment: input.fulfillment ?? (channel === "QR" ? "DINE_IN" : "PICKUP"),
      qrToken,
      customerName: input.customerName,
      customerPhone: input.customerPhone,
      deliveryAddress: input.deliveryAddress,
      note: input.note,
      loyaltyOptIn: input.loyaltyOptIn,
    });
    res.status(201).json(await getOrderDTO(orderId));
  }),
);

publicOrdersRouter.get(
  "/public/orders/:id",
  h(async (req, res) => {
    const dto = await getOrderDTO(req.params.id);
    if (!dto) throw new HttpError(404, "Order not found");
    res.json(dto);
  }),
);

publicOrdersRouter.post(
  "/public/orders/:id/events",
  perOrderLimit,
  h(async (req, res) => {
    const order = await prisma.order.findUnique({ where: { id: req.params.id } });
    if (!order) throw new HttpError(404, "Order not found");
    const ctx = publicCtx(order.organizationId);
    const { events } = zEventsBody.parse(req.body);
    const forced: IngestEvent[] = events.map((e) => ({
      orderId: order.id,
      type: e.type,
      payload: e.payload ?? {},
      deviceId: e.deviceId,
      staffId: e.staffId,
      deviceTimestamp: e.deviceTimestamp,
      idempotencyKey: e.idempotencyKey,
    }));
    const result = await ingestEvents(ctx, forced);
    res.json({ order: await getOrderDTO(order.id), ...result });
  }),
);

publicOrdersRouter.post(
  "/public/orders/:id/pay",
  perOrderLimit,
  h(async (req, res) => {
    const order = await prisma.order.findUnique({ where: { id: req.params.id } });
    if (!order) throw new HttpError(404, "Order not found");
    const ctx = publicCtx(order.organizationId);
    const { rail, amountMinor, tenderedMinor } = zPaymentRequest.parse(req.body);
    const { payment, result } = await payOrder(ctx, order.id, { rail, amountMinor, tenderedMinor });
    res.json({ order: await getOrderDTO(order.id), payment, result });
  }),
);
