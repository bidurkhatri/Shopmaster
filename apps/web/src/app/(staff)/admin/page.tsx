"use client";
import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { StaffShell } from "@/components/StaffShell";
import {
  Button,
  Card,
  Money,
  Badge,
  Stat,
  Skeleton,
  EmptyState,
  Modal,
  Field,
  Input,
  Select,
  SectionTitle,
  IconButton,
  useToast,
} from "@/components/ui";
import {
  IconChart,
  IconReceipt,
  IconMenuList,
  IconGrid,
  IconUsers,
  IconSettings,
  IconPlus,
  IconMinus,
  IconTrash,
  IconEdit,
  IconClock,
  IconArrowRight,
  IconCart,
  IconStore,
  IconPrinter,
  IconBox,
  IconHeart,
  IconCash,
} from "@/components/icons";
import { api, API_BASE } from "@/lib/api";
import { useAuth } from "@/lib/store";
import { STATIONS } from "@shopmaster/shared";
import type {
  MenuCategoryDTO,
  MenuItemDTO,
  OrderDTO,
  SalesReport,
  OrderStatus,
  InventoryReport,
  CustomerDTO,
  ShiftDTO,
} from "@shopmaster/shared";

interface Ctx {
  locations: {
    id: string;
    name: string;
    currency: string;
    taxJurisdiction: string;
    taxRateBps: number;
    taxInclusive: boolean;
    tables: { id: string; label: string; qrToken: string; status: string }[];
  }[];
}

const TABS = [
  { key: "Dashboard", icon: IconChart },
  { key: "Orders", icon: IconReceipt },
  { key: "Menu", icon: IconMenuList },
  { key: "Inventory", icon: IconBox },
  { key: "Customers", icon: IconHeart },
  { key: "Cash", icon: IconCash },
  { key: "Tables", icon: IconGrid },
  { key: "Staff", icon: IconUsers },
  { key: "Settings", icon: IconSettings },
] as const;
type Tab = (typeof TABS)[number]["key"];

function errMsg(e: unknown) {
  return e instanceof Error && e.message ? e.message : "Something went wrong";
}

export default function AdminPage() {
  return (
    <StaffShell>
      <Admin />
    </StaffShell>
  );
}

function Admin() {
  const { organization, capabilities } = useAuth();
  const [tab, setTab] = useState<Tab>("Dashboard");
  const currency = organization?.currency ?? "AUD";

  // Multi-location (MULTI): an Enterprise chain can scope the back office to one site.
  const multiLoc = capabilities?.features.multiLocation ?? false;
  const [locations, setLocations] = useState<{ id: string; name: string }[]>([]);
  const [locationId, setLocationId] = useState<string>(""); // "" = all locations
  useEffect(() => {
    if (!multiLoc) return;
    api
      .get<Ctx>("/context")
      .then((c) => setLocations(c.locations.map((l) => ({ id: l.id, name: l.name }))))
      .catch(() => undefined);
  }, [multiLoc]);
  const scopedLocation = locationId || undefined;

  const visibleTabs = TABS.filter((t) => {
    if (t.key === "Inventory") return capabilities?.features.inventory;
    if (t.key === "Customers") return capabilities?.features.loyalty;
    if (t.key === "Cash") return capabilities?.features.cashManagement;
    if (t.key === "Tables") return capabilities?.features.tables;
    if (t.key === "Staff") return capabilities?.features.staffRoles;
    return true;
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-ink">Back office</h1>
          <p className="mt-0.5 text-sm text-muted">Sales, orders, menu and settings for {organization?.name ?? "your store"}.</p>
        </div>
        {multiLoc && locations.length > 1 && (
          <div className="w-48">
            <Select value={locationId} onChange={(e) => setLocationId(e.target.value)} aria-label="Location" className="py-2 text-sm">
              <option value="">All locations</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </Select>
          </div>
        )}
      </div>

      <div className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1">
        <div className="flex gap-1 rounded-2xl border border-line bg-surface-2 p-1">
          {visibleTabs.map((t) => {
            const Icon = t.icon;
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                aria-current={active ? "page" : undefined}
                className={`tap inline-flex shrink-0 items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-semibold transition ${
                  active ? "bg-surface text-brand shadow-soft" : "text-muted hover:text-ink"
                }`}
              >
                <Icon className="h-4 w-4" />
                {t.key}
              </button>
            );
          })}
        </div>
      </div>

      {tab === "Dashboard" && <Dashboard currency={currency} locationId={scopedLocation} />}
      {tab === "Orders" && <Orders locationId={scopedLocation} />}
      {tab === "Menu" && <MenuAdmin />}
      {tab === "Inventory" && <Inventory currency={currency} />}
      {tab === "Customers" && <Customers currency={currency} />}
      {tab === "Cash" && <CashDrawer currency={currency} />}
      {tab === "Tables" && <Tables />}
      {tab === "Staff" && <Staff />}
      {tab === "Settings" && <Settings />}
    </div>
  );
}

/* ------------------------------------------------------------------ dashboard */

const RANGES = [
  { key: "today", label: "Today" },
  { key: "7d", label: "7 days" },
  { key: "30d", label: "30 days" },
] as const;
type RangeKey = (typeof RANGES)[number]["key"];

/** Build a `?from=&to=` window for the report endpoints from a preset. */
function rangeQuery(key: RangeKey): string {
  const to = new Date();
  const from = new Date();
  if (key === "today") from.setHours(0, 0, 0, 0);
  else from.setTime(to.getTime() - parseInt(key, 10) * 86_400_000);
  return `?from=${from.toISOString()}&to=${to.toISOString()}`;
}

