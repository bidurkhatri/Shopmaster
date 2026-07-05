"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/store";
import { Button, Money, BrandStyle } from "@/components/ui";
import { enqueueEvents } from "@/lib/outbox";
import { lineTotal, uid } from "@/lib/pricing";
import type { MenuCategoryDTO, OrderEventInput } from "@shopmaster/shared";

interface Line {
  lineId: string;
  menuItemId: string;
  name: string;
  unitPriceMinor: number;
  qty: number;
  station: string;
}

/** Self-service kiosk (KIOSK-01..06): locked, guided, big touch targets. Pay at counter fallback. */
export default function KioskPage() {
  const router = useRouter();
  const { token, organization, deviceId } = useAuth();
  const currency = organization?.currency ?? "AUD";
  const [menu, setMenu] = useState<MenuCategoryDTO[]>([]);
  const [locId, setLocId] = useState<string | null>(null);
  const [cart, setCart] = useState<Line[]>([]);
  const [started, setStarted] = useState(false);
  const [placedNo, setPlacedNo] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      router.replace("/login");
      return;
    }
    api.get<MenuCategoryDTO[]>("/menu").then(setMenu);
    api.get<{ locations: { id: string }[] }>("/context").then((c) => setLocId(c.locations[0]?.id ?? null));
  }, [token, router]);

  const subtotal = useMemo(() => cart.reduce((s, l) => s + lineTotal(l), 0), [cart]);

  function add(it: { id: string; name: string; priceMinor: number; station: string; available: boolean }) {
    if (!it.available) return;
    setCart((c) => {
      const ex = c.find((l) => l.menuItemId === it.id);
      if (ex) return c.map((l) => (l.menuItemId === it.id ? { ...l, qty: l.qty + 1 } : l));
      return [...c, { lineId: uid(), menuItemId: it.id, name: it.name, unitPriceMinor: it.priceMinor, qty: 1, station: it.station }];
    });
  }

  async function place() {
    if (!cart.length || !locId) return;
    const orderId = uid();
    const now = new Date().toISOString();
    const events: OrderEventInput[] = [
      { orderId, type: "ORDER_CREATED", payload: { locationId: locId, channel: "KIOSK", fulfillment: "PICKUP", currency }, deviceTimestamp: now, idempotencyKey: `${orderId}:created` },
      ...cart.map((l) => ({
        orderId,
        type: "ITEM_ADDED" as const,
        payload: { lineId: l.lineId, menuItemId: l.menuItemId, nameSnapshot: l.name, unitPriceMinor: l.unitPriceMinor, qty: l.qty, station: l.station },
        deviceTimestamp: now,
        idempotencyKey: `${orderId}:add:${l.lineId}`,
      })),
      { orderId, type: "ORDER_CONFIRMED", payload: {}, deviceTimestamp: now, idempotencyKey: `${orderId}:confirmed` },
    ];
    await enqueueEvents(events, deviceId ?? undefined);
    setPlacedNo(orderId.slice(-4).toUpperCase());
    setCart([]);
    setTimeout(() => {
      setPlacedNo(null);
      setStarted(false);
    }, 5000);
  }

  if (placedNo) {
    return (
      <Full>
        <div className="text-center">
          <div className="mx-auto mb-4 grid h-20 w-20 place-items-center rounded-full bg-emerald-100 text-4xl">✓</div>
          <h1 className="text-3xl font-bold">Order placed</h1>
          <p className="mt-2 text-lg text-slate-500">Your number is</p>
          <div className="my-3 text-6xl font-black text-brand">{placedNo}</div>
          <p className="text-slate-500">Please pay at the counter.</p>
        </div>
      </Full>
    );
  }

  if (!started) {
    return (
      <Full>
        <BrandStyle primary={organization?.branding?.primaryColor} accent={organization?.branding?.accentColor} />
        <button onClick={() => setStarted(true)} className="tap text-center">
          <div className="mx-auto mb-6 grid h-24 w-24 place-items-center rounded-3xl bg-brand text-4xl text-white">🍽️</div>
          <h1 className="text-4xl font-black">{organization?.name}</h1>
          <p className="mt-3 rounded-full bg-brand px-8 py-4 text-xl font-semibold text-white">Tap to order</p>
        </button>
      </Full>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-28">
      <BrandStyle primary={organization?.branding?.primaryColor} accent={organization?.branding?.accentColor} />
      <header className="sticky top-0 z-10 bg-brand px-6 py-4 text-white">
        <h1 className="text-xl font-bold">{organization?.name} · Self-order</h1>
      </header>
      <div className="mx-auto max-w-4xl p-4">
        {menu.map((c) => (
          <section key={c.id} className="mb-6">
            <h2 className="mb-3 text-lg font-bold">{c.name}</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {c.items.map((it) => (
                <button key={it.id} onClick={() => add(it)} disabled={!it.available} className={`tap rounded-2xl border-2 p-5 text-left ${it.available ? "border-slate-200 bg-white" : "border-slate-100 bg-slate-50 opacity-50"}`}>
                  <div className="text-lg font-bold">{it.name}</div>
                  <div className="mt-1 text-brand"><Money minor={it.priceMinor} currency={currency} /></div>
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>
      {cart.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 border-t bg-white p-4">
          <div className="mx-auto flex max-w-4xl items-center gap-4">
            <div className="flex-1 text-sm text-slate-600">{cart.reduce((s, l) => s + l.qty, 0)} items · <Money minor={subtotal} currency={currency} /> + tax</div>
            <Button size="lg" onClick={place}>Place order</Button>
          </div>
        </div>
      )}
    </div>
  );
}

function Full({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">{children}</div>;
}
