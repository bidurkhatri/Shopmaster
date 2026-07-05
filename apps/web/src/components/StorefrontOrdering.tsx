"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { Button, Card, Money, Badge, BrandStyle } from "@/components/ui";
import { lineTotal, uid } from "@/lib/pricing";
import { railsForCurrency, type MenuCategoryDTO, type OrganizationDTO, type OrderDTO, type OrderEventInput, type Fulfillment, type Currency } from "@shopmaster/shared";

interface CartLine {
  lineId: string;
  menuItemId: string;
  name: string;
  unitPriceMinor: number;
  qty: number;
  station: string;
}

export function StorefrontOrdering({
  org,
  menu,
  mode,
  qrToken,
  tableLabel,
}: {
  org: OrganizationDTO;
  menu: MenuCategoryDTO[];
  mode: "qr" | "online";
  qrToken?: string;
  tableLabel?: string;
}) {
  const currency = org.currency;
  const [cart, setCart] = useState<CartLine[]>([]);
  const [fulfillment, setFulfillment] = useState<Fulfillment>(mode === "qr" ? "DINE_IN" : "PICKUP");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [placing, setPlacing] = useState(false);
  const [placed, setPlaced] = useState<OrderDTO | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const subtotal = useMemo(() => cart.reduce((s, l) => s + lineTotal(l), 0), [cart]);
  const rail = railsForCurrency(currency as Currency).find((r) => r !== "CASH") ?? "CASH";

  function add(it: { id: string; name: string; priceMinor: number; station: string; available: boolean }) {
    if (!it.available) return;
    setCart((c) => {
      const ex = c.find((l) => l.menuItemId === it.id);
      if (ex) return c.map((l) => (l.menuItemId === it.id ? { ...l, qty: l.qty + 1 } : l));
      return [...c, { lineId: uid(), menuItemId: it.id, name: it.name, unitPriceMinor: it.priceMinor, qty: 1, station: it.station }];
    });
  }
  const changeQty = (id: string, d: number) =>
    setCart((c) => c.map((l) => (l.lineId === id ? { ...l, qty: Math.max(0, l.qty + d) } : l)).filter((l) => l.qty > 0));

  async function place() {
    if (!cart.length) return;
    setPlacing(true);
    try {
      const order = await api.post<OrderDTO>(
        "/public/orders",
        {
          qrToken: mode === "qr" ? qrToken : undefined,
          orgSlug: mode === "online" ? org.slug : undefined,
          fulfillment,
          customerName: name || undefined,
          customerPhone: phone || undefined,
          deliveryAddress: fulfillment === "DELIVERY" ? address : undefined,
        },
        false,
      );
      const now = new Date().toISOString();
      const events: OrderEventInput[] = cart.map((l) => ({
        orderId: order.id,
        type: "ITEM_ADDED",
        payload: { lineId: l.lineId, menuItemId: l.menuItemId, nameSnapshot: l.name, unitPriceMinor: l.unitPriceMinor, qty: l.qty, station: l.station },
        deviceTimestamp: now,
        idempotencyKey: `${order.id}:add:${l.lineId}`,
      }));
      events.push({ orderId: order.id, type: "ORDER_CONFIRMED", payload: {}, deviceTimestamp: now, idempotencyKey: `${order.id}:confirmed` });
      const res = await api.post<{ order: OrderDTO }>(`/public/orders/${order.id}/events`, { events }, false);

      let finalOrder = res.order;
      if (mode === "online") {
        const paid = await api.post<{ order: OrderDTO }>(`/public/orders/${order.id}/pay`, { rail, amountMinor: res.order.totalMinor }, false);
        finalOrder = paid.order;
      }
      setPlaced(finalOrder);
    } catch (e) {
      setNote((e as Error).message || "Could not place order");
    } finally {
      setPlacing(false);
    }
  }

  if (placed) {
    return (
      <div className="mx-auto max-w-md px-4 py-10">
        <BrandStyle primary={org.branding?.primaryColor} accent={org.branding?.accentColor} />
        <Card className="p-6 text-center">
          <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-full bg-emerald-100 text-2xl">✓</div>
          <h1 className="text-xl font-bold">Order placed</h1>
          <p className="mt-1 text-sm text-slate-500">
            {mode === "qr" ? "Sent to the kitchen. " : "Payment received. "}
            {tableLabel ? `Table ${tableLabel}.` : fulfillment === "PICKUP" ? "We'll have it ready for pickup." : fulfillment === "DELIVERY" ? "On its way to you." : ""}
          </p>
          <div className="my-4 space-y-1 rounded-xl bg-slate-50 p-4 text-left text-sm">
            {placed.items.map((i) => (
              <div key={i.id} className="flex justify-between">
                <span>{i.qty}× {i.nameSnapshot}</span>
                <Money minor={i.lineTotalMinor} currency={currency} />
              </div>
            ))}
            <div className="flex justify-between border-t border-slate-200 pt-2 font-bold">
              <span>Total</span>
              <Money minor={placed.totalMinor} currency={currency} />
            </div>
          </div>
          <Link href={`/order/${placed.id}`} className="text-sm font-medium text-brand">
            Track this order →
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 pb-40 pt-6">
      <BrandStyle primary={org.branding?.primaryColor} accent={org.branding?.accentColor} />
      <header className="mb-4">
        <div className="flex items-center gap-2">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand text-white">
            {org.branding?.logoText?.[0] ?? org.name[0]}
          </span>
          <div>
            <h1 className="text-xl font-bold">{org.name}</h1>
            <div className="flex items-center gap-2 text-sm text-slate-500">
              {mode === "qr" ? <Badge tone="blue">Table {tableLabel ?? qrToken}</Badge> : <Badge tone="green">Online ordering</Badge>}
            </div>
          </div>
        </div>
      </header>

      {mode === "online" && (
        <div className="mb-4 flex gap-2">
          {(["PICKUP", "DELIVERY"] as Fulfillment[]).map((f) => (
            <button
              key={f}
              onClick={() => setFulfillment(f)}
              className={`flex-1 rounded-xl px-3 py-2 text-sm font-medium ${fulfillment === f ? "bg-brand text-white" : "bg-white text-slate-600 border border-slate-200"}`}
            >
              {f === "PICKUP" ? "Pickup" : "Delivery"}
            </button>
          ))}
        </div>
      )}

      {menu.map((cat) => (
        <section key={cat.id} className="mb-5">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">{cat.name}</h2>
          <div className="space-y-2">
            {cat.items.map((it) => (
              <button
                key={it.id}
                onClick={() => add(it)}
                disabled={!it.available}
                className={`tap flex w-full items-center justify-between rounded-xl border p-3 text-left ${it.available ? "border-slate-200 bg-white hover:border-brand" : "border-slate-100 bg-slate-50 opacity-50"}`}
              >
                <div>
                  <div className="font-medium text-slate-800">{it.name}</div>
                  {it.description && <div className="text-xs text-slate-400">{it.description}</div>}
                  {!it.available && <div className="text-xs text-rose-500">Sold out</div>}
                </div>
                <div className="font-semibold text-brand">
                  <Money minor={it.priceMinor} currency={currency} />
                </div>
              </button>
            ))}
          </div>
        </section>
      ))}

      {note && <div className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{note}</div>}

      {/* Sticky cart bar */}
      {cart.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white p-4 shadow-lg">
          <div className="mx-auto max-w-2xl">
            <div className="mb-2 max-h-32 space-y-1 overflow-auto">
              {cart.map((l) => (
                <div key={l.lineId} className="flex items-center gap-2 text-sm">
                  <span className="flex-1">{l.name}</span>
                  <button onClick={() => changeQty(l.lineId, -1)} className="tap h-6 w-6 rounded-full bg-slate-100">−</button>
                  <span className="w-5 text-center tabular-nums">{l.qty}</span>
                  <button onClick={() => changeQty(l.lineId, 1)} className="tap h-6 w-6 rounded-full bg-slate-100">+</button>
                  <span className="w-16 text-right"><Money minor={l.unitPriceMinor * l.qty} currency={currency} /></span>
                </div>
              ))}
            </div>
            {mode === "online" && (
              <div className="mb-2 grid grid-cols-2 gap-2">
                <input placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm" />
                <input placeholder="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm" />
                {fulfillment === "DELIVERY" && (
                  <input placeholder="Delivery address" value={address} onChange={(e) => setAddress(e.target.value)} className="col-span-2 rounded-lg border border-slate-200 px-3 py-2 text-sm" />
                )}
              </div>
            )}
            <Button size="lg" className="w-full" disabled={placing} onClick={place}>
              {placing ? "Placing…" : mode === "qr" ? "Place order" : "Place & pay"} · <Money minor={subtotal} currency={currency} />
              {mode === "online" ? " + tax" : ""}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
