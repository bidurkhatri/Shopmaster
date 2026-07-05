import { Router } from "express";
import {
  createOrder,
  ingestEvents,
  payOrder,
  setOrderStatus,
  getOrderDTO,
  listOrders,
  listKitchenOrders,
  type IngestEvent,
} from "@shopmaster/core";
import {
  zCreateOrderRequest,
  zPaymentRequest,
  zSyncBatch,
  zOrderStatus,
  ORDER_STATUSES,
  type OrderStatus,
} from "@shopmaster/shared";
import { z } from "zod";
import { h, HttpError, requireCtx } from "../http.js";
import { requireAuth, requirePermission } from "../auth-middleware.js";

export const ordersRouter = Router();

const zEventsBody = zSyncBatch.pick({ events: true });
const zStatusBody = z.object({ status: zOrderStatus });

/** Fetch an order, enforcing tenant isolation at the API boundary (GAP-05). */
async function getOrderScoped(orgId: string, id: string) {
  const dto = await getOrderDTO(id);
  if (!dto || dto.organizationId !== orgId) throw new HttpError(404, "Order not found");
  return dto;
}

ordersRouter.post(
  "/orders",
  requireAuth,
  requirePermission("order.take"),
  h(async (req, res) => {
    const ctx = requireCtx(req);
    const input = zCreateOrderRequest.parse(req.body);
    const orderId = await createOrder(ctx, input);
    res.status(201).json(await getOrderDTO(orderId));
  }),
);

ordersRouter.get(
  "/orders",
  requireAuth,
  h(async (req, res) => {
    const ctx = requireCtx(req);
    const statusParam = typeof req.query.status === "string" ? req.query.status.split(",") : undefined;
    const statuses = statusParam?.filter((s): s is OrderStatus => (ORDER_STATUSES as readonly string[]).includes(s));
    res.json(await listOrders(ctx, statuses));
  }),
);

ordersRouter.get(
  "/kitchen",
  requireAuth,
  requirePermission("kitchen.view"),
  h(async (req, res) => {
    const ctx = requireCtx(req);
    res.json(await listKitchenOrders(ctx));
  }),
);

ordersRouter.get(
  "/orders/:id",
  requireAuth,
  h(async (req, res) => {
    const ctx = requireCtx(req);
    res.json(await getOrderScoped(ctx.organizationId, req.params.id));
  }),
);

ordersRouter.post(
  "/orders/:id/events",
  requireAuth,
  requirePermission("order.take"),
  h(async (req, res) => {
    const ctx = requireCtx(req);
    await getOrderScoped(ctx.organizationId, req.params.id); // tenancy check
    const { events } = zEventsBody.parse(req.body);
    const forced: IngestEvent[] = events.map((e) => ({
      orderId: req.params.id,
      type: e.type,
      payload: e.payload ?? {},
      deviceId: e.deviceId,
      staffId: e.staffId,
      deviceTimestamp: e.deviceTimestamp,
      idempotencyKey: e.idempotencyKey,
    }));
    const result = await ingestEvents(ctx, forced);
    res.json({ order: await getOrderDTO(req.params.id), ...result });
  }),
);

ordersRouter.post(
  "/orders/:id/pay",
  requireAuth,
  requirePermission("order.pay"),
  h(async (req, res) => {
    const ctx = requireCtx(req);
    await getOrderScoped(ctx.organizationId, req.params.id);
    const { rail, amountMinor, tenderedMinor } = zPaymentRequest.parse(req.body);
    const { payment, result } = await payOrder(ctx, req.params.id, { rail, amountMinor, tenderedMinor });
    res.json({ order: await getOrderDTO(req.params.id), payment, result });
  }),
);

ordersRouter.post(
  "/orders/:id/status",
  requireAuth,
  h(async (req, res) => {
    const ctx = requireCtx(req);
    await getOrderScoped(ctx.organizationId, req.params.id);
    const { status } = zStatusBody.parse(req.body);
    if (status === "OPEN") throw new HttpError(400, "Cannot set status back to OPEN");
    await setOrderStatus(ctx, req.params.id, status);
    res.json({ order: await getOrderDTO(req.params.id) });
  }),
);
