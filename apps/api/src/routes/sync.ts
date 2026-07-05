import { Router } from "express";
import { prisma } from "@shopmaster/db";
import { ingestEvents, type IngestEvent } from "@shopmaster/core";
import { zSyncBatch, zOrderCreatedPayload } from "@shopmaster/shared";
import { h, requireCtx } from "../http.js";
import { requireAuth } from "../auth-middleware.js";

/**
 * Offline outbox drain (BE-03..BE-06, SYNC-01..05). A staff device POSTs a batch of the
 * timestamped, device-signed events it queued while offline; the server validates, orders and
 * merges them (idempotently), including creating any order that was first opened offline.
 */
export const syncRouter = Router();

syncRouter.post(
  "/sync",
  requireAuth,
  h(async (req, res) => {
    const ctx = requireCtx(req);
    const batch = zSyncBatch.parse(req.body);

    // Create any orders that were opened offline (their ORDER_CREATED event carries the shape).
    const orderIds = [...new Set(batch.events.map((e) => e.orderId))];
    for (const orderId of orderIds) {
      const exists = await prisma.order.findUnique({ where: { id: orderId } });
      if (exists) continue;
      const createdEv = batch.events.find((e) => e.orderId === orderId && e.type === "ORDER_CREATED");
      if (!createdEv) continue;
      const parsed = zOrderCreatedPayload.safeParse(createdEv.payload);
      if (!parsed.success) continue;
      const p = parsed.data;
      const loc = await prisma.location.findUnique({ where: { id: p.locationId } });
      if (!loc || loc.organizationId !== ctx.organizationId) continue; // tenancy guard
      await prisma.order.create({
        data: {
          id: orderId,
          organizationId: ctx.organizationId,
          locationId: p.locationId,
          tableId: p.tableId ?? null,
          channel: p.channel,
          fulfillment: p.fulfillment,
          currency: p.currency,
          customerName: p.customerName ?? null,
          status: "OPEN",
        },
      });
    }

    const events: IngestEvent[] = batch.events.map((e) => ({
      orderId: e.orderId,
      type: e.type,
      payload: e.payload,
      deviceId: e.deviceId ?? batch.deviceId,
      staffId: e.staffId,
      deviceTimestamp: e.deviceTimestamp,
      idempotencyKey: e.idempotencyKey,
    }));

    const result = await ingestEvents(ctx, events);

    if (batch.deviceId) {
      await prisma.device
        .update({ where: { id: batch.deviceId }, data: { lastSeenAt: new Date() } })
        .catch(() => undefined);
    }

    res.json({ ...result, serverTime: new Date().toISOString() });
  }),
);

/** Per-device sync state for the always-visible status indicator (BE-06 / SYNC-05). */
syncRouter.get(
  "/sync/state",
  requireAuth,
  h(async (req, res) => {
    const ctx = requireCtx(req);
    const deviceId = typeof req.query.deviceId === "string" ? req.query.deviceId : undefined;
    const last = await prisma.orderEvent.findFirst({
      where: { organizationId: ctx.organizationId, ...(deviceId ? { deviceId } : {}) },
      orderBy: { receivedAt: "desc" },
      select: { receivedAt: true },
    });
    res.json({
      lastSyncAt: last?.receivedAt?.toISOString() ?? null,
      serverTime: new Date().toISOString(),
      pendingOnServer: 0,
    });
  }),
);
