/**
 * Order event payloads (DB-06). An order is a REPLAY of these events, never a client's claimed
 * final state. Each event is the unit the offline outbox (FE-04) queues and the sync engine
 * (BE-03) validates, orders, and merges.
 */
import { z } from "zod";
import { zChannel, zFulfillment, zStation, zPaymentRail, zCurrency } from "./constants.js";

export const zModifierSnapshot = z.object({
  name: z.string(),
  priceDeltaMinor: z.number().int(),
});
export type ModifierSnapshot = z.infer<typeof zModifierSnapshot>;

export const zOrderCreatedPayload = z.object({
  locationId: z.string().min(1),
  channel: zChannel,
  fulfillment: zFulfillment,
  currency: zCurrency,
  tableId: z.string().optional(),
  customerName: z.string().optional(),
  customerPhone: z.string().optional(),
  deliveryAddress: z.string().optional(),
  note: z.string().optional(),
  scheduledFor: z.string().datetime().optional(),
});

export const zItemAddedPayload = z.object({
  lineId: z.string().min(1),
  menuItemId: z.string().min(1),
  nameSnapshot: z.string().min(1),
  unitPriceMinor: z.number().int().nonnegative(),
  qty: z.number().int().positive(),
  modifiers: z.array(zModifierSnapshot).optional(),
  station: zStation.optional(),
  note: z.string().optional(),
});

export const zItemRemovedPayload = z.object({ lineId: z.string().min(1) });

export const zItemQtyChangedPayload = z.object({
  lineId: z.string().min(1),
  qty: z.number().int().nonnegative(), // 0 removes the line
});

export const zPaymentCapturedPayload = z.object({
  paymentId: z.string().optional(),
  rail: zPaymentRail,
  amountMinor: z.number().int().positive(),
  tipMinor: z.number().int().nonnegative().optional(), // PAY-06: gratuity added at capture
  tenderedMinor: z.number().int().optional(),
  changeMinor: z.number().int().optional(),
  processorToken: z.string().optional(),
});

export const zEmptyPayload = z.object({}).passthrough();

/** Map event type → payload schema, used by the order engine to validate before applying. */
export const EVENT_PAYLOAD_SCHEMAS = {
  ORDER_CREATED: zOrderCreatedPayload,
  ITEM_ADDED: zItemAddedPayload,
  ITEM_REMOVED: zItemRemovedPayload,
  ITEM_QTY_CHANGED: zItemQtyChangedPayload,
  PAYMENT_CAPTURED: zPaymentCapturedPayload,
  ORDER_CONFIRMED: zEmptyPayload,
  ORDER_READY: zEmptyPayload,
  ORDER_CLOSED: zEmptyPayload,
  ORDER_VOIDED: zEmptyPayload,
} as const;

/** A single event as produced by a client (POS/QR/online) and queued in the outbox. */
export const zOrderEventInput = z.object({
  orderId: z.string().min(1),
  type: z.enum([
    "ORDER_CREATED",
    "ITEM_ADDED",
    "ITEM_REMOVED",
    "ITEM_QTY_CHANGED",
    "PAYMENT_CAPTURED",
    "ORDER_CONFIRMED",
    "ORDER_READY",
    "ORDER_CLOSED",
    "ORDER_VOIDED",
  ]),
  payload: z.unknown(),
  deviceId: z.string().optional(),
  staffId: z.string().optional(),
  deviceTimestamp: z.string().datetime(),
  idempotencyKey: z.string().min(1),
});
export type OrderEventInput = z.infer<typeof zOrderEventInput>;

/** A batch of events drained from a device's outbox (the sync request body). */
export const zSyncBatch = z.object({
  deviceId: z.string().optional(),
  events: z.array(zOrderEventInput).max(500),
});
export type SyncBatch = z.infer<typeof zSyncBatch>;

export type OrderCreatedPayload = z.infer<typeof zOrderCreatedPayload>;
export type ItemAddedPayload = z.infer<typeof zItemAddedPayload>;
export type PaymentCapturedPayload = z.infer<typeof zPaymentCapturedPayload>;
