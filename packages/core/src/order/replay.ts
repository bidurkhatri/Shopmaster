/**
 * Order replay engine — the core of the event-sourced design (DB-06..DB-10).
 *
 * An order's state is COMPUTED by replaying its append-only event log, never taken from a
 * client's claimed "final state" (DB-06). This makes offline merges correct: two devices that
 * each add different items to the same table while offline both land, because the events — not a
 * snapshot — are what reconcile (DB-07).
 *
 * Conflict resolution (DB-09): a genuine conflict is the SAME line's quantity edited by TWO
 * different devices. We resolve it deterministically — the earliest device-local timestamp wins —
 * and the losing edit is preserved (returned in `conflicts`, and written to the audit trail by the
 * caller) rather than silently dropped. Sequential edits from a single device are ordinary
 * last-write-wins, not conflicts.
 */
import { EVENT_PAYLOAD_SCHEMAS } from "@shopmaster/shared";
import type { OrderEventType } from "@shopmaster/shared";
import { computeTotals, lineTotalMinor, type TaxConfig, type Totals } from "../pricing-tax.js";

export interface ReplayEvent {
  id: string;
  type: OrderEventType;
  payload: unknown; // already JSON-parsed
  deviceId?: string | null;
  staffId?: string | null;
  deviceTimestamp: Date | string;
  receivedAt?: Date | string | null;
}

export interface MaterializedItem {
  lineId: string;
  menuItemId: string | null;
  nameSnapshot: string;
  unitPriceMinor: number;
  qty: number;
  modifiers: { name: string; priceDeltaMinor: number }[];
  station: string;
  note?: string;
  voided: boolean;
  lineTotalMinor: number;
}

export interface MaterializedPayment {
  paymentId?: string;
  rail: string;
  amountMinor: number;
  tipMinor?: number;
  tenderedMinor?: number;
  changeMinor?: number;
  processorToken?: string;
}

export interface ConflictRecord {
  lineId: string;
  field: "qty";
  winner: { deviceId?: string | null; deviceTimestamp: string; value: number };
  loser: { deviceId?: string | null; deviceTimestamp: string; value: number; eventId: string };
}

export interface MaterializedOrder {
  created: boolean;
  channel?: string;
  fulfillment?: string;
  currency?: string;
  locationId?: string;
  tableId?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  deliveryAddress?: string | null;
  note?: string | null;
  scheduledFor?: string | null;
  status: string;
  items: MaterializedItem[];
  payments: MaterializedPayment[];
  paidMinor: number;
  tipMinor: number;
  totals: Totals;
  conflicts: ConflictRecord[];
}

function toMs(v: Date | string | null | undefined): number {
  if (v == null) return 0;
  return v instanceof Date ? v.getTime() : Date.parse(v);
}

