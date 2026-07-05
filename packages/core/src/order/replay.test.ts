import { describe, it, expect } from "vitest";
import { replayOrder, type ReplayEvent } from "./replay.js";

const AU_GST = { taxRateBps: 1000, taxInclusive: false };

function ev(partial: Partial<ReplayEvent> & { type: ReplayEvent["type"]; id: string }): ReplayEvent {
  return { deviceTimestamp: new Date().toISOString(), payload: {}, ...partial };
}

const created = (ts: string) =>
  ev({
    id: "e-created",
    type: "ORDER_CREATED",
    deviceTimestamp: ts,
    payload: { locationId: "loc1", channel: "POS", fulfillment: "DINE_IN", currency: "AUD" },
  });

const add = (id: string, lineId: string, price: number, qty: number, ts: string, deviceId = "dev-a") =>
  ev({
    id,
    type: "ITEM_ADDED",
    deviceId,
    deviceTimestamp: ts,
    payload: { lineId, menuItemId: "mi1", nameSnapshot: "Flat White", unitPriceMinor: price, qty, station: "BAR" },
  });

describe("replayOrder", () => {
  it("materializes a simple order with GST", () => {
    const o = replayOrder([created("2026-07-01T00:00:00Z"), add("e1", "l1", 480, 2, "2026-07-01T00:00:01Z")], AU_GST);
    expect(o.created).toBe(true);
    expect(o.channel).toBe("POS");
    expect(o.items).toHaveLength(1);
    expect(o.items[0]!.qty).toBe(2);
    expect(o.totals).toEqual({ subtotalMinor: 960, taxMinor: 96, totalMinor: 1056 });
  });

  it("is order-independent: shuffled events replay to the same state", () => {
    const events = [
      add("e2", "l2", 1650, 1, "2026-07-01T00:00:02Z"),
      created("2026-07-01T00:00:00Z"),
      add("e1", "l1", 480, 2, "2026-07-01T00:00:01Z"),
    ];
    const a = replayOrder(events, AU_GST);
    const b = replayOrder([...events].reverse(), AU_GST);
    expect(a.totals).toEqual(b.totals);
    expect(a.items.map((i) => i.lineId).sort()).toEqual(["l1", "l2"]);
  });

  it("merges additions from two offline devices (DB-07)", () => {
    const o = replayOrder(
      [
        created("2026-07-01T00:00:00Z"),
        add("e1", "l1", 480, 1, "2026-07-01T00:00:01Z", "dev-a"),
        add("e2", "l2", 900, 1, "2026-07-01T00:00:01Z", "dev-b"),
      ],
      AU_GST,
    );
    expect(o.items).toHaveLength(2); // both devices' items survive
    expect(o.totals.subtotalMinor).toBe(1380);
  });

  it("applies sequential qty edits from one device (last-write-wins)", () => {
    const o = replayOrder(
      [
        created("2026-07-01T00:00:00Z"),
        add("e1", "l1", 480, 1, "2026-07-01T00:00:01Z", "dev-a"),
        ev({ id: "e2", type: "ITEM_QTY_CHANGED", deviceId: "dev-a", deviceTimestamp: "2026-07-01T00:00:02Z", payload: { lineId: "l1", qty: 2 } }),
        ev({ id: "e3", type: "ITEM_QTY_CHANGED", deviceId: "dev-a", deviceTimestamp: "2026-07-01T00:00:03Z", payload: { lineId: "l1", qty: 3 } }),
      ],
      AU_GST,
    );
    expect(o.items[0]!.qty).toBe(3);
    expect(o.conflicts).toHaveLength(0);
  });

  it("resolves a cross-device qty conflict: earliest device time wins, loser preserved (DB-09)", () => {
    const o = replayOrder(
      [
        created("2026-07-01T00:00:00Z"),
        add("e1", "l1", 480, 1, "2026-07-01T00:00:01Z", "dev-a"),
        // dev-a sets qty 2 at t=05; dev-b (offline) sets qty 5 at t=09 → dev-a's earlier edit wins
        ev({ id: "e2", type: "ITEM_QTY_CHANGED", deviceId: "dev-a", deviceTimestamp: "2026-07-01T00:00:05Z", payload: { lineId: "l1", qty: 2 } }),
        ev({ id: "e3", type: "ITEM_QTY_CHANGED", deviceId: "dev-b", deviceTimestamp: "2026-07-01T00:00:09Z", payload: { lineId: "l1", qty: 5 } }),
      ],
      AU_GST,
    );
    expect(o.items[0]!.qty).toBe(2);
    expect(o.conflicts).toHaveLength(1);
    expect(o.conflicts[0]!.loser.value).toBe(5);
    expect(o.conflicts[0]!.winner.value).toBe(2);
  });

  it("removes an item and excludes it from totals", () => {
    const o = replayOrder(
      [
        created("2026-07-01T00:00:00Z"),
        add("e1", "l1", 480, 2, "2026-07-01T00:00:01Z"),
        ev({ id: "e2", type: "ITEM_REMOVED", deviceTimestamp: "2026-07-01T00:00:02Z", payload: { lineId: "l1" } }),
      ],
      AU_GST,
    );
    expect(o.items[0]!.voided).toBe(true);
    expect(o.totals.subtotalMinor).toBe(0);
  });

  it("records payments and computes paid amount", () => {
    const o = replayOrder(
      [
        created("2026-07-01T00:00:00Z"),
        add("e1", "l1", 480, 2, "2026-07-01T00:00:01Z"),
        ev({ id: "e2", type: "PAYMENT_CAPTURED", deviceTimestamp: "2026-07-01T00:00:03Z", payload: { rail: "CASH", amountMinor: 1056, tenderedMinor: 1100, changeMinor: 44 } }),
        ev({ id: "e3", type: "ORDER_CLOSED", deviceTimestamp: "2026-07-01T00:00:04Z", payload: {} }),
      ],
      AU_GST,
    );
    expect(o.paidMinor).toBe(1056);
    expect(o.status).toBe("CLOSED");
  });

  it("accumulates tips separately from the goods amount (PAY-06)", () => {
    const o = replayOrder(
      [
        created("2026-07-01T00:00:00Z"),
        add("e1", "l1", 480, 2, "2026-07-01T00:00:01Z"),
        // Paid 1056 goods + 150 tip; tip must not inflate paidMinor toward the balance.
        ev({ id: "e2", type: "PAYMENT_CAPTURED", deviceTimestamp: "2026-07-01T00:00:03Z", payload: { rail: "TYRO", amountMinor: 1056, tipMinor: 150 } }),
        ev({ id: "e3", type: "ORDER_CLOSED", deviceTimestamp: "2026-07-01T00:00:04Z", payload: {} }),
      ],
      AU_GST,
    );
    expect(o.paidMinor).toBe(1056); // goods only — the bill is settled
    expect(o.tipMinor).toBe(150); // tip tracked independently for reporting/payout
    expect(o.payments[0]!.tipMinor).toBe(150);
  });

  it("is idempotent for a re-added line id (no doubling)", () => {
    const o = replayOrder(
      [
        created("2026-07-01T00:00:00Z"),
        add("e1", "l1", 480, 2, "2026-07-01T00:00:01Z"),
        add("e1", "l1", 480, 2, "2026-07-01T00:00:01Z"), // duplicate delivery of the same event
      ],
      AU_GST,
    );
    expect(o.items).toHaveLength(1);
    expect(o.items[0]!.qty).toBe(2);
  });
});
