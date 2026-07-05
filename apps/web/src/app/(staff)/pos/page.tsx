"use client";
import { useEffect, useMemo, useState } from "react";
import { StaffShell } from "@/components/StaffShell";
import { Button, Card, Money, Badge, Modal, Skeleton, EmptyState, Select, IconButton, useToast } from "@/components/ui";
import {
  IconCart,
  IconPlus,
  IconMinus,
  IconTrash,
  IconWifiOff,
  IconBolt,
  IconCheck,
  IconClose,
  IconCash,
  IconCard,
  IconReceipt,
} from "@/components/icons";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/store";
import { enqueueEvents } from "@/lib/outbox";
import { totals, lineTotal, uid } from "@/lib/pricing";
import {
  railsForCurrency,
  type MenuCategoryDTO,
  type MenuItemDTO,
  type PaymentRail,
  type OrderEventInput,
  type Fulfillment,
} from "@shopmaster/shared";

interface LocationCtx {
  id: string;
  currency: string;
  taxRateBps: number;
  taxInclusive: boolean;
  tables: { id: string; label: string; qrToken: string }[];
}
interface LineMod {
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
  modifiers: LineMod[];
}
type DiscKind = "pct" | "amt";

export default function PosPage() {
  return (
    <StaffShell>
      <Pos />
    </StaffShell>
  );
}

