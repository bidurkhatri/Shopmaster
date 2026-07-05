/**
 * Order replay conflict-resolution tests (DB-09) — the offline-merge cases beyond replay.test.ts.
 *
 * The rule under test (see replay.ts): a genuine conflict is the SAME line's qty edited by TWO
 * different devices. It resolves deterministically — the earliest device-local timestamp already
 * applied wins — and the losing edit is PRESERVED in `conflicts`, never silently dropped. Sequential
 * edits from a single device are ordinary last-write-wins, not conflicts. Replay is order-independent:
 * events are fully re-sorted (deviceTimestamp, then receivedAt, then id) before applying, so any input
 * shuffling yields the same state.
 */
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

const qtyChange = (id: string, lineId: string, qty: number, ts: string, deviceId: string) =>
  ev({ id, type: "ITEM_QTY_CHANGED", deviceId, deviceTimestamp: ts, payload: { lineId, qty } });

const removeItem = (id: string, lineId: string, ts: string, deviceId = "dev-a") =>
  ev({ id, type: "ITEM_REMOVED", deviceId, deviceTimestamp: ts, payload: { lineId } });

const payment = (id: string, rail: string, amountMinor: number, ts: string, deviceId: string) =>
  ev({ id, type: "PAYMENT_CAPTURED", deviceId, deviceTimestamp: ts, payload: { rail, amountMinor } });