/** Deterministic order: device-local time, then server receipt time, then id (stable tiebreak). */
function compareEvents(a: ReplayEvent, b: ReplayEvent): number {
  const dt = toMs(a.deviceTimestamp) - toMs(b.deviceTimestamp);
  if (dt !== 0) return dt;
  const rt = toMs(a.receivedAt) - toMs(b.receivedAt);
  if (rt !== 0) return rt;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

function parsePayload(type: OrderEventType, payload: unknown): Record<string, unknown> | null {
  const schema = EVENT_PAYLOAD_SCHEMAS[type];
  const parsed = schema.safeParse(payload ?? {});
  return parsed.success ? (parsed.data as Record<string, unknown>) : null;
}

export function replayOrder(events: ReplayEvent[], tax: TaxConfig): MaterializedOrder {
  const sorted = [...events].sort(compareEvents);

  const lines = new Map<string, MaterializedItem>();
  const qtyProvenance = new Map<string, { deviceId: string | null; ts: number }>();
  const payments: MaterializedPayment[] = [];
  const conflicts: ConflictRecord[] = [];

  const state: MaterializedOrder = {
    created: false,
    status: "OPEN",
    items: [],
    payments,
    paidMinor: 0,
    tipMinor: 0,
    totals: { subtotalMinor: 0, taxMinor: 0, totalMinor: 0 },
    conflicts,
  };

  for (const e of sorted) {
    const p = parsePayload(e.type, e.payload);
    if (p === null && e.type !== "ORDER_CONFIRMED" && e.type !== "ORDER_READY" && e.type !== "ORDER_CLOSED" && e.type !== "ORDER_VOIDED") {
      continue; // malformed payload — skip defensively
    }
    const deviceId = e.deviceId ?? null;
    const ts = toMs(e.deviceTimestamp);

    switch (e.type) {
      case "ORDER_CREATED": {
        state.created = true;
        state.channel = p!.channel as string;
        state.fulfillment = p!.fulfillment as string;
        state.currency = p!.currency as string;
        state.locationId = p!.locationId as string;
        state.tableId = (p!.tableId as string) ?? null;
        state.customerName = (p!.customerName as string) ?? null;
        state.customerPhone = (p!.customerPhone as string) ?? null;
        state.deliveryAddress = (p!.deliveryAddress as string) ?? null;
        state.note = (p!.note as string) ?? null;
        state.scheduledFor = (p!.scheduledFor as string) ?? null;
        break;
      }
      case "ITEM_ADDED": {
        const lineId = p!.lineId as string;
        lines.set(lineId, {
          lineId,
          menuItemId: (p!.menuItemId as string) ?? null,
          nameSnapshot: p!.nameSnapshot as string,
          unitPriceMinor: p!.unitPriceMinor as number,
          qty: p!.qty as number,
          modifiers: (p!.modifiers as { name: string; priceDeltaMinor: number }[]) ?? [],
          station: (p!.station as string) ?? "KITCHEN",
          note: p!.note as string | undefined,
          voided: false,
          lineTotalMinor: 0,
        });
        qtyProvenance.set(lineId, { deviceId, ts });
        break;
      }
      case "ITEM_REMOVED": {
        const lineId = p!.lineId as string;
        const l = lines.get(lineId);
        if (l) l.voided = true;
        break;
      }
      case "ITEM_QTY_CHANGED": {
        const lineId = p!.lineId as string;
        const qty = p!.qty as number;
        const l = lines.get(lineId);
        if (!l) break;
        const prov = qtyProvenance.get(lineId);
        let apply = false;
        if (!prov) {
          apply = true;
        } else if (prov.deviceId === deviceId) {
          apply = true; // same device, sequential edit → last-write-wins
        } else {
          // cross-device conflict → earliest device timestamp already applied wins (DB-09)
          conflicts.push({
            lineId,
            field: "qty",
            winner: {
              deviceId: prov.deviceId,
              deviceTimestamp: new Date(prov.ts).toISOString(),
              value: l.qty,
            },
            loser: {
              deviceId,
              deviceTimestamp: new Date(ts).toISOString(),
              value: qty,
              eventId: e.id,
            },
          });
        }
        if (apply) {
          if (qty <= 0) {
            l.voided = true;
          } else {
            l.voided = false;
            l.qty = qty;
          }
          qtyProvenance.set(lineId, { deviceId, ts });
        }
        break;
      }
      case "PAYMENT_CAPTURED": {
        payments.push({
          paymentId: p!.paymentId as string | undefined,
          rail: p!.rail as string,
          amountMinor: p!.amountMinor as number,
          tipMinor: p!.tipMinor as number | undefined,
          tenderedMinor: p!.tenderedMinor as number | undefined,
          changeMinor: p!.changeMinor as number | undefined,
          processorToken: p!.processorToken as string | undefined,
        });
        break;
      }
      case "ORDER_CONFIRMED":
        if (state.status === "OPEN") state.status = "CONFIRMED";
        break;
      case "ORDER_READY":
        state.status = "READY";
        break;
      case "ORDER_CLOSED":
        state.status = "CLOSED";
        break;
      case "ORDER_VOIDED":
        state.status = "VOID";
        break;
    }
  }

  // Finalize derived values.
  const items = [...lines.values()];
  for (const l of items) {
    l.lineTotalMinor = lineTotalMinor({
      unitPriceMinor: l.unitPriceMinor,
      qty: l.qty,
      modifiers: l.modifiers,
      voided: l.voided,
    });
  }
  state.items = items;
  state.totals = computeTotals(
    items.map((l) => ({ unitPriceMinor: l.unitPriceMinor, qty: l.qty, modifiers: l.modifiers, voided: l.voided })),
    tax,
  );
  state.paidMinor = payments
    .filter((pm) => pm.rail)
    .reduce((s, pm) => s + pm.amountMinor, 0);
  state.tipMinor = payments.reduce((s, pm) => s + (pm.tipMinor ?? 0), 0);

  return state;
}
