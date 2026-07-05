"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/store";
import { useHydrated } from "@/lib/useHydrated";
import { Button, Money, BrandStyle, Skeleton } from "@/components/ui";
import { IconCheck, IconStore, IconCart, IconArrowRight } from "@/components/icons";
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
  const hydrated = useHydrated();
  const { token, organization, deviceId } = useAuth();
  const currency = organization?.currency ?? "AUD";
  const [menu, setMenu] = useState<MenuCategoryDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [locId, setLocId] = useState<string | null>(null);
  const [cart, setCart] = useState<Line[]>([]);
  const [started, setStarted] = useState(false);
  const [placedNo, setPlacedNo] = useState<string | null>(null);

  useEffect(() => {
    if (!hydrated) return;
    if (!token) {
      router.replace("/login");
      return;
    }
    api
      .get<MenuCategoryDTO[]>("/menu")
      .then(setMenu)
      .finally(() => setLoading(false));
    api.get<{ locations: { id: string }[] }>("/context").then((c) => setLocId(c.locations[0]?.id ?? null));
  }, [hydrated, token, router]);

  const subtotal = useMemo(() => cart.reduce((s, l) => s + lineTotal(l), 0), [cart]);
  const cartCount = useMemo(() => cart.reduce((s, l) => s + l.qty, 0), [cart]);

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

  /* --------------------------------------------------------------- order placed */

  if (placedNo) {
    return (
      <Full>
        <div className="animate-rise text-center">
          <div className="mx-auto mb-6 grid h-24 w-24 place-items-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
            <IconCheck className="h-12 w-12" />
          </div>
          <h1 className="text-4xl font-bold text-ink">Order placed</h1>
          <p className="mt-3 text-lg text-muted">Your order number is</p>
          <div className="my-4 text-7xl font-black tracking-tight text-brand">{placedNo}</div>
          <p className="text-muted">Please pay at the counter.</p>
        </div>
      </Full>
    );
  }

  /* --------------------------------------------------------------- attract screen */

  if (!started) {
    return (
      <Full>
        <BrandStyle primary={organization?.branding?.primaryColor} accent={organization?.branding?.accentColor} />
        <button onClick={() => setStarted(true)} className="tap group flex flex-col items-center text-center">
          <div className="mb-8 grid h-28 w-28 place-items-center rounded-3xl bg-brand text-white shadow-lift transition-transform group-hover:scale-105">
            <IconStore className="h-14 w-14" />
          </div>
          <h1 className="text-5xl font-black tracking-tight text-ink">{organization?.name ?? "Self-order"}</h1>
          <p className="mt-4 text-lg text-muted">Order and pay in seconds</p>
          <span className="mt-8 inline-flex items-center gap-2 rounded-full bg-brand px-10 py-5 text-xl font-semibold text-white shadow-soft">
            Tap to order <IconArrowRight className="h-6 w-6" />
          </span>
        </button>
      </Full>
    );
  }

  /* --------------------------------------------------------------- ordering */

  return (
    <div className="min-h-screen bg-bg pb-28">
      <BrandStyle primary={organization?.branding?.primaryColor} accent={organization?.branding?.accentColor} />
      <header className="sticky top-0 z-10 flex items-center gap-3 bg-brand px-6 py-4 text-white shadow-soft">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-white/20">
          <IconStore className="h-5 w-5" />
        </span>
        <h1 className="text-xl font-bold">{organization?.name} · Self-order</h1>
      </header>

      <div className="mx-auto max-w-4xl p-4">
        {loading ? (
          <div className="space-y-8">
            {[0, 1].map((s) => (
              <section key={s}>
                <Skeleton className="mb-3 h-6 w-40" />
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {[0, 1, 2, 3, 4, 5].map((i) => (
                    <Skeleton key={i} className="h-28 rounded-2xl" />
                  ))}
                </div>
              </section>
            ))}
          </div>
        ) : (
          menu.map((c) => (
            <section key={c.id} className="mb-8">
              <h2 className="mb-3 text-lg font-bold text-ink">{c.name}</h2>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {c.items.map((it) => (
                  <button
                    key={it.id}
                    data-testid="menu-item"
                    onClick={() => add(it)}
                    disabled={!it.available}
                    className={`tap flex min-h-28 flex-col justify-between rounded-2xl border p-5 text-left shadow-soft ${
                      it.available ? "border-line bg-surface hover:border-brand" : "cursor-not-allowed border-line bg-surface-2 opacity-55"
                    }`}
                  >
                    <div className="text-lg font-bold text-ink">{it.name}</div>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="font-semibold text-brand">
                        <Money minor={it.priceMinor} currency={currency} />
                      </span>
                      {!it.available && <span className="text-xs font-medium text-rose-500">Sold out</span>}
                    </div>
                  </button>
                ))}
              </div>
            </section>
          ))
        )}
      </div>

      {cart.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface shadow-lift">
          <div className="mx-auto flex max-w-4xl items-center gap-4 p-4">
            <div className="flex items-center gap-2 text-sm font-medium text-ink">
              <span className="grid h-9 w-9 place-items-center rounded-full bg-brand/10 text-brand">
                <IconCart className="h-5 w-5" />
              </span>
              <span>
                {cartCount} {cartCount === 1 ? "item" : "items"} · <Money minor={subtotal} currency={currency} /> <span className="text-muted">+ tax</span>
              </span>
            </div>
            <Button size="lg" className="ml-auto" onClick={place} icon={<IconCheck className="h-5 w-5" />}>
              Place order
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function Full({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-screen items-center justify-center bg-bg p-6">{children}</div>;
}
