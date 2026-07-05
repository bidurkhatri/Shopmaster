"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { Button, Card, Money, Badge, BrandStyle, Modal, Skeleton, useToast } from "@/components/ui";
import { IconPlus, IconMinus, IconCheck, IconArrowRight, IconCart, IconSparkle } from "@/components/icons";
import { Receipt } from "@/components/Receipt";
import { lineTotal, uid } from "@/lib/pricing";
import {
  railsForCurrency,
  type MenuCategoryDTO,
  type MenuItemDTO,
  type OrganizationDTO,
  type OrderDTO,
  type OrderEventInput,
  type Fulfillment,
  type Currency,
} from "@shopmaster/shared";

interface SelectedModifier {
  name: string;
  priceDeltaMinor: number;
}

interface CartLine {
  lineId: string;
  menuItemId: string;
  name: string;
  unitPriceMinor: number;
  qty: number;
  station: string;
  modifiers: SelectedModifier[];
}

export function StorefrontOrdering({
  org,
  menu,
  mode,
  qrToken,
  tableLabel,
  loyaltyEnabled = false,
}: {
  org: OrganizationDTO;
  menu: MenuCategoryDTO[];
  mode: "qr" | "online";
  qrToken?: string;
  tableLabel?: string;
  loyaltyEnabled?: boolean;
}) {
  const currency = org.currency;
  const toast = useToast();
  const [cart, setCart] = useState<CartLine[]>([]);
  const [fulfillment, setFulfillment] = useState<Fulfillment>(mode === "qr" ? "DINE_IN" : "PICKUP");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [loyaltyOptIn, setLoyaltyOptIn] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [placed, setPlaced] = useState<OrderDTO | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [modItem, setModItem] = useState<MenuItemDTO | null>(null);

  const subtotal = useMemo(() => cart.reduce((s, l) => s + lineTotal(l), 0), [cart]);
  const cartCount = useMemo(() => cart.reduce((s, l) => s + l.qty, 0), [cart]);
  const rail = railsForCurrency(currency as Currency).find((r) => r !== "CASH") ?? "CASH";

  function addBase(it: MenuItemDTO) {
    if (!it.available) return;
    setCart((c) => {
      const ex = c.find((l) => l.menuItemId === it.id && l.modifiers.length === 0);
      if (ex) return c.map((l) => (l === ex ? { ...l, qty: l.qty + 1 } : l));
      return [...c, { lineId: uid(), menuItemId: it.id, name: it.name, unitPriceMinor: it.priceMinor, qty: 1, station: it.station, modifiers: [] }];
    });
    toast({ title: `Added ${it.name}`, tone: "success" });
  }

  function addCustom(it: MenuItemDTO, modifiers: SelectedModifier[]) {
    setCart((c) => [
      ...c,
      { lineId: uid(), menuItemId: it.id, name: it.name, unitPriceMinor: it.priceMinor, qty: 1, station: it.station, modifiers },
    ]);
    setModItem(null);
    toast({ title: `Added ${it.name}`, tone: "success" });
  }

  const changeQty = (id: string, d: number) =>
    setCart((c) => c.map((l) => (l.lineId === id ? { ...l, qty: Math.max(0, l.qty + d) } : l)).filter((l) => l.qty > 0));

  async function place() {
    if (!cart.length) return;
    setPlacing(true);
    setNote(null);
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
          loyaltyOptIn: loyaltyOptIn && !!phone,
        },
        false,
      );
      const now = new Date().toISOString();
      const events: OrderEventInput[] = cart.map((l) => ({
        orderId: order.id,
        type: "ITEM_ADDED",
        payload: {
          lineId: l.lineId,
          menuItemId: l.menuItemId,
          nameSnapshot: l.name,
          unitPriceMinor: l.unitPriceMinor,
          qty: l.qty,
          station: l.station,
          modifiers: l.modifiers.length ? l.modifiers : undefined,
        },
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

  /* --------------------------------------------------------------- confirmation */

  if (placed) {
    const detail =
      mode === "qr" ? "Sent to the kitchen." : fulfillment === "DELIVERY" ? "On its way to you." : "We'll have it ready for pickup.";
    return (
      <div className="mx-auto max-w-md px-4 py-10">
        <BrandStyle primary={org.branding?.primaryColor} accent={org.branding?.accentColor} />
        <div className="mb-5 text-center">
          <div className="mx-auto mb-3 grid h-16 w-16 place-items-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
            <IconCheck className="h-8 w-8" />
          </div>
          <h1 className="text-2xl font-bold text-ink">Order placed</h1>
          <p className="mt-1 text-sm text-muted">
            {mode === "qr" ? "" : "Payment received. "}
            {tableLabel ? `Table ${tableLabel}. ` : ""}
            {detail}
          </p>
        </div>

        <Receipt order={placed} storeName={org.name} tableLabel={tableLabel ?? placed.tableLabel} />

        <div className="mt-5 text-center">
          <Link href={`/order/${placed.id}`} className="inline-flex items-center gap-1 text-sm font-semibold text-brand hover:underline">
            Track this order <IconArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    );
  }

  /* --------------------------------------------------------------- ordering */

  return (
    <div className="min-h-screen bg-bg">
      <BrandStyle primary={org.branding?.primaryColor} accent={org.branding?.accentColor} />
      <div className="mx-auto max-w-2xl px-4 pb-44 pt-6">
        {/* Header */}
        <header className="mb-5 flex items-center gap-3">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-brand text-lg font-bold text-white shadow-soft">
            {org.branding?.logoText?.[0] ?? org.name[0]}
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-bold tracking-tight text-ink">{org.name}</h1>
            <div className="mt-0.5">
              {mode === "qr" ? (
                <Badge tone="blue">Table {tableLabel ?? qrToken}</Badge>
              ) : (
                <Badge tone="green">Online ordering</Badge>
              )}
            </div>
          </div>
        </header>

        {mode === "online" && (
          <div className="mb-5 grid grid-cols-2 gap-2 rounded-2xl border border-line bg-surface p-1.5 shadow-soft">
            {(["PICKUP", "DELIVERY"] as Fulfillment[]).map((f) => (
              <button
                key={f}
                onClick={() => setFulfillment(f)}
                className={`tap rounded-xl px-3 py-2.5 text-sm font-semibold ${
                  fulfillment === f ? "bg-brand text-white shadow-soft" : "text-muted hover:text-ink"
                }`}
              >
                {f === "PICKUP" ? "Pickup" : "Delivery"}
              </button>
            ))}
          </div>
        )}

        {/* Menu */}
        {menu.map((cat) => (
          <section key={cat.id} className="mb-7">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">{cat.name}</h2>
            <div className="space-y-2.5">
              {cat.items.map((it) => {
                const hasMods = it.modifiers.length > 0 && it.available;
                return (
                  <Card key={it.id} className="flex items-stretch overflow-hidden">
                    <button
                      data-testid="menu-item"
                      onClick={() => addBase(it)}
                      disabled={!it.available}
                      className={`tap flex flex-1 items-center justify-between gap-3 p-4 text-left ${
                        it.available ? "hover:bg-surface-2" : "cursor-not-allowed opacity-55"
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="font-semibold text-ink">{it.name}</div>
                        {it.description && <div className="mt-0.5 line-clamp-2 text-xs text-muted">{it.description}</div>}
                        <div className="mt-1 flex items-center gap-2">
                          {!it.available && <span className="text-xs font-medium text-rose-500">Sold out</span>}
                          {hasMods && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-brand">
                              <IconSparkle className="h-3 w-3" /> Customizable
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="shrink-0 font-semibold text-brand">
                        <Money minor={it.priceMinor} currency={currency} />
                      </div>
                    </button>
                    {hasMods && (
                      <button
                        onClick={() => setModItem(it)}
                        aria-label={`Customize ${it.name}`}
                        className="tap grid w-14 shrink-0 place-items-center border-l border-line text-brand hover:bg-brand/10"
                      >
                        <IconPlus className="h-5 w-5" />
                      </button>
                    )}
                  </Card>
                );
              })}
            </div>
          </section>
        ))}

        {note && (
          <div className="mb-3 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2.5 text-sm text-rose-600 dark:text-rose-400">
            {note}
          </div>
        )}
      </div>

      {/* Sticky cart bar */}
      {cart.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface shadow-lift">
          <div className="mx-auto max-w-2xl p-4">
            <div className="mb-3 max-h-40 space-y-2 overflow-auto">
              {cart.map((l) => (
                <div key={l.lineId} className="flex items-center gap-3 text-sm">
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium text-ink">{l.name}</div>
                    {l.modifiers.length > 0 && (
                      <div className="truncate text-xs text-muted">{l.modifiers.map((m) => m.name).join(", ")}</div>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <button
                      onClick={() => changeQty(l.lineId, -1)}
                      aria-label="Decrease quantity"
                      className="tap grid h-7 w-7 place-items-center rounded-full bg-surface-2 text-ink hover:bg-line"
                    >
                      <IconMinus className="h-4 w-4" />
                    </button>
                    <span className="w-5 text-center tabular-nums font-medium text-ink">{l.qty}</span>
                    <button
                      onClick={() => changeQty(l.lineId, 1)}
                      aria-label="Increase quantity"
                      className="tap grid h-7 w-7 place-items-center rounded-full bg-surface-2 text-ink hover:bg-line"
                    >
                      <IconPlus className="h-4 w-4" />
                    </button>
                  </div>
                  <span className="w-16 shrink-0 text-right tabular-nums text-ink">
                    <Money minor={lineTotal(l)} currency={currency} />
                  </span>
                </div>
              ))}
            </div>

            {mode === "online" && (
              <div className="mb-3 grid grid-cols-2 gap-2">
                <input
                  placeholder="Your name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="rounded-xl border border-line bg-surface px-3 py-2.5 text-sm text-ink placeholder:text-muted focus:border-brand focus-visible:outline-none"
                />
                <input
                  placeholder="Phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="rounded-xl border border-line bg-surface px-3 py-2.5 text-sm text-ink placeholder:text-muted focus:border-brand focus-visible:outline-none"
                />
                {fulfillment === "DELIVERY" && (
                  <input
                    placeholder="Delivery address"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="col-span-2 rounded-xl border border-line bg-surface px-3 py-2.5 text-sm text-ink placeholder:text-muted focus:border-brand focus-visible:outline-none"
                  />
                )}
                {loyaltyEnabled && (
                  <label className="col-span-2 flex cursor-pointer items-center gap-2.5 rounded-xl border border-line bg-surface px-3 py-2.5 text-sm text-ink">
                    <input
                      type="checkbox"
                      checked={loyaltyOptIn}
                      onChange={(e) => setLoyaltyOptIn(e.target.checked)}
                      className="h-4 w-4 accent-[var(--brand)]"
                    />
                    <span className="flex items-center gap-1.5">
                      <IconSparkle className="h-3.5 w-3.5 text-brand" />
                      Join rewards — earn points on every order
                    </span>
                  </label>
                )}
              </div>
            )}

            <Button size="lg" className="w-full" loading={placing} disabled={placing} onClick={place} icon={!placing && <IconCart className="h-5 w-5" />}>
              {placing ? "Placing…" : mode === "qr" ? "Place order" : "Place & pay"}
              <span className="opacity-80">·</span>
              <span className="tabular-nums">
                <Money minor={subtotal} currency={currency} />
              </span>
              {mode === "online" ? <span className="opacity-80">+ tax</span> : null}
              <span className="ml-1 rounded-full bg-white/20 px-2 py-0.5 text-xs">{cartCount}</span>
            </Button>
          </div>
        </div>
      )}

      {/* Modifier picker */}
      {modItem && <ModifierPicker item={modItem} currency={currency} onClose={() => setModItem(null)} onAdd={(mods) => addCustom(modItem, mods)} />}
    </div>
  );
}

/* ------------------------------------------------------------------ loading skeleton */

export function StorefrontSkeleton({ mode = "qr" }: { mode?: "qr" | "online" }) {
  return (
    <div className="min-h-screen bg-bg">
      <div className="mx-auto max-w-2xl px-4 pt-6">
        <header className="mb-5 flex items-center gap-3">
          <Skeleton className="h-12 w-12 rounded-2xl" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-24" />
          </div>
        </header>
        {mode === "online" && <Skeleton className="mb-5 h-14 w-full rounded-2xl" />}
        {[0, 1].map((s) => (
          <section key={s} className="mb-7">
            <Skeleton className="mb-3 h-3 w-24" />
            <div className="space-y-2.5">
              {[0, 1, 2].map((i) => (
                <Card key={i} className="flex items-center justify-between p-4">
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-3 w-56" />
                  </div>
                  <Skeleton className="h-4 w-12" />
                </Card>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ modifier picker */

function ModifierPicker({
  item,
  currency,
  onClose,
  onAdd,
}: {
  item: MenuItemDTO;
  currency: Currency | string;
  onClose: () => void;
  onAdd: (mods: SelectedModifier[]) => void;
}) {
  const [selected, setSelected] = useState<Record<string, boolean>>({});

  const groups = useMemo(() => {
    const map = new Map<string, typeof item.modifiers>();
    for (const m of item.modifiers) {
      const arr = map.get(m.groupName) ?? [];
      arr.push(m);
      map.set(m.groupName, arr);
    }
    return [...map.entries()];
  }, [item]);

  const chosen = item.modifiers.filter((m) => selected[m.id]);
  const total = item.priceMinor + chosen.reduce((s, m) => s + m.priceDeltaMinor, 0);
  const toggle = (id: string) => setSelected((s) => ({ ...s, [id]: !s[id] }));

  return (
    <Modal
      open
      onClose={onClose}
      title={item.name}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => onAdd(chosen.map((m) => ({ name: m.name, priceDeltaMinor: m.priceDeltaMinor })))} icon={<IconPlus className="h-4 w-4" />}>
            Add
            <span className="opacity-80">·</span>
            <span className="tabular-nums">
              <Money minor={total} currency={currency} />
            </span>
          </Button>
        </>
      }
    >
      {item.description && <p className="mb-4 text-sm text-muted">{item.description}</p>}
      <div className="space-y-5">
        {groups.map(([groupName, mods]) => (
          <div key={groupName}>
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">{groupName}</div>
            <div className="space-y-2">
              {mods.map((m) => {
                const on = !!selected[m.id];
                return (
                  <button
                    key={m.id}
                    onClick={() => toggle(m.id)}
                    className={`tap flex w-full items-center justify-between gap-3 rounded-xl border p-3 text-left ${
                      on ? "border-brand bg-brand/10" : "border-line bg-surface hover:bg-surface-2"
                    }`}
                  >
                    <span className="flex items-center gap-2.5">
                      <span
                        className={`grid h-5 w-5 place-items-center rounded-md border ${
                          on ? "border-brand bg-brand text-white" : "border-line text-transparent"
                        }`}
                      >
                        <IconCheck className="h-3.5 w-3.5" />
                      </span>
                      <span className="font-medium text-ink">{m.name}</span>
                    </span>
                    <span className="shrink-0 text-sm font-medium text-muted">
                      {m.priceDeltaMinor > 0 ? "+" : ""}
                      <Money minor={m.priceDeltaMinor} currency={currency} />
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </Modal>
  );
}