function Pos() {
  const { organization, capabilities, deviceId } = useAuth();
  const toast = useToast();
  const currency = organization?.currency ?? "AUD";
  const quick = capabilities?.quickMode ?? false;

  const [menu, setMenu] = useState<MenuCategoryDTO[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loc, setLoc] = useState<LocationCtx | null>(null);
  const [activeCat, setActiveCat] = useState<string | null>(null);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [modItem, setModItem] = useState<MenuItemDTO | null>(null);
  const [fulfillment, setFulfillment] = useState<Fulfillment>("DINE_IN");
  const [tableId, setTableId] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);
  const [online, setOnline] = useState(true);

  const [discKind, setDiscKind] = useState<DiscKind>("pct");
  const [discInput, setDiscInput] = useState("");

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
      setLoaded(true);
    });
    api.get<{ locations: LocationCtx[] }>("/context").then((c) => setLoc(c.locations[0] ?? null));
  }, []);

  const tax = loc ?? { taxRateBps: 1000, taxInclusive: false };
  const t = useMemo(() => totals(cart, tax.taxRateBps, tax.taxInclusive), [cart, tax]);

  const discountMinor = useMemo(() => {
    const v = parseFloat(discInput || "0");
    if (!v || v <= 0) return 0;
    if (discKind === "pct") return Math.round((t.totalMinor * Math.min(v, 100)) / 100);
    return Math.min(Math.round(v * 100), t.totalMinor);
  }, [discInput, discKind, t.totalMinor]);
  const grandTotalMinor = Math.max(0, t.totalMinor - discountMinor);

  // Items with no modifiers add directly (unchanged behaviour); items with modifiers open the
  // customization sheet first. addItem accepts the resolved modifier list from that sheet.
  function tapItem(it: MenuItemDTO) {
    if (!it.available) return;
    if (it.modifiers.length > 0) setModItem(it);
    else addItem(it);
  }

  function addItem(item: MenuItemDTO, modifiers: LineMod[] = []) {
    if (!item.available) return;
    setCart((c) => {
      if (modifiers.length === 0) {
        const existing = c.find((l) => l.menuItemId === item.id && l.modifiers.length === 0);
        if (existing) return c.map((l) => (l === existing ? { ...l, qty: l.qty + 1 } : l));
      }
      return [
        ...c,
        { lineId: uid(), menuItemId: item.id, name: item.name, unitPriceMinor: item.priceMinor, qty: 1, station: item.station, modifiers },
      ];
    });
  }

  const changeQty = (lineId: string, d: number) =>
    setCart((c) => c.map((l) => (l.lineId === lineId ? { ...l, qty: Math.max(0, l.qty + d) } : l)).filter((l) => l.qty > 0));
  const removeLine = (lineId: string) => setCart((c) => c.filter((l) => l.lineId !== lineId));

  function resetOrder() {
    setCart([]);
    setTableId(null);
    setDiscInput("");
  }

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
    resetOrder();
    toast({ title: "Sent to kitchen", tone: "success" });
  }

  async function payCash(tenderedMinor: number) {
    if (!loc) return;
    const orderId = uid();
    const change = tenderedMinor - grandTotalMinor;
    const events = buildBaseEvents(orderId);
    const now = new Date().toISOString();
    events.push({ orderId, type: "ORDER_CONFIRMED", payload: {}, deviceTimestamp: now, idempotencyKey: `${orderId}:confirmed` });
    events.push({
      orderId,
      type: "PAYMENT_CAPTURED",
      payload: { rail: "CASH", amountMinor: grandTotalMinor, tenderedMinor, changeMinor: change },
      deviceTimestamp: now,
      idempotencyKey: `${orderId}:pay`,
    });
    events.push({ orderId, type: "ORDER_CLOSED", payload: {}, deviceTimestamp: now, idempotencyKey: `${orderId}:closed` });
    await enqueueEvents(events, deviceId ?? undefined);
    setPaying(false);
    setModItem(null);
    resetOrder();
    toast({ title: change > 0 ? `Paid — change ${(change / 100).toFixed(2)}` : "Paid ✓", tone: "success" });
  }

  async function payCard(rail: PaymentRail) {
    if (!loc) return;
    // Card/rail requires connectivity (SYNC-03) — create order online, add items, then charge.
    const order = await api.post<{ id: string }>("/orders", { channel: "POS", fulfillment, tableId: tableId ?? undefined });
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
      deviceTimestamp: new Date().toISOString(),
      idempotencyKey: `${order.id}:add:${l.lineId}`,
    }));
    await api.post(`/orders/${order.id}/events`, { events });
    await api.post(`/orders/${order.id}/pay`, { rail, amountMinor: grandTotalMinor });
    await api.post(`/orders/${order.id}/status`, { status: "CLOSED" });
    setPaying(false);
    setModItem(null);
    resetOrder();
    toast({ title: `Paid via ${rail} ✓`, tone: "success" });
  }

  const activeItems = menu.find((c) => c.id === activeCat)?.items ?? [];

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
      {/* Menu */}
      <div>
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-bold text-ink">Point of Sale</h1>
          {quick && (
            <Badge tone="amber">
              <IconBolt className="h-3.5 w-3.5" />
              Quick mode
            </Badge>
          )}
          {!online && (
            <Badge tone="rose">
              <IconWifiOff className="h-3.5 w-3.5" />
              Offline — cash only
            </Badge>
          )}
        </div>

        {!loaded ? (
          <MenuSkeleton />
        ) : (
          <>
            <div className="mb-4 flex flex-wrap gap-2">
              {menu.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setActiveCat(c.id)}
                  className={`tap rounded-full px-4 py-1.5 text-sm font-medium transition ${
                    activeCat === c.id ? "bg-brand text-white shadow-soft" : "border border-line bg-surface text-muted hover:border-brand/40 hover:text-ink"
                  }`}
                >
                  {c.name}
                </button>
              ))}
            </div>
            {activeItems.length === 0 ? (
              <EmptyState icon={<IconCart className="h-6 w-6" />} title="No items here" description="This category has no menu items yet." />
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {activeItems.map((it) => (
                  <button
                    key={it.id}
                    data-testid="menu-item"
                    onClick={() => tapItem(it)}
                    disabled={!it.available}
                    className={`tap group relative flex flex-col rounded-2xl border p-4 text-left transition ${
                      it.available ? "border-line bg-surface hover:border-brand hover:shadow-soft" : "cursor-not-allowed border-line bg-surface-2 opacity-50"
                    }`}
                  >
                    <div className="font-semibold text-ink">{it.name}</div>
                    <div className="mt-1 font-medium text-brand">
                      <Money minor={it.priceMinor} currency={currency} />
                    </div>
                    {it.modifiers.length > 0 && it.available && (
                      <div className="mt-2 text-[11px] font-medium uppercase tracking-wide text-muted">Customizable</div>
                    )}
                    {!it.available && <div className="mt-1 text-xs font-medium text-rose-500">86 — out of stock</div>}
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Cart */}
      <Card className="flex h-fit flex-col p-4 lg:sticky lg:top-20">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 font-semibold text-ink">
            <IconCart className="h-4 w-4 text-muted" />
            Order
            {cart.length > 0 && <Badge tone="brand">{cart.reduce((s, l) => s + l.qty, 0)}</Badge>}
          </h2>
          {!quick && capabilities?.features.tables && (
            <div className="w-32">
              <Select value={tableId ?? ""} onChange={(e) => setTableId(e.target.value || null)} className="py-1.5 text-sm">
                <option value="">No table</option>
                {loc?.tables.map((tb) => (
                  <option key={tb.id} value={tb.id}>
                    {tb.label}
                  </option>
                ))}
              </Select>
            </div>
          )}
        </div>

        {!quick && (
          <div className="mb-3 grid grid-cols-2 gap-1.5 rounded-xl bg-surface-2 p-1">
            {(["DINE_IN", "PICKUP"] as Fulfillment[]).map((f) => (
              <button
                key={f}
                onClick={() => setFulfillment(f)}
                className={`tap rounded-lg px-2 py-1.5 text-xs font-semibold transition ${
                  fulfillment === f ? "bg-surface text-ink shadow-soft" : "text-muted hover:text-ink"
                }`}
              >
                {f === "DINE_IN" ? "Dine-in" : "Pickup"}
              </button>
            ))}
          </div>
        )}

        <div className="min-h-[140px] flex-1">
          {cart.length === 0 ? (
            <div className="flex h-full min-h-[140px] flex-col items-center justify-center rounded-xl border border-dashed border-line px-4 py-8 text-center">
              <div className="mb-2 grid h-11 w-11 place-items-center rounded-2xl bg-surface-2 text-muted">
                <IconCart className="h-5 w-5" />
              </div>
              <div className="text-sm font-medium text-ink">Cart is empty</div>
              <div className="mt-0.5 text-xs text-muted">Tap a menu item to start an order.</div>
            </div>
          ) : (
            <div className="divide-y divide-line">
              {cart.map((l) => {
                const eachMinor = l.unitPriceMinor + l.modifiers.reduce((s, m) => s + m.priceDeltaMinor, 0);
                return (
                  <div key={l.lineId} className="flex items-start gap-2 py-2.5">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-ink">{l.name}</div>
                      {l.modifiers.length > 0 && <div className="mt-0.5 truncate text-xs text-brand">{l.modifiers.map((m) => m.name).join(", ")}</div>}
                      <div className="mt-0.5 text-xs text-muted">
                        <Money minor={eachMinor} currency={currency} /> each
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        aria-label="Decrease quantity"
                        onClick={() => changeQty(l.lineId, -1)}
                        className="tap grid h-7 w-7 place-items-center rounded-full bg-surface-2 text-ink hover:bg-brand/10 hover:text-brand"
                      >
                        <IconMinus className="h-4 w-4" />
                      </button>
                      <span className="w-6 text-center text-sm font-semibold tabular-nums text-ink">{l.qty}</span>
                      <button
                        aria-label="Increase quantity"
                        onClick={() => changeQty(l.lineId, 1)}
                        className="tap grid h-7 w-7 place-items-center rounded-full bg-surface-2 text-ink hover:bg-brand/10 hover:text-brand"
                      >
                        <IconPlus className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="flex w-16 flex-col items-end">
                      <span className="text-sm font-semibold text-ink">
                        <Money minor={lineTotal(l)} currency={currency} />
                      </span>
                      <button
                        aria-label="Remove item"
                        onClick={() => removeLine(l.lineId)}
                        className="tap mt-0.5 text-muted hover:text-rose-500"
                      >
                        <IconTrash className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {cart.length > 0 && (
          <div className="mt-3 rounded-xl bg-surface-2 p-2.5">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted">Discount</span>
              <div className="ml-auto flex overflow-hidden rounded-lg border border-line">
                {(["pct", "amt"] as DiscKind[]).map((k) => (
                  <button
                    key={k}
                    onClick={() => setDiscKind(k)}
                    className={`tap px-2.5 py-1 text-xs font-semibold transition ${discKind === k ? "bg-brand text-white" : "bg-surface text-muted hover:text-ink"}`}
                  >
                    {k === "pct" ? "%" : "Amt"}
                  </button>
                ))}
              </div>
              <input
                inputMode="decimal"
                value={discInput}
                onChange={(e) => setDiscInput(e.target.value.replace(/[^0-9.]/g, ""))}
                placeholder="0"
                aria-label="Discount value"
                className="w-16 rounded-lg border border-line bg-surface px-2 py-1 text-right text-sm text-ink focus:border-brand focus-visible:outline-none"
              />
            </div>
          </div>
        )}

        <div className="mt-3 space-y-1 border-t border-line pt-3 text-sm">
          <Row label="Subtotal">
            <Money minor={t.subtotalMinor} currency={currency} />
          </Row>
          <Row label={tax.taxInclusive ? "incl. VAT" : "GST"}>
            <Money minor={t.taxMinor} currency={currency} />
          </Row>
          {discountMinor > 0 && (
            <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
              <span>Discount {discKind === "pct" ? `(${Math.min(parseFloat(discInput || "0"), 100)}%)` : ""}</span>
              <span>
                −<Money minor={discountMinor} currency={currency} />
              </span>
            </div>
          )}
          <div className="flex justify-between pt-1 text-base font-bold text-ink">
            <span>Total</span>
            <Money minor={grandTotalMinor} currency={currency} />
          </div>
        </div>

        <div className="mt-3 grid gap-2">
          <Button size="lg" icon={<IconCash className="h-5 w-5" />} disabled={!cart.length} onClick={() => setPaying(true)}>
            Take Payment
          </Button>
          {!quick && (
            <Button variant="secondary" icon={<IconReceipt className="h-4 w-4" />} disabled={!cart.length} onClick={sendToKitchen}>
              Send to Kitchen
            </Button>
          )}
        </div>
      </Card>

      {modItem && (
        <ModifierSheet
          item={modItem}
          currency={currency}
          onClose={() => setModItem(null)}
          onConfirm={(mods) => {
            addItem(modItem, mods);
            setModItem(null);
          }}
        />
      )}

      <PaymentModal
        open={paying}
        currency={currency}
        totalMinor={grandTotalMinor}
        online={online}
        rails={railsForCurrency(currency as "AUD" | "NPR")}
        onCash={payCash}
        onCard={payCard}
        onClose={() => setPaying(false)}
      />
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between text-muted">
      <span>{label}</span>
      <span className="text-ink">{children}</span>
    </div>
  );
}

function MenuSkeleton() {
  return (
    <>
      <div className="mb-4 flex flex-wrap gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-24 rounded-full" />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {Array.from({ length: 9 }).map((_, i) => (
          <Skeleton key={i} className="h-[92px] rounded-2xl" />
        ))}
      </div>
    </>
  );
}

/**
 * Non-blocking customization sheet (FE-03). Opened when a tapped item carries modifiers, before the
 * line is added to the cart. The scrim is intentionally pointer-events-none so the menu grid stays
 * live behind it (a bottom-anchored, width-capped sheet that never overlaps the cart column).
 */
function ModifierSheet({
  item,
  currency,
  onClose,
  onConfirm,
}: {
  item: MenuItemDTO;
  currency: string;
  onClose: () => void;
  onConfirm: (mods: LineMod[]) => void;
}) {
  const [sel, setSel] = useState<Record<string, boolean>>({});
  const groups = useMemo(() => {
    const map = new Map<string, typeof item.modifiers>();
    for (const m of item.modifiers) {
      const arr = map.get(m.groupName) ?? [];
      arr.push(m);
      map.set(m.groupName, arr);
    }
    return [...map.entries()];
  }, [item]);

  const selected: LineMod[] = item.modifiers.filter((m) => sel[m.id]).map((m) => ({ name: m.name, priceDeltaMinor: m.priceDeltaMinor }));
  const extra = selected.reduce((s, m) => s + m.priceDeltaMinor, 0);

  return (
    <div className="pointer-events-none fixed inset-0 z-30 flex items-end justify-center bg-black/25 p-4 animate-fade">
      <div className="pointer-events-auto flex max-h-[70vh] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-lift animate-rise">
        <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
          <div>
            <h3 className="text-base font-bold text-ink">{item.name}</h3>
            <div className="text-xs text-muted">Customize before adding</div>
          </div>
          <IconButton label="Close" icon={<IconClose className="h-5 w-5" />} onClick={onClose} />
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {groups.map(([name, mods]) => (
            <div key={name}>
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">{name}</div>
              <div className="grid gap-2">
                {mods.map((m) => {
                  const on = !!sel[m.id];
                  return (
                    <button
                      key={m.id}
                      onClick={() => setSel((s) => ({ ...s, [m.id]: !s[m.id] }))}
                      className={`tap flex items-center justify-between rounded-xl border px-3 py-2.5 text-left transition ${
                        on ? "border-brand bg-brand/10" : "border-line bg-surface-2 hover:border-brand/40"
                      }`}
                    >
                      <span className="flex items-center gap-2.5 text-sm font-medium text-ink">
                        <span className={`grid h-5 w-5 place-items-center rounded-md border ${on ? "border-brand bg-brand text-white" : "border-line"}`}>
                          {on && <IconCheck className="h-3.5 w-3.5" />}
                        </span>
                        {m.name}
                      </span>
                      <span className="text-sm text-muted">
                        +<Money minor={m.priceDeltaMinor} currency={currency} />
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-2 border-t border-line px-5 py-3.5">
          <Button variant="secondary" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
          <Button className="flex-1" onClick={() => onConfirm(selected)}>
            Add · <Money minor={item.priceMinor + extra} currency={currency} />
          </Button>
        </div>
      </div>
    </div>
  );
}

function PaymentModal({
  open,
  currency,
  totalMinor,
  online,
  rails,
  onCash,
  onCard,
  onClose,
}: {
  open: boolean;
  currency: string;
  totalMinor: number;
  online: boolean;
  rails: PaymentRail[];
  onCash: (tenderedMinor: number) => void;
  onCard: (rail: PaymentRail) => void;
  onClose: () => void;
}) {
  const [tendered, setTendered] = useState((totalMinor / 100).toFixed(2));
  useEffect(() => {
    if (open) setTendered((totalMinor / 100).toFixed(2));
  }, [open, totalMinor]);

  const tenderedMinor = Math.round(parseFloat(tendered || "0") * 100);
  const change = tenderedMinor - totalMinor;
  const cardRails = rails.filter((r) => r !== "CASH");

  return (
    <Modal open={open} onClose={onClose} title="Take Payment" size="md">
      <div className="mb-4 flex items-center justify-between rounded-xl bg-surface-2 px-4 py-3">
        <span className="text-sm font-medium text-muted">Amount due</span>
        <span className="text-2xl font-bold text-ink">
          <Money minor={totalMinor} currency={currency} />
        </span>
      </div>

      <div className="rounded-xl border border-line p-4">
        <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-ink">
          <IconCash className="h-4 w-4 text-muted" />
          Cash
        </div>
        <div className="flex items-center gap-3">
          <input
            inputMode="decimal"
            aria-label="Cash tendered"
            className="w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-lg text-ink focus:border-brand focus-visible:outline-none"
            value={tendered}
            onChange={(e) => setTendered(e.target.value)}
          />
          <div className="whitespace-nowrap text-right text-sm text-muted">
            <div className="text-xs uppercase tracking-wide">Change</div>
            <div className="font-semibold text-ink">{change >= 0 ? (change / 100).toFixed(2) : "—"}</div>
          </div>
        </div>
        <Button size="lg" className="mt-3 w-full" disabled={tenderedMinor < totalMinor} onClick={() => onCash(tenderedMinor)}>
          Charge Cash
        </Button>
      </div>

      {cardRails.length > 0 && (
        <div className="mt-4">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-ink">
            <IconCard className="h-4 w-4 text-muted" />
            Card / digital
            {!online && <span className="text-xs font-normal text-rose-500">(unavailable offline)</span>}
          </div>
          <div className="grid grid-cols-2 gap-2">
            {cardRails.map((r) => (
              <Button key={r} variant="secondary" disabled={!online} onClick={() => onCard(r)}>
                {r}
              </Button>
            ))}
          </div>
        </div>
      )}
    </Modal>
  );
}
