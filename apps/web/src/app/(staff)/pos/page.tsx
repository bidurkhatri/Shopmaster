"use client";
import { useEffect, useMemo, useState } from "react";
import { StaffShell } from "@/components/StaffShell";
import { Button, Card, Money, Badge } from "@/components/ui";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/store";
import { enqueueEvents } from "@/lib/outbox";
import { totals, uid } from "@/lib/pricing";
import { railsForCurrency, type MenuCategoryDTO, type PaymentRail, type OrderEventInput, type Fulfillment } from "@shopmaster/shared";

interface LocationCtx {
  id: string;
  currency: string;
  taxRateBps: number;
  taxInclusive: boolean;
  tables: { id: string; label: string; qrToken: string }[];
}
interface CartLine {
  lineId: string;
  menuItemId: string;
  name: string;
  unitPriceMinor: number;
  qty: number;
  station: string;
}

export default function PosPage() {
  return (
    <StaffShell>
      <Pos />
    </StaffShell>
  );
}

function Pos() {
  const { organization, capabilities, deviceId } = useAuth();
  const currency = organization?.currency ?? "AUD";
  const quick = capabilities?.quickMode ?? false;

  const [menu, setMenu] = useState<MenuCategoryDTO[]>([]);
  const [loc, setLoc] = useState<LocationCtx | null>(null);
  const [activeCat, setActiveCat] = useState<string | null>(null);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [fulfillment, setFulfillment] = useState<Fulfillment>("DINE_IN");
  const [tableId, setTableId] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [online, setOnline] = useState(true);

  useEffect(() => {
    setOnline(navigator.onLine);
    const on = () => setOnline(navigator.onLine);
    window.addEventListener("online", on);
    window.addEventListener("offline", on);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", on);
    };
  }, []);

  useEffect(() => {
    api.get<MenuCategoryDTO[]>("/menu").then((m) => {
      setMenu(m);
      setActiveCat(m[0]?.id ?? null);
    });
    api.get<{ locations: LocationCtx[] }>("/context").then((c) => setLoc(c.locations[0] ?? null));
  }, []);

  const tax = loc ?? { taxRateBps: 1000, taxInclusive: false };
  const t = useMemo(() => totals(cart, tax.taxRateBps, tax.taxInclusive), [cart, tax]);

  function addItem(item: { id: string; name: string; priceMinor: number; station: string; available: boolean }) {
    if (!item.available) return;
    setCart((c) => {
      const existing = c.find((l) => l.menuItemId === item.id);
      if (existing) return c.map((l) => (l.menuItemId === item.id ? { ...l, qty: l.qty + 1 } : l));
      return [...c, { lineId: uid(), menuItemId: item.id, name: item.name, unitPriceMinor: item.priceMinor, qty: 1, station: item.station }];
    });
  }
  const changeQty = (lineId: string, d: number) =>
    setCart((c) => c.map((l) => (l.lineId === lineId ? { ...l, qty: Math.max(0, l.qty + d) } : l)).filter((l) => l.qty > 0));

  function buildBaseEvents(orderId: string): OrderEventInput[] {
    const now = new Date().toISOString();
    const events: OrderEventInput[] = [
      {
        orderId,
        type: "ORDER_CREATED",
        payload: {
          locationId: loc!.id,
          channel: "POS",
          fulfillment,
          currency,
          tableId: tableId ?? undefined,
        },
        deviceTimestamp: now,
        idempotencyKey: `${orderId}:created`,
      },
    ];
    for (const l of cart) {
      events.push({
        orderId,
        type: "ITEM_ADDED",
        payload: { lineId: l.lineId, menuItemId: l.menuItemId, nameSnapshot: l.name, unitPriceMinor: l.unitPriceMinor, qty: l.qty, station: l.station },
        deviceTimestamp: now,
        idempotencyKey: `${orderId}:add:${l.lineId}`,
      });
    }
    return events;
  }

  async function sendToKitchen() {
    if (!cart.length || !loc) return;
    const orderId = uid();
    const events = buildBaseEvents(orderId);
    events.push({ orderId, type: "ORDER_CONFIRMED", payload: {}, deviceTimestamp: new Date().toISOString(), idempotencyKey: `${orderId}:confirmed` });
    await enqueueEvents(events, deviceId ?? undefined);
    setCart([]);
    setTableId(null);
    setToast("Sent to kitchen ✓");
    setTimeout(() => setToast(null), 2500);
  }

  async function payCash(tenderedMinor: number) {
    if (!loc) return;
    const orderId = uid();
    const change = tenderedMinor - t.totalMinor;
    const events = buildBaseEvents(orderId);
    const now = new Date().toISOString();
    events.push({ orderId, type: "ORDER_CONFIRMED", payload: {}, deviceTimestamp: now, idempotencyKey: `${orderId}:confirmed` });
    events.push({
      orderId,
      type: "PAYMENT_CAPTURED",
      payload: { rail: "CASH", amountMinor: t.totalMinor, tenderedMinor, changeMinor: change },
      deviceTimestamp: now,
      idempotencyKey: `${orderId}:pay`,
    });
    events.push({ orderId, type: "ORDER_CLOSED", payload: {}, deviceTimestamp: now, idempotencyKey: `${orderId}:closed` });
    await enqueueEvents(events, deviceId ?? undefined);
    setPaying(false);
    setCart([]);
    setTableId(null);
    setToast(change > 0 ? `Paid — change ${(change / 100).toFixed(2)}` : "Paid ✓");
    setTimeout(() => setToast(null), 3000);
  }

  async function payCard(rail: PaymentRail) {
    if (!loc) return;
    // Card/rail requires connectivity (SYNC-03) — create order online, add items, then charge.
    const order = await api.post<{ id: string }>("/orders", { channel: "POS", fulfillment, tableId: tableId ?? undefined });
    const events: OrderEventInput[] = cart.map((l) => ({
      orderId: order.id,
      type: "ITEM_ADDED",
      payload: { lineId: l.lineId, menuItemId: l.menuItemId, nameSnapshot: l.name, unitPriceMinor: l.unitPriceMinor, qty: l.qty, station: l.station },
      deviceTimestamp: new Date().toISOString(),
      idempotencyKey: `${order.id}:add:${l.lineId}`,
    }));
    await api.post(`/orders/${order.id}/events`, { events });
    await api.post(`/orders/${order.id}/pay`, { rail, amountMinor: t.totalMinor });
    await api.post(`/orders/${order.id}/status`, { status: "CLOSED" });
    setPaying(false);
    setCart([]);
    setTableId(null);
    setToast(`Paid via ${rail} ✓`);
    setTimeout(() => setToast(null), 3000);
  }

  const activeItems = menu.find((c) => c.id === activeCat)?.items ?? [];

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
      {/* Menu */}
      <div>
        <div className="mb-3 flex items-center gap-2">
          <h1 className="text-lg font-bold">Point of Sale</h1>
          {quick && <Badge tone="amber">Quick mode</Badge>}
          {!online && <Badge tone="rose">Offline — cash only</Badge>}
        </div>
        <div className="mb-3 flex flex-wrap gap-2">
          {menu.map((c) => (
            <button
              key={c.id}
              onClick={() => setActiveCat(c.id)}
              className={`tap rounded-full px-3 py-1.5 text-sm font-medium ${activeCat === c.id ? "bg-brand text-white" : "bg-white text-slate-600 border border-slate-200"}`}
            >
              {c.name}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {activeItems.map((it) => (
            <button
              key={it.id}
              onClick={() => addItem(it)}
              disabled={!it.available}
              className={`tap rounded-2xl border p-4 text-left ${it.available ? "border-slate-200 bg-white hover:border-brand" : "border-slate-100 bg-slate-50 opacity-50"}`}
            >
              <div className="font-semibold text-slate-800">{it.name}</div>
              <div className="mt-1 text-brand">
                <Money minor={it.priceMinor} currency={currency} />
              </div>
              {!it.available && <div className="mt-1 text-xs text-rose-500">86 — out of stock</div>}
            </button>
          ))}
        </div>
      </div>

      {/* Cart */}
      <Card className="flex h-fit flex-col p-4 lg:sticky lg:top-16">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-semibold">Order</h2>
          {!quick && capabilities?.features.tables && (
            <select
              className="rounded-lg border border-slate-200 px-2 py-1 text-sm"
              value={tableId ?? ""}
              onChange={(e) => setTableId(e.target.value || null)}
            >
              <option value="">No table</option>
              {loc?.tables.map((tb) => (
                <option key={tb.id} value={tb.id}>
                  {tb.label}
                </option>
              ))}
            </select>
          )}
        </div>

        {!quick && (
          <div className="mb-3 flex gap-1">
            {(["DINE_IN", "PICKUP"] as Fulfillment[]).map((f) => (
              <button
                key={f}
                onClick={() => setFulfillment(f)}
                className={`flex-1 rounded-lg px-2 py-1 text-xs font-medium ${fulfillment === f ? "bg-brand text-white" : "bg-slate-100 text-slate-600"}`}
              >
                {f === "DINE_IN" ? "Dine-in" : "Pickup"}
              </button>
            ))}
          </div>
        )}

        <div className="min-h-[120px] flex-1 divide-y divide-slate-100">
          {cart.length === 0 && <div className="py-8 text-center text-sm text-slate-400">Tap items to add them</div>}
          {cart.map((l) => (
            <div key={l.lineId} className="flex items-center gap-2 py-2">
              <div className="flex-1">
                <div className="text-sm font-medium">{l.name}</div>
                <div className="text-xs text-slate-400">
                  <Money minor={l.unitPriceMinor} currency={currency} />
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <button onClick={() => changeQty(l.lineId, -1)} className="tap h-7 w-7 rounded-full bg-slate-100 text-slate-600">−</button>
                <span className="w-6 text-center text-sm tabular-nums">{l.qty}</span>
                <button onClick={() => changeQty(l.lineId, 1)} className="tap h-7 w-7 rounded-full bg-slate-100 text-slate-600">+</button>
              </div>
              <div className="w-16 text-right text-sm font-medium">
                <Money minor={l.unitPriceMinor * l.qty} currency={currency} />
              </div>
            </div>
          ))}
        </div>

        <div className="mt-3 space-y-1 border-t border-slate-100 pt-3 text-sm">
          <Row label="Subtotal"><Money minor={t.subtotalMinor} currency={currency} /></Row>
          <Row label={tax.taxInclusive ? "incl. VAT" : "GST"}><Money minor={t.taxMinor} currency={currency} /></Row>
          <div className="flex justify-between pt-1 text-base font-bold">
            <span>Total</span>
            <Money minor={t.totalMinor} currency={currency} />
          </div>
        </div>

        <div className="mt-3 grid gap-2">
          <Button size="lg" disabled={!cart.length} onClick={() => setPaying(true)}>
            Take Payment
          </Button>
          {!quick && (
            <Button variant="secondary" disabled={!cart.length} onClick={sendToKitchen}>
              Send to Kitchen
            </Button>
          )}
        </div>
      </Card>

      {paying && (
        <PaymentModal
          currency={currency}
          totalMinor={t.totalMinor}
          online={online}
          rails={railsForCurrency(currency as "AUD" | "NPR")}
          onCash={payCash}
          onCard={payCard}
          onClose={() => setPaying(false)}
        />
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-20 -translate-x-1/2 rounded-full bg-slate-900 px-5 py-2.5 text-sm font-medium text-white shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between text-slate-500">
      <span>{label}</span>
      <span className="text-slate-700">{children}</span>
    </div>
  );
}

function PaymentModal({
  currency,
  totalMinor,
  online,
  rails,
  onCash,
  onCard,
  onClose,
}: {
  currency: string;
  totalMinor: number;
  online: boolean;
  rails: PaymentRail[];
  onCash: (tenderedMinor: number) => void;
  onCard: (rail: PaymentRail) => void;
  onClose: () => void;
}) {
  const [tendered, setTendered] = useState((totalMinor / 100).toFixed(2));
  const tenderedMinor = Math.round(parseFloat(tendered || "0") * 100);
  const change = tenderedMinor - totalMinor;
  const cardRails = rails.filter((r) => r !== "CASH");

  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/40 p-4 sm:items-center" onClick={onClose}>
      <Card className="w-full max-w-md p-5" >
        <div onClick={(e) => e.stopPropagation()}>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-lg font-bold">Take Payment</h3>
            <span className="text-lg font-bold">
              <Money minor={totalMinor} currency={currency} />
            </span>
          </div>

          <div className="rounded-xl bg-slate-50 p-4">
            <div className="mb-2 text-sm font-medium text-slate-600">Cash</div>
            <div className="flex items-center gap-2">
              <input
                inputMode="decimal"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-lg"
                value={tendered}
                onChange={(e) => setTendered(e.target.value)}
              />
              <div className="whitespace-nowrap text-sm text-slate-500">
                change {change >= 0 ? (change / 100).toFixed(2) : "—"}
              </div>
            </div>
            <Button size="lg" className="mt-3 w-full" disabled={tenderedMinor < totalMinor} onClick={() => onCash(tenderedMinor)}>
              Charge Cash
            </Button>
          </div>

          {cardRails.length > 0 && (
            <div className="mt-3">
              <div className="mb-2 text-sm font-medium text-slate-600">Card / digital {!online && <span className="text-rose-500">(unavailable offline)</span>}</div>
              <div className="grid grid-cols-2 gap-2">
                {cardRails.map((r) => (
                  <Button key={r} variant="secondary" disabled={!online} onClick={() => onCard(r)}>
                    {r}
                  </Button>
                ))}
              </div>
            </div>
          )}

          <button onClick={onClose} className="mt-4 w-full text-sm text-slate-400 hover:text-slate-600">
            Cancel
          </button>
        </div>
      </Card>
    </div>
  );
}