function Dashboard({ currency, locationId }: { currency: string; locationId?: string }) {
  const [r, setR] = useState<SalesReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<RangeKey>("30d");
  const q = useMemo(() => rangeQuery(range) + (locationId ? `&locationId=${locationId}` : ""), [range, locationId]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    api
      .get<SalesReport>(`/reports/sales${q}`)
      .then((d) => alive && setR(d))
      .catch(() => undefined)
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [q]);

  const rangePicker = (
    <div className="flex gap-1 rounded-xl border border-line bg-surface-2 p-1">
      {RANGES.map((rg) => (
        <button
          key={rg.key}
          onClick={() => setRange(rg.key)}
          className={`tap rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
            range === rg.key ? "bg-surface text-brand shadow-soft" : "text-muted hover:text-ink"
          }`}
        >
          {rg.label}
        </button>
      ))}
    </div>
  );

  if (loading)
    return (
      <div className="space-y-4">
        <div className="flex justify-end">{rangePicker}</div>
        <DashboardSkeleton />
      </div>
    );
  if (!r)
    return (
      <div className="space-y-4">
        <div className="flex justify-end">{rangePicker}</div>
        <EmptyState
          icon={<IconChart className="h-6 w-6" />}
          title="No report yet"
          description="Sales insights will appear here once you start taking orders."
        />
      </div>
    );

  const maxRail = Math.max(1, ...r.byRail.map((x) => x.amountMinor));
  const maxDay = Math.max(1, ...r.byDay.map((x) => x.amountMinor));

  return (
    <div className="space-y-4">
      <div className="flex justify-end">{rangePicker}</div>
      <div className={`grid grid-cols-2 gap-3 ${r.tipsMinor > 0 ? "sm:grid-cols-5" : "sm:grid-cols-4"}`}>
        <Stat label="Orders" value={String(r.orderCount)} />
        <Stat label="Gross" value={<Money minor={r.grossMinor} currency={currency} />} />
        <Stat label="Tax" value={<Money minor={r.taxMinor} currency={currency} />} />
        <Stat label="Net" value={<Money minor={r.netMinor} currency={currency} />} />
        {r.tipsMinor > 0 && <Stat label="Tips" value={<Money minor={r.tipsMinor} currency={currency} />} />}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <h3 className="mb-4 text-sm font-semibold text-muted">Payment mix (per rail)</h3>
          <div className="space-y-3.5">
            {r.byRail.map((x) => (
              <div key={x.rail}>
                <div className="mb-1.5 flex items-baseline justify-between text-sm">
                  <span className="font-medium text-ink">{x.rail}</span>
                  <span className="text-muted">
                    <Money minor={x.amountMinor} currency={currency} />
                    <span className="ml-1.5 text-xs">· {x.count}</span>
                  </span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-surface-2">
                  <div
                    className="h-full rounded-full bg-brand transition-all"
                    style={{ width: `${Math.max(4, (x.amountMinor / maxRail) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
            {r.byRail.length === 0 && <div className="py-6 text-center text-sm text-muted">No payments yet.</div>}
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="mb-4 text-sm font-semibold text-muted">Sales by day</h3>
          {r.byDay.length === 0 ? (
            <div className="flex h-36 items-center justify-center text-sm text-muted">No sales yet.</div>
          ) : (
            <div className="flex h-36 items-end gap-1.5">
              {r.byDay.map((d) => (
                <div
                  key={d.date}
                  className="group flex flex-1 flex-col items-center gap-1.5"
                  title={`${d.date}: ${d.orderCount} orders`}
                >
                  <div className="flex w-full flex-1 items-end">
                    <div
                      className="w-full rounded-t-md bg-brand/75 transition-all group-hover:bg-brand"
                      style={{ height: `${Math.max(3, (d.amountMinor / maxDay) * 100)}%` }}
                    />
                  </div>
                  <div className="text-[10px] font-medium text-muted">{d.date.slice(5)}</div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Card className="p-5">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-muted">Top items</h3>
          <a
            href={`${API_BASE}/reports/sales.csv${q}`}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand hover:brightness-110"
            onClick={(e) => downloadCsv(e, q)}
          >
            <IconPrinter className="h-4 w-4" />
            Export CSV
          </a>
        </div>
        {r.topItems.length === 0 ? (
          <div className="py-6 text-center text-sm text-muted">No items sold yet.</div>
        ) : (
          <table className="w-full text-sm">
            <tbody>
              {r.topItems.map((i) => (
                <tr key={i.name} className="border-t border-line">
                  <td className="py-2 font-medium text-ink">{i.name}</td>
                  <td className="py-2 text-right text-muted">{i.qty}×</td>
                  <td className="py-2 text-right font-medium text-ink">
                    <Money minor={i.revenueMinor} currency={currency} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="p-4">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="mt-3 h-7 w-24" />
          </Card>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <Card key={i} className="space-y-3 p-5">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-32 w-full" />
          </Card>
        ))}
      </div>
      <Card className="space-y-3 p-5">
        <Skeleton className="h-4 w-24" />
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-5 w-full" />
        ))}
      </Card>
    </div>
  );
}

async function downloadCsv(e: React.MouseEvent, query = "") {
  e.preventDefault();
  const token = useAuth.getState().token;
  const res = await fetch(`${API_BASE}/reports/sales.csv${query}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "shopmaster-sales.csv";
  a.click();
  URL.revokeObjectURL(url);
}

/* ------------------------------------------------------------------ orders */

const STATUS_TONE: Record<string, "slate" | "green" | "amber" | "blue" | "rose"> = {
  OPEN: "slate",
  CONFIRMED: "blue",
  READY: "amber",
  CLOSED: "green",
  VOID: "rose",
};
const PAY_TONE: Record<string, "slate" | "green" | "amber" | "blue" | "rose"> = {
  PENDING: "amber",
  AUTHORIZED: "blue",
  CAPTURED: "green",
  FAILED: "rose",
  REFUNDED: "slate",
};

function shortId(id: string) {
  return id.slice(-6).toUpperCase();
}
function timeOf(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function Orders({ locationId }: { locationId?: string }) {
  const toast = useToast();
  const [orders, setOrders] = useState<OrderDTO[] | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = () =>
    api
      .get<OrderDTO[]>(`/orders${locationId ? `?locationId=${locationId}` : ""}`)
      .then((list) => setOrders([...list].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))))
      .catch(() => setOrders([]));

  useEffect(() => {
    setOrders(null);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  const open = orders?.find((o) => o.id === openId) ?? null;

  async function setStatus(id: string, status: OrderStatus) {
    setBusy(`status:${status}`);
    try {
      await api.post(`/orders/${id}/status`, { status });
      toast({ title: `Order marked ${status}`, tone: "success" });
      await load();
    } catch (e) {
      toast({ title: errMsg(e), tone: "error" });
    } finally {
      setBusy(null);
    }
  }

  async function refund(id: string, paymentId: string) {
    setBusy(`refund:${paymentId}`);
    try {
      await api.post(`/orders/${id}/refund`, { paymentId });
      toast({ title: "Payment refunded", tone: "success" });
      await load();
    } catch (e) {
      toast({ title: errMsg(e), tone: "error" });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      <SectionTitle
        right={
          <IconButton
            label="Refresh orders"
            icon={<IconArrowRight className="h-4 w-4 rotate-90" />}
            onClick={() => {
              setOrders(null);
              load();
            }}
          />
        }
      >
        Recent orders
      </SectionTitle>

      {orders === null ? (
        <Card className="divide-y divide-line">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 p-4">
              <Skeleton className="h-9 w-9 rounded-xl" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-24" />
              </div>
              <Skeleton className="h-5 w-16" />
            </div>
          ))}
        </Card>
      ) : orders.length === 0 ? (
        <EmptyState icon={<IconReceipt className="h-6 w-6" />} title="No orders yet" description="Orders taken at the POS, kiosk or QR will show up here." />
      ) : (
        <Card className="divide-y divide-line overflow-hidden">
          {orders.map((o) => (
            <button
              key={o.id}
              onClick={() => setOpenId(o.id)}
              className="tap flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-surface-2"
            >
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-surface-2 text-muted">
                <IconReceipt className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-ink">#{shortId(o.id)}</span>
                  <Badge tone="slate">{o.channel}</Badge>
                  <Badge tone={STATUS_TONE[o.status] ?? "slate"}>{o.status}</Badge>
                </div>
                <div className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-muted">
                  <IconClock className="h-3.5 w-3.5" />
                  {timeOf(o.createdAt)}
                  {o.tableLabel && <span>· Table {o.tableLabel}</span>}
                  {o.customerName && <span>· {o.customerName}</span>}
                </div>
              </div>
              <div className="text-right">
                <div className="font-semibold text-ink">
                  <Money minor={o.totalMinor} currency={o.currency} />
                </div>
                {o.balanceMinor > 0 && <div className="text-xs text-amber-600 dark:text-amber-400">Balance due</div>}
              </div>
            </button>
          ))}
        </Card>
      )}

      <Modal open={!!open} onClose={() => setOpenId(null)} size="lg" title={open ? `Order #${shortId(open.id)}` : ""}>
        {open && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="slate">{open.channel}</Badge>
              <Badge tone={STATUS_TONE[open.status] ?? "slate"}>{open.status}</Badge>
              {open.tableLabel && <Badge tone="blue">Table {open.tableLabel}</Badge>}
              <span className="ml-auto text-xs text-muted">{timeOf(open.createdAt)}</span>
            </div>

            <div>
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Items</div>
              <div className="divide-y divide-line rounded-xl border border-line">
                {open.items.map((it) => (
                  <div key={it.id} className="flex items-start gap-3 px-3 py-2.5">
                    <span className="min-w-[1.75rem] text-sm font-semibold text-muted">{it.qty}×</span>
                    <div className="min-w-0 flex-1">
                      <div className={`text-sm font-medium ${it.voided ? "text-muted line-through" : "text-ink"}`}>{it.nameSnapshot}</div>
                      {it.modifiers.length > 0 && (
                        <div className="text-xs text-muted">{it.modifiers.map((m) => m.name).join(", ")}</div>
                      )}
                    </div>
                    <span className="text-sm font-medium text-ink">
                      <Money minor={it.lineTotalMinor} currency={open.currency} />
                    </span>
                  </div>
                ))}
                {open.items.length === 0 && <div className="px-3 py-4 text-center text-sm text-muted">No items.</div>}
              </div>
              <dl className="mt-3 space-y-1 text-sm">
                <TotalRow k="Subtotal" v={<Money minor={open.subtotalMinor} currency={open.currency} />} />
                <TotalRow k="Tax" v={<Money minor={open.taxMinor} currency={open.currency} />} />
                <TotalRow k="Total" v={<Money minor={open.totalMinor} currency={open.currency} />} strong />
                {open.tipMinor > 0 && <TotalRow k="Tip" v={<Money minor={open.tipMinor} currency={open.currency} />} />}
                <TotalRow k="Paid" v={<Money minor={open.paidMinor} currency={open.currency} />} />
                {open.balanceMinor > 0 && <TotalRow k="Balance" v={<Money minor={open.balanceMinor} currency={open.currency} />} />}
              </dl>
            </div>

            <div>
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Payments</div>
              {open.payments.length === 0 ? (
                <div className="rounded-xl border border-dashed border-line px-3 py-4 text-center text-sm text-muted">No payments recorded.</div>
              ) : (
                <div className="divide-y divide-line rounded-xl border border-line">
                  {open.payments.map((p) => (
                    <div key={p.id} className="flex items-center gap-3 px-3 py-2.5">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 text-sm font-medium text-ink">
                          {p.rail}
                          <Badge tone={PAY_TONE[p.status] ?? "slate"}>{p.status}</Badge>
                        </div>
                      </div>
                      <span className="text-sm font-medium text-ink">
                        <Money minor={p.amountMinor} currency={p.currency} />
                      </span>
                      {p.status === "CAPTURED" && (
                        <Button
                          size="sm"
                          variant="outline"
                          loading={busy === `refund:${p.id}`}
                          disabled={!!busy}
                          onClick={() => refund(open.id, p.id)}
                        >
                          Refund
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Set status</div>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={!!busy || open.status === "READY"}
                  loading={busy === "status:READY"}
                  onClick={() => setStatus(open.id, "READY")}
                >
                  Ready
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={!!busy || open.status === "CLOSED" || open.status === "VOID"}
                  loading={busy === "status:CLOSED"}
                  onClick={() => setStatus(open.id, "CLOSED")}
                >
                  Closed
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  disabled={!!busy || open.status === "VOID"}
                  loading={busy === "status:VOID"}
                  onClick={() => setStatus(open.id, "VOID")}
                >
                  Void
                </Button>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

function TotalRow({ k, v, strong }: { k: string; v: React.ReactNode; strong?: boolean }) {
  return (
    <div className={`flex justify-between ${strong ? "border-t border-line pt-1 font-semibold text-ink" : "text-muted"}`}>
      <dt>{k}</dt>
      <dd className={strong ? "text-ink" : "text-ink"}>{v}</dd>
    </div>
  );
}

/* ------------------------------------------------------------------ menu */

function findItem(menu: MenuCategoryDTO[], id: string): MenuItemDTO | undefined {
  for (const c of menu) {
    const it = c.items.find((x) => x.id === id);
    if (it) return it;
  }
  return undefined;
}

function MenuAdmin() {
  const toast = useToast();
  const [menu, setMenu] = useState<MenuCategoryDTO[] | null>(null);
  const [nameEn, setNameEn] = useState("");
  const [price, setPrice] = useState("");
  const [station, setStation] = useState<string>(STATIONS[0]);
  const [categoryId, setCategoryId] = useState("");
  const [catName, setCatName] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<MenuItemDTO | null>(null);
  const [busy, setBusy] = useState(false);
  const currency = useAuth((s) => s.organization?.currency ?? "AUD");

  const load = () => api.get<MenuCategoryDTO[]>("/menu").then(setMenu);
  useEffect(() => {
    load();
  }, []);

  async function toggle86(id: string, available: boolean) {
    try {
      await api.post(`/menu/items/${id}/availability`, { available: !available });
      await load();
    } catch (e) {
      toast({ title: errMsg(e), tone: "error" });
    }
  }

  async function addItem() {
    if (!nameEn || !categoryId || !price) {
      toast({ title: "Pick a category, name and price", tone: "error" });
      return;
    }
    setBusy(true);
    try {
      await api.post("/menu/items", { categoryId, nameEn, priceMinor: Math.round(parseFloat(price) * 100), station });
      setNameEn("");
      setPrice("");
      toast({ title: "Item added", tone: "success" });
      await load();
    } catch (e) {
      toast({ title: errMsg(e), tone: "error" });
    } finally {
      setBusy(false);
    }
  }

  async function addCategory() {
    if (!catName.trim()) return;
    setBusy(true);
    try {
      await api.post("/menu/categories", { nameEn: catName.trim() });
      setCatName("");
      toast({ title: "Category added", tone: "success" });
      await load();
    } catch (e) {
      toast({ title: errMsg(e), tone: "error" });
    } finally {
      setBusy(false);
    }
  }

  async function doDelete(item: MenuItemDTO) {
    setBusy(true);
    try {
      await api.raw(`/menu/items/${item.id}`, { method: "DELETE" });
      toast({ title: "Item deleted", tone: "success" });
      setConfirmDelete(null);
      await load();
    } catch (e) {
      toast({ title: errMsg(e), tone: "error" });
    } finally {
      setBusy(false);
    }
  }

  const editing = editId && menu ? findItem(menu, editId) ?? null : null;

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <h3 className="mb-3 text-sm font-semibold text-muted">Add item</h3>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[1fr_1.4fr_auto_auto_auto]">
          <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="">Category…</option>
            {(menu ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
          <Input placeholder="Item name" value={nameEn} onChange={(e) => setNameEn(e.target.value)} />
          <Input placeholder="Price" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} className="lg:w-28" />
          <Select value={station} onChange={(e) => setStation(e.target.value)} className="lg:w-32">
            {STATIONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
          <Button icon={<IconPlus className="h-4 w-4" />} loading={busy} onClick={addItem}>
            Add
          </Button>
        </div>
        <div className="mt-4 flex flex-col gap-2 border-t border-line pt-4 sm:flex-row sm:items-end">
          <Field label="Add category" hint="Group items on your menu">
            <Input placeholder="Category name" value={catName} onChange={(e) => setCatName(e.target.value)} />
          </Field>
          <Button variant="secondary" icon={<IconPlus className="h-4 w-4" />} loading={busy} onClick={addCategory}>
            Add category
          </Button>
        </div>
      </Card>

      {menu === null ? (
        <div className="space-y-4">
          {Array.from({ length: 2 }).map((_, i) => (
            <Card key={i} className="space-y-3 p-5">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-6 w-full" />
              <Skeleton className="h-6 w-full" />
            </Card>
          ))}
        </div>
      ) : menu.length === 0 ? (
        <EmptyState icon={<IconMenuList className="h-6 w-6" />} title="No categories yet" description="Add a category above to start building your menu." />
      ) : (
        menu.map((c) => (
          <Card key={c.id} className="p-5">
            <h3 className="mb-2 font-semibold text-ink">{c.name}</h3>
            {c.items.length === 0 ? (
              <div className="py-3 text-sm text-muted">No items in this category yet.</div>
            ) : (
              <div className="divide-y divide-line">
                {c.items.map((it) => (
                  <div key={it.id} className="flex items-center gap-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <span className={`font-medium ${it.available ? "text-ink" : "text-muted line-through"}`}>{it.name}</span>
                      <span className="ml-2 text-sm text-muted">
                        <Money minor={it.priceMinor} currency={currency} />
                      </span>
                      {it.modifiers.length > 0 && <span className="ml-2 text-xs text-muted">· {it.modifiers.length} modifier(s)</span>}
                    </div>
                    {!it.available && <Badge tone="rose">86</Badge>}
                    <IconButton label="Edit item" icon={<IconEdit className="h-4 w-4" />} onClick={() => setEditId(it.id)} />
                    <Button size="sm" variant={it.available ? "secondary" : "primary"} onClick={() => toggle86(it.id, it.available)}>
                      {it.available ? "Mark 86" : "Restore"}
                    </Button>
                    <IconButton
                      label="Delete item"
                      icon={<IconTrash className="h-4 w-4" />}
                      className="hover:text-rose-600"
                      onClick={() => setConfirmDelete(it)}
                    />
                  </div>
                ))}
              </div>
            )}
          </Card>
        ))
      )}

      {editing && (
        <ItemEditModal key={editing.id} item={editing} currency={currency} onClose={() => setEditId(null)} onChanged={load} />
      )}

      <Modal
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        size="sm"
        title="Delete item"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmDelete(null)}>
              Cancel
            </Button>
            <Button variant="danger" loading={busy} onClick={() => confirmDelete && doDelete(confirmDelete)}>
              Delete
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted">
          Delete <span className="font-semibold text-ink">{confirmDelete?.name}</span>? This can’t be undone.
        </p>
      </Modal>
    </div>
  );
}

function ItemEditModal({
  item,
  currency,
  onClose,
  onChanged,
}: {
  item: MenuItemDTO;
  currency: string;
  onClose: () => void;
  onChanged: () => Promise<unknown> | void;
}) {
  const toast = useToast();
  const [nameEn, setNameEn] = useState(item.name);
  const [price, setPrice] = useState((item.priceMinor / 100).toFixed(2));
  const [station, setStation] = useState<string>(item.station || STATIONS[0]);
  const [saving, setSaving] = useState(false);

  // modifier draft
  const [mGroup, setMGroup] = useState("");
  const [mName, setMName] = useState("");
  const [mDelta, setMDelta] = useState("");
  const [modBusy, setModBusy] = useState(false);

  async function save() {
    const priceMinor = Math.round(parseFloat(price) * 100);
    if (!nameEn.trim() || Number.isNaN(priceMinor) || priceMinor < 0) {
      toast({ title: "Enter a valid name and price", tone: "error" });
      return;
    }
    setSaving(true);
    try {
      await api.raw(`/menu/items/${item.id}`, {
        method: "PATCH",
        body: JSON.stringify({ nameEn: nameEn.trim(), priceMinor, station }),
      });
      toast({ title: "Item updated", tone: "success" });
      await onChanged();
      onClose();
    } catch (e) {
      toast({ title: errMsg(e), tone: "error" });
    } finally {
      setSaving(false);
    }
  }

  async function addModifier() {
    if (!mGroup.trim() || !mName.trim()) {
      toast({ title: "Modifier needs a group and name", tone: "error" });
      return;
    }
    const priceDeltaMinor = Math.round(parseFloat(mDelta || "0") * 100);
    if (Number.isNaN(priceDeltaMinor)) {
      toast({ title: "Invalid modifier price", tone: "error" });
      return;
    }
    setModBusy(true);
    try {
      await api.post(`/menu/items/${item.id}/modifiers`, { groupName: mGroup.trim(), nameEn: mName.trim(), priceDeltaMinor });
      setMGroup("");
      setMName("");
      setMDelta("");
      await onChanged();
    } catch (e) {
      toast({ title: errMsg(e), tone: "error" });
    } finally {
      setModBusy(false);
    }
  }

  async function removeModifier(id: string) {
    setModBusy(true);
    try {
      await api.raw(`/menu/modifiers/${id}`, { method: "DELETE" });
      await onChanged();
    } catch (e) {
      toast({ title: errMsg(e), tone: "error" });
    } finally {
      setModBusy(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title="Edit item"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={saving} onClick={save}>
            Save changes
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Name">
            <Input value={nameEn} onChange={(e) => setNameEn(e.target.value)} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Price">
              <Input inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} />
            </Field>
            <Field label="Station">
              <Select value={station} onChange={(e) => setStation(e.target.value)}>
                {STATIONS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        </div>

        <div className="border-t border-line pt-4">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Modifiers</div>
          {item.modifiers.length === 0 ? (
            <div className="mb-3 text-sm text-muted">No modifiers yet.</div>
          ) : (
            <div className="mb-3 divide-y divide-line rounded-xl border border-line">
              {item.modifiers.map((m) => (
                <div key={m.id} className="flex items-center gap-3 px-3 py-2">
                  <span className="text-xs font-medium uppercase text-muted">{m.groupName}</span>
                  <span className="flex-1 text-sm text-ink">{m.name}</span>
                  {m.priceDeltaMinor !== 0 && (
                    <span className="text-sm text-muted">
                      {m.priceDeltaMinor > 0 ? "+" : "−"}
                      <Money minor={Math.abs(m.priceDeltaMinor)} currency={currency} />
                    </span>
                  )}
                  <IconButton
                    label="Remove modifier"
                    icon={<IconTrash className="h-4 w-4" />}
                    className="hover:text-rose-600"
                    disabled={modBusy}
                    onClick={() => removeModifier(m.id)}
                  />
                </div>
              ))}
            </div>
          )}
          <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto_auto]">
            <Input placeholder="Group (e.g. Size)" value={mGroup} onChange={(e) => setMGroup(e.target.value)} />
            <Input placeholder="Name (e.g. Large)" value={mName} onChange={(e) => setMName(e.target.value)} />
            <Input placeholder="±Price" inputMode="decimal" value={mDelta} onChange={(e) => setMDelta(e.target.value)} className="sm:w-24" />
            <Button variant="secondary" icon={<IconPlus className="h-4 w-4" />} loading={modBusy} onClick={addModifier}>
              Add
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------------ inventory */

function reasonTone(reason: string): "slate" | "green" | "amber" | "rose" {
  if (reason === "ORDER") return "amber";
  if (reason === "RESTOCK") return "green";
  return "slate";
}

function Inventory({ currency }: { currency: string }) {
  const toast = useToast();
  const [data, setData] = useState<InventoryReport | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [editing, setEditing] = useState<InventoryReport["rows"][number] | null>(null);

  const load = () => api.get<InventoryReport>("/inventory").then(setData).catch(() => setData({ rows: [], lowCount: 0, movements: [] }));
  useEffect(() => {
    load();
  }, []);

  async function adjust(menuItemId: string, delta: number) {
    setBusy(`${menuItemId}:${delta > 0 ? "up" : "down"}`);
    try {
      await api.post("/inventory/adjust", { menuItemId, delta });
      await load();
    } catch (e) {
      toast({ title: errMsg(e), tone: "error" });
    } finally {
      setBusy(null);
    }
  }

  if (data === null) {
    return (
      <Card className="divide-y divide-line">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 p-4">
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-24" />
            </div>
            <Skeleton className="h-8 w-24" />
          </div>
        ))}
      </Card>
    );
  }

  const tracked = data.rows.filter((r) => r.tracked);
  const untracked = data.rows.filter((r) => !r.tracked);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat label="Tracked items" value={String(tracked.length)} />
        <Stat label="Low on stock" value={String(data.lowCount)} hint={data.lowCount > 0 ? "Reorder soon" : "All healthy"} />
        <Stat label="Out of stock" value={String(tracked.filter((r) => r.stockLevel === 0).length)} />
      </div>

      {data.lowCount > 0 && (
        <div className="flex items-center gap-2 rounded-xl border border-amber-300/60 bg-amber-50 px-4 py-2.5 text-sm font-medium text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
          <IconBox className="h-4 w-4" />
          {data.lowCount} item{data.lowCount === 1 ? "" : "s"} at or below the reorder point.
        </div>
      )}

      <Card className="overflow-hidden">
        <div className="border-b border-line px-4 py-3">
          <h3 className="text-sm font-semibold text-muted">Stock levels</h3>
        </div>
        {data.rows.length === 0 ? (
          <EmptyState icon={<IconBox className="h-6 w-6" />} title="Nothing to track yet" description="Add menu items, then set stock levels here to enable auto-86 and low-stock alerts." />
        ) : (
          <div className="divide-y divide-line">
            {data.rows.map((r) => (
              <div key={r.menuItemId} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className={`font-medium ${r.available ? "text-ink" : "text-muted line-through"}`}>{r.name}</span>
                    {r.tracked && r.stockLevel === 0 && <Badge tone="rose">Out</Badge>}
                    {r.tracked && r.low && r.stockLevel > 0 && <Badge tone="amber">Low</Badge>}
                    {!r.available && <Badge tone="slate">86</Badge>}
                  </div>
                  <div className="mt-0.5 text-xs text-muted">
                    {r.categoryName}
                    {r.tracked && <span> · reorder at {r.reorderPoint}</span>}
                  </div>
                </div>

                {r.tracked ? (
                  <>
                    <div className="flex items-center gap-1.5">
                      <IconButton
                        label="Decrease stock"
                        icon={<IconMinus className="h-4 w-4" />}
                        disabled={!!busy || r.stockLevel === 0}
                        onClick={() => adjust(r.menuItemId, -1)}
                      />
                      <span className={`w-10 text-center text-lg font-bold tabular-nums ${r.stockLevel === 0 ? "text-rose-500" : r.low ? "text-amber-600 dark:text-amber-400" : "text-ink"}`}>
                        {r.stockLevel}
                      </span>
                      <IconButton
                        label="Increase stock"
                        icon={<IconPlus className="h-4 w-4" />}
                        disabled={!!busy}
                        onClick={() => adjust(r.menuItemId, 1)}
                      />
                    </div>
                    <Button size="sm" variant="secondary" onClick={() => setEditing(r)}>
                      Set
                    </Button>
                  </>
                ) : (
                  <Button size="sm" variant="outline" onClick={() => setEditing(r)}>
                    Track stock
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="p-5">
        <h3 className="mb-3 text-sm font-semibold text-muted">Recent movements</h3>
        {data.movements.length === 0 ? (
          <div className="py-4 text-center text-sm text-muted">No stock movements yet.</div>
        ) : (
          <div className="divide-y divide-line">
            {data.movements.map((m) => (
              <div key={m.id} className="flex items-center gap-3 py-2 text-sm">
                <Badge tone={reasonTone(m.reason)}>{m.reason}</Badge>
                <span className="min-w-0 flex-1 truncate text-ink">{m.name}</span>
                <span className={`font-semibold tabular-nums ${m.delta < 0 ? "text-rose-500" : "text-emerald-600 dark:text-emerald-400"}`}>
                  {m.delta > 0 ? "+" : ""}
                  {m.delta}
                </span>
                <span className="w-28 text-right text-xs text-muted">{timeOf(m.createdAt)}</span>
              </div>
            ))}
          </div>
        )}
      </Card>

      {editing && (
        <SetStockModal
          key={editing.menuItemId}
          row={editing}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            await load();
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function SetStockModal({
  row,
  onClose,
  onSaved,
}: {
  row: InventoryReport["rows"][number];
  onClose: () => void;
  onSaved: () => Promise<void> | void;
}) {
  const toast = useToast();
  const [stockLevel, setStockLevel] = useState(String(row.stockLevel));
  const [reorderPoint, setReorderPoint] = useState(String(row.reorderPoint));
  const [saving, setSaving] = useState(false);

  async function save() {
    const stock = parseInt(stockLevel, 10);
    const reorder = parseInt(reorderPoint, 10);
    if (Number.isNaN(stock) || stock < 0 || Number.isNaN(reorder) || reorder < 0) {
      toast({ title: "Enter valid, non-negative numbers", tone: "error" });
      return;
    }
    setSaving(true);
    try {
      await api.post("/inventory/set", { menuItemId: row.menuItemId, stockLevel: stock, reorderPoint: reorder });
      toast({ title: "Stock updated", tone: "success" });
      await onSaved();
    } catch (e) {
      toast({ title: errMsg(e), tone: "error" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      size="sm"
      title={`Stock — ${row.name}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={saving} onClick={save}>
            Save
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-3">
        <Field label="On hand" hint="Set after a stock-take">
          <Input inputMode="numeric" value={stockLevel} onChange={(e) => setStockLevel(e.target.value)} />
        </Field>
        <Field label="Reorder at" hint="Low-stock alert level">
          <Input inputMode="numeric" value={reorderPoint} onChange={(e) => setReorderPoint(e.target.value)} />
        </Field>
      </div>
      <p className="mt-3 text-xs text-muted">Hitting zero auto-86’s the item everywhere; restocking above zero restores it.</p>
    </Modal>
  );
}

/* ------------------------------------------------------------------ customers */

function initials(name: string | null, fallback: string) {
  const src = name?.trim() || fallback;
  return src
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function Customers({ currency }: { currency: string }) {
  const [rows, setRows] = useState<CustomerDTO[] | null>(null);

  useEffect(() => {
    api.get<CustomerDTO[]>("/customers").then(setRows).catch(() => setRows([]));
  }, []);

  if (rows === null) {
    return (
      <Card className="divide-y divide-line">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 p-4">
            <Skeleton className="h-9 w-9 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-24" />
            </div>
            <Skeleton className="h-5 w-16" />
          </div>
        ))}
      </Card>
    );
  }

  if (rows.length === 0) {
    return (
      <EmptyState
        icon={<IconHeart className="h-6 w-6" />}
        title="No rewards customers yet"
        description="Customers who opt in to rewards at online checkout appear here with their visits, spend and points."
      />
    );
  }

  const totalPoints = rows.reduce((s, c) => s + c.points, 0);
  const marketable = rows.filter((c) => c.optInMarketing).length;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <Stat label="Members" value={String(rows.length)} />
        <Stat label="Points issued" value={String(totalPoints)} />
        <Stat label="Marketing opt-in" value={String(marketable)} />
      </div>

      <Card className="overflow-hidden">
        <div className="border-b border-line px-4 py-3">
          <h3 className="text-sm font-semibold text-muted">Rewards members</h3>
        </div>
        <div className="divide-y divide-line">
          {rows.map((c) => (
            <div key={c.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand/15 text-xs font-bold text-brand">
                {initials(c.name, c.contactMethod)}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-ink">{c.name ?? "Guest"}</span>
                  {c.optInMarketing && <Badge tone="green">Marketing</Badge>}
                </div>
                <div className="mt-0.5 truncate text-xs text-muted">
                  {c.contactMethod}
                  {c.lastVisit && <span> · last visit {timeOf(c.lastVisit)}</span>}
                </div>
              </div>
              <div className="flex items-center gap-5 text-right text-sm">
                <div>
                  <div className="font-semibold text-ink tabular-nums">{c.visits}</div>
                  <div className="text-[11px] uppercase tracking-wide text-muted">visits</div>
                </div>
                <div>
                  <div className="font-semibold text-ink tabular-nums">
                    <Money minor={c.totalSpendMinor} currency={currency} />
                  </div>
                  <div className="text-[11px] uppercase tracking-wide text-muted">spend</div>
                </div>
                <div>
                  <div className="font-semibold text-brand tabular-nums">{c.points}</div>
                  <div className="text-[11px] uppercase tracking-wide text-muted">points</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------------ cash / shifts */

function CashDrawer({ currency }: { currency: string }) {
  const toast = useToast();
  const [current, setCurrent] = useState<ShiftDTO | null | undefined>(undefined); // undefined = loading
  const [history, setHistory] = useState<ShiftDTO[] | null>(null);
  const [float, setFloat] = useState("");
  const [busy, setBusy] = useState(false);
  const [closing, setClosing] = useState(false);
  const [counted, setCounted] = useState("");

  const load = async () => {
    const [cur, list] = await Promise.all([
      api.get<ShiftDTO | null>("/shifts/current").catch(() => null),
      api.get<ShiftDTO[]>("/shifts").catch(() => []),
    ]);
    setCurrent(cur);
    setHistory(list);
  };
  useEffect(() => {
    load();
  }, []);

  async function openShift() {
    const floatMinor = Math.round(parseFloat(float || "0") * 100);
    if (Number.isNaN(floatMinor) || floatMinor < 0) {
      toast({ title: "Enter a valid opening float", tone: "error" });
      return;
    }
    setBusy(true);
    try {
      await api.post("/shifts/open", { openingFloatMinor: floatMinor });
      setFloat("");
      toast({ title: "Shift opened", tone: "success" });
      await load();
    } catch (e) {
      toast({ title: errMsg(e), tone: "error" });
    } finally {
      setBusy(false);
    }
  }

  async function closeShift() {
    if (!current) return;
    const countedMinor = Math.round(parseFloat(counted || "0") * 100);
    if (Number.isNaN(countedMinor) || countedMinor < 0) {
      toast({ title: "Enter the counted amount", tone: "error" });
      return;
    }
    setBusy(true);
    try {
      const closed = await api.post<ShiftDTO>(`/shifts/${current.id}/close`, { countedCashMinor: countedMinor });
      const v = closed.varianceMinor ?? 0;
      toast({
        title: v === 0 ? "Shift closed — drawer balanced" : `Shift closed — ${v > 0 ? "over" : "short"} ${Math.abs(v / 100).toFixed(2)}`,
        tone: v === 0 ? "success" : "error",
      });
      setClosing(false);
      setCounted("");
      await load();
    } catch (e) {
      toast({ title: errMsg(e), tone: "error" });
    } finally {
      setBusy(false);
    }
  }

  if (current === undefined || history === null) {
    return (
      <div className="space-y-4">
        <Card className="p-5">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="mt-3 h-20 w-full" />
        </Card>
      </div>
    );
  }

  const countedMinorPreview = Math.round(parseFloat(counted || "0") * 100);
  const variancePreview = current && !Number.isNaN(countedMinorPreview) ? countedMinorPreview - (current.expectedCashMinor ?? 0) : 0;

  return (
    <div className="space-y-4">
      {/* Current shift or open form */}
      {current ? (
        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="flex items-center gap-2 font-semibold text-ink">
                <IconCash className="h-4 w-4 text-brand" /> Drawer open
              </h3>
              <p className="mt-0.5 text-xs text-muted">
                Opened {timeOf(current.openedAt)}
                {current.openedByName && ` · ${current.openedByName}`}
              </p>
            </div>
            <Badge tone="green">OPEN</Badge>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Opening float" value={<Money minor={current.openingFloatMinor} currency={currency} />} />
            <Stat label="Cash sales" value={<Money minor={current.cashSalesMinor ?? 0} currency={currency} />} />
            <Stat label="Cash refunds" value={<Money minor={current.cashRefundsMinor ?? 0} currency={currency} />} />
            <Stat label="Expected in drawer" value={<Money minor={current.expectedCashMinor ?? 0} currency={currency} />} />
          </div>

          <div className="mt-4">
            <Button variant="secondary" onClick={() => setClosing(true)}>
              Close &amp; count drawer
            </Button>
          </div>
        </Card>
      ) : (
        <Card className="p-5">
          <h3 className="mb-1 flex items-center gap-2 font-semibold text-ink">
            <IconCash className="h-4 w-4 text-brand" /> Start a shift
          </h3>
          <p className="mb-3 text-sm text-muted">Count the cash you’re starting the drawer with, then open the shift.</p>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <Field label="Opening float" hint="Cash in the drawer to start">
              <Input inputMode="decimal" placeholder="0.00" value={float} onChange={(e) => setFloat(e.target.value)} />
            </Field>
            <Button loading={busy} onClick={openShift}>
              Open shift
            </Button>
          </div>
        </Card>
      )}

      {/* History */}
      <Card className="overflow-hidden">
        <div className="border-b border-line px-4 py-3">
          <h3 className="text-sm font-semibold text-muted">Shift history</h3>
        </div>
        {history.filter((s) => s.status === "CLOSED").length === 0 ? (
          <div className="py-6 text-center text-sm text-muted">No closed shifts yet.</div>
        ) : (
          <div className="divide-y divide-line">
            {history
              .filter((s) => s.status === "CLOSED")
              .map((s) => {
                const v = s.varianceMinor ?? 0;
                return (
                  <div key={s.id} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-ink">{timeOf(s.openedAt)}</div>
                      <div className="mt-0.5 text-xs text-muted">
                        {s.openedByName ?? "—"} · closed {s.closedAt ? timeOf(s.closedAt) : "—"}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-muted">Expected</div>
                      <div className="font-medium text-ink">
                        <Money minor={s.expectedCashMinor ?? 0} currency={currency} />
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-muted">Counted</div>
                      <div className="font-medium text-ink">
                        <Money minor={s.countedCashMinor ?? 0} currency={currency} />
                      </div>
                    </div>
                    <Badge tone={v === 0 ? "green" : v > 0 ? "amber" : "rose"}>
                      {v === 0 ? "Balanced" : `${v > 0 ? "+" : "−"}${Math.abs(v / 100).toFixed(2)}`}
                    </Badge>
                  </div>
                );
              })}
          </div>
        )}
      </Card>

      {/* Close modal */}
      <Modal
        open={closing}
        onClose={() => setClosing(false)}
        size="sm"
        title="Close drawer"
        footer={
          <>
            <Button variant="ghost" onClick={() => setClosing(false)}>
              Cancel
            </Button>
            <Button loading={busy} onClick={closeShift}>
              Close shift
            </Button>
          </>
        }
      >
        {current && (
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted">Expected in drawer</span>
              <span className="font-semibold text-ink">
                <Money minor={current.expectedCashMinor ?? 0} currency={currency} />
              </span>
            </div>
            <Field label="Counted cash" hint="Total cash you counted in the drawer">
              <Input inputMode="decimal" autoFocus placeholder="0.00" value={counted} onChange={(e) => setCounted(e.target.value)} />
            </Field>
            {counted && !Number.isNaN(countedMinorPreview) && (
              <div className={`flex justify-between rounded-lg px-3 py-2 text-sm font-medium ${
                variancePreview === 0
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                  : "bg-rose-500/10 text-rose-600 dark:text-rose-400"
              }`}>
                <span>{variancePreview === 0 ? "Balanced" : variancePreview > 0 ? "Over" : "Short"}</span>
                <span>
                  {variancePreview > 0 ? "+" : variancePreview < 0 ? "−" : ""}
                  <Money minor={Math.abs(variancePreview)} currency={currency} />
                </span>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}

/* ------------------------------------------------------------------ tables */

function Tables() {
  const [ctx, setCtx] = useState<Ctx | null>(null);
  const [qr, setQr] = useState<Record<string, string>>({});

  useEffect(() => {
    api.get<Ctx>("/context").then(async (c) => {
      setCtx(c);
      const tables = c.locations.flatMap((l) => l.tables);
      const entries = await Promise.all(
        tables.map(async (t) => [t.qrToken, await QRCode.toDataURL(`${window.location.origin}/t/${t.qrToken}`, { width: 160, margin: 1 })] as const),
      );
      setQr(Object.fromEntries(entries));
    });
  }, []);

  const tables = ctx?.locations.flatMap((l) => l.tables) ?? [];
  return (
    <div>
      <p className="mb-4 text-sm text-muted">Printable QR codes — a customer scans to order from their own phone (QR-01). No hardware.</p>
      {ctx === null ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 md:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Card key={i} className="p-3">
              <Skeleton className="mx-auto h-32 w-32" />
              <Skeleton className="mx-auto mt-2 h-4 w-16" />
            </Card>
          ))}
        </div>
      ) : tables.length === 0 ? (
        <EmptyState icon={<IconGrid className="h-6 w-6" />} title="No tables configured" description="Add tables to your location to generate scannable QR codes." />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 md:grid-cols-5">
          {tables.map((t) => (
            <Card key={t.id} className="p-3 text-center transition hover:shadow-lift">
              {qr[t.qrToken] ? (
                <img src={qr[t.qrToken]} alt={t.label} className="mx-auto h-32 w-32 rounded-lg" />
              ) : (
                <Skeleton className="mx-auto h-32 w-32" />
              )}
              <div className="mt-2 font-semibold text-ink">{t.label}</div>
              <a href={`/t/${t.qrToken}`} className="text-xs text-brand hover:underline">
                /t/{t.qrToken}
              </a>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ staff */

function Staff() {
  const org = useAuth((s) => s.organization);
  const [staff, setStaff] = useState<{ id: string; name: string; role: string }[] | null>(null);
  useEffect(() => {
    if (org) api.get<{ id: string; name: string; role: string }[]>(`/orgs/${org.slug}/staff`, false).then(setStaff).catch(() => setStaff([]));
  }, [org]);

  if (staff === null)
    return (
      <Card className="divide-y divide-line">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center justify-between p-4">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-5 w-16" />
          </div>
        ))}
      </Card>
    );

  if (staff.length === 0)
    return <EmptyState icon={<IconUsers className="h-6 w-6" />} title="No staff yet" description="Team members will appear here once added." />;

  return (
    <Card className="p-2">
      <div className="divide-y divide-line">
        {staff.map((s) => (
          <div key={s.id} className="flex items-center justify-between px-3 py-3">
            <div className="flex items-center gap-3">
              <span className="grid h-9 w-9 place-items-center rounded-full bg-brand/15 text-xs font-bold text-brand">
                {s.name
                  .split(/\s+/)
                  .map((w) => w[0])
                  .slice(0, 2)
                  .join("")
                  .toUpperCase()}
              </span>
              <span className="font-medium text-ink">{s.name}</span>
            </div>
            <Badge tone="brand">{s.role}</Badge>
          </div>
        ))}
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ settings */

function Settings() {
  const { organization, capabilities } = useAuth();
  const [ctx, setCtx] = useState<Ctx | null>(null);
  useEffect(() => {
    api.get<Ctx>("/context").then(setCtx).catch(() => undefined);
  }, []);
  const loc = ctx?.locations[0];
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Card className="p-5">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-muted">
          <IconStore className="h-4 w-4" /> Business
        </h3>
        <dl className="space-y-2 text-sm">
          <Row k="Name" v={organization?.name} />
          <Row k="Tier" v={organization?.tier} />
          <Row k="Type" v={organization?.businessType} />
          <Row k="Currency" v={organization?.currency} />
          <Row k="Tax" v={loc ? `${loc.taxJurisdiction} · ${(loc.taxRateBps / 100).toFixed(0)}% ${loc.taxInclusive ? "inclusive" : "on top"}` : "…"} />
        </dl>
      </Card>
      <Card className="p-5">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-muted">
          <IconCart className="h-4 w-4" /> Enabled capabilities
        </h3>
        <div className="flex flex-wrap gap-1.5">
          {capabilities &&
            Object.entries(capabilities.features)
              .filter(([, v]) => v)
              .map(([k]) => (
                <Badge key={k} tone="green">
                  {k}
                </Badge>
              ))}
          {capabilities?.quickMode && <Badge tone="amber">quickMode</Badge>}
          {!capabilities && <Skeleton className="h-6 w-40" />}
        </div>
      </Card>
    </div>
  );
}

function Row({ k, v }: { k: string; v?: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-muted">{k}</dt>
      <dd className="font-medium text-ink">{v ?? "—"}</dd>
    </div>
  );
}