/** Deterministic seeded PRNG (mulberry32) so shuffles are reproducible across runs. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(arr: T[], seed: number): T[] {
  const a = [...arr];
  const rand = mulberry32(seed);
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const tmp = a[i]!;
    a[i] = a[j]!;
    a[j] = tmp;
  }
  return a;
}

describe("replayOrder conflict resolution (DB-09)", () => {
  it("resolves three devices editing one line: earliest applied edit wins, later cross-device edits become conflicts", () => {
    const o = replayOrder(
      [
        created("2026-07-01T00:00:00Z"),
        add("e1", "l1", 500, 1, "2026-07-01T00:00:01Z", "dev-a"),
        // dev-a raises qty to 2 at t=03 (earliest of the three qty edits) → applied.
        qtyChange("q-a", "l1", 2, "2026-07-01T00:00:03Z", "dev-a"),
        // dev-b (offline) wants 4 at t=05 and dev-c (offline) wants 8 at t=07 → both lose to dev-a.
        qtyChange("q-b", "l1", 4, "2026-07-01T00:00:05Z", "dev-b"),
        qtyChange("q-c", "l1", 8, "2026-07-01T00:00:07Z", "dev-c"),
      ],
      AU_GST,
    );

    expect(o.items).toHaveLength(1);
    expect(o.items[0]!.qty).toBe(2); // earliest device-time edit (dev-a @ t=03) wins

    expect(o.conflicts).toHaveLength(2); // dev-b and dev-c preserved, not dropped
    // Every losing edit points back at the same winning value/owner (dev-a's qty 2).
    expect(o.conflicts.every((c) => c.winner.value === 2 && c.winner.deviceId === "dev-a")).toBe(true);
    // Conflicts are recorded in applied (sorted) order: dev-b @ t=05 then dev-c @ t=07.
    expect(o.conflicts[0]!.loser).toMatchObject({ deviceId: "dev-b", value: 4, eventId: "q-b" });
    expect(o.conflicts[1]!.loser).toMatchObject({ deviceId: "dev-c", value: 8, eventId: "q-c" });

    // Totals reflect the winning qty only: 2 * 500 = 1000 subtotal, +10% GST.
    expect(o.totals).toEqual({ subtotalMinor: 1000, taxMinor: 100, totalMinor: 1100 });
  });

  it("breaks ties deterministically by event id when device timestamps are equal", () => {
    // All three qty edits carry the SAME deviceTimestamp; compareEvents falls through to id order, so
    // "q-a" (same device as the add) is applied first and the other two conflict against it.
    const events = [
      created("2026-07-01T00:00:00Z"),
      add("e1", "l1", 500, 1, "2026-07-01T00:00:01Z", "dev-a"),
      qtyChange("q-a", "l1", 2, "2026-07-01T00:00:05Z", "dev-a"),
      qtyChange("q-b", "l1", 9, "2026-07-01T00:00:05Z", "dev-b"),
      qtyChange("q-c", "l1", 7, "2026-07-01T00:00:05Z", "dev-c"),
    ];
    const forward = replayOrder(events, AU_GST);
    const reversed = replayOrder([...events].reverse(), AU_GST);

    // Input array order must not matter — replay re-sorts internally.
    expect(reversed).toEqual(forward);

    // "q-a" wins the id tiebreak among the equal-timestamp edits; q-b and q-c lose.
    expect(forward.items[0]!.qty).toBe(2);
    expect(forward.conflicts).toHaveLength(2);
    expect(forward.conflicts.every((c) => c.winner.value === 2 && c.winner.deviceId === "dev-a")).toBe(true);
    expect(forward.conflicts.map((c) => c.loser.value)).toEqual([9, 7]);
    expect(forward.conflicts.map((c) => c.loser.eventId)).toEqual(["q-b", "q-c"]);
  });

  it("keeps a cross-device removal while preserving the losing qty edit (remove vs qty-change across devices)", () => {
    const o = replayOrder(
      [
        created("2026-07-01T00:00:00Z"),
        add("e1", "l1", 500, 2, "2026-07-01T00:00:01Z", "dev-a"),
        // dev-a removes the line at t=05 …
        removeItem("e2", "l1", "2026-07-01T00:00:05Z", "dev-a"),
        // … while dev-b (offline) tries to bump qty at t=07 → cross-device conflict, not applied.
        qtyChange("e3", "l1", 6, "2026-07-01T00:00:07Z", "dev-b"),
      ],
      AU_GST,
    );

    expect(o.items).toHaveLength(1);
    expect(o.items[0]!.voided).toBe(true); // the removal stands
    expect(o.items[0]!.qty).toBe(2); // dev-b's edit lost the cross-device conflict → qty unchanged
    expect(o.conflicts).toHaveLength(1);
    expect(o.conflicts[0]!.loser).toMatchObject({ deviceId: "dev-b", value: 6, eventId: "e3" });
    expect(o.conflicts[0]!.winner.value).toBe(2);
    expect(o.totals.subtotalMinor).toBe(0); // voided line excluded from totals
  });

  it("applies a same-device qty edit then lets another device remove the line (removal is not a qty conflict)", () => {
    const o = replayOrder(
      [
        created("2026-07-01T00:00:00Z"),
        add("e1", "l1", 500, 1, "2026-07-01T00:00:01Z", "dev-a"),
        qtyChange("e2", "l1", 4, "2026-07-01T00:00:03Z", "dev-a"), // same device → applies (LWW)
        removeItem("e3", "l1", "2026-07-01T00:00:05Z", "dev-b"), // different device removes → not a conflict
      ],
      AU_GST,
    );

    expect(o.items[0]!.qty).toBe(4); // the applied qty is retained on the (now voided) line
    expect(o.items[0]!.voided).toBe(true);
    expect(o.conflicts).toHaveLength(0); // a removal never registers as a qty conflict
    expect(o.totals.subtotalMinor).toBe(0);
  });

  it("records payments captured on two different devices (both land, paid amount sums)", () => {
    const o = replayOrder(
      [
        created("2026-07-01T00:00:00Z"),
        add("e1", "l1", 500, 2, "2026-07-01T00:00:01Z", "dev-a"), // subtotal 1000, +GST → total 1100
        payment("p1", "CASH", 600, "2026-07-01T00:00:03Z", "dev-a"),
        payment("p2", "TYRO", 500, "2026-07-01T00:00:04Z", "dev-b"),
        ev({ id: "e-closed", type: "ORDER_CLOSED", deviceTimestamp: "2026-07-01T00:00:05Z", payload: {} }),
      ],
      AU_GST,
    );

    expect(o.payments).toHaveLength(2); // no dedup across devices — both are recorded
    expect(o.payments.map((p) => p.rail)).toEqual(["CASH", "TYRO"]);
    expect(o.payments.map((p) => p.amountMinor)).toEqual([600, 500]);
    expect(o.paidMinor).toBe(1100); // 600 + 500, matches the order total
    expect(o.status).toBe("CLOSED");
  });

  it("is deterministic across many input shufflings of a larger mixed event set", () => {
    const events = [
      created("2026-07-01T00:00:00Z"),
      add("a1", "l1", 500, 1, "2026-07-01T00:00:01Z", "dev-a"),
      add("a2", "l2", 900, 2, "2026-07-01T00:00:02Z", "dev-b"),
      add("a3", "l3", 300, 3, "2026-07-01T00:00:02Z", "dev-c"),
      qtyChange("q1", "l1", 4, "2026-07-01T00:00:04Z", "dev-a"), // same device → applies
      qtyChange("q3", "l2", 5, "2026-07-01T00:00:05Z", "dev-c"), // cross device on l2 → conflict (loses)
      qtyChange("q2", "l1", 9, "2026-07-01T00:00:06Z", "dev-b"), // cross device on l1 → conflict (loses)
      removeItem("r1", "l3", "2026-07-01T00:00:07Z", "dev-a"), // void l3
      payment("p1", "CASH", 700, "2026-07-01T00:00:08Z", "dev-a"),
      payment("p2", "TYRO", 800, "2026-07-01T00:00:09Z", "dev-b"),
      ev({ id: "c1", type: "ORDER_CONFIRMED", deviceTimestamp: "2026-07-01T00:00:03Z", payload: {} }),
      ev({ id: "z1", type: "ORDER_CLOSED", deviceTimestamp: "2026-07-01T00:00:10Z", payload: {} }),
    ];

    const base = replayOrder(events, AU_GST);

    // A spread of deterministic permutations: reverse, two rotations, and two seeded shuffles.
    const permutations = [
      [...events].reverse(),
      [...events.slice(6), ...events.slice(0, 6)],
      [...events.slice(3), ...events.slice(0, 3)],
      shuffle(events, 12345),
      shuffle(events, 67890),
    ];
    for (const perm of permutations) {
      expect(replayOrder(perm, AU_GST)).toEqual(base);
    }

    // Sanity-check the state the determinism is protecting, so a wrong-but-stable result is still caught.
    expect(base.items.find((i) => i.lineId === "l1")!.qty).toBe(4); // q1 applied, q2 lost
    expect(base.items.find((i) => i.lineId === "l2")!.qty).toBe(2); // q3 lost (cross-device)
    expect(base.items.find((i) => i.lineId === "l3")!.voided).toBe(true); // removed
    expect(base.conflicts.map((c) => c.loser.eventId).sort()).toEqual(["q2", "q3"]);
    expect(base.paidMinor).toBe(1500);
    expect(base.status).toBe("CLOSED");
  });
});
