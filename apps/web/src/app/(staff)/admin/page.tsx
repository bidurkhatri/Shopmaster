"use client";
import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { StaffShell } from "@/components/StaffShell";
import { Button, Card, Money, Badge } from "@/components/ui";
import { api, API_BASE } from "@/lib/api";
import { useAuth } from "@/lib/store";
import type { MenuCategoryDTO, SalesReport, StaffDTO } from "@shopmaster/shared";

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

const TABS = ["Dashboard", "Menu", "Tables", "Staff", "Settings"] as const;
type Tab = (typeof TABS)[number];

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

  const visibleTabs = TABS.filter((t) => {
    if (t === "Tables") return capabilities?.features.tables;
    if (t === "Staff") return capabilities?.features.staffRoles;
    return true;
  });

  return (
    <div>
      <h1 className="mb-3 text-lg font-bold">Back office</h1>
      <div className="mb-4 flex flex-wrap gap-1 border-b border-slate-200">
        {visibleTabs.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${tab === t ? "border-brand text-brand" : "border-transparent text-slate-500 hover:text-slate-700"}`}
          >
            {t}
          </button>
        ))}
      </div>
      {tab === "Dashboard" && <Dashboard currency={organization?.currency ?? "AUD"} />}
      {tab === "Menu" && <MenuAdmin />}
      {tab === "Tables" && <Tables />}
      {tab === "Staff" && <Staff />}
      {tab === "Settings" && <Settings />}
    </div>
  );
}

function Dashboard({ currency }: { currency: string }) {
  const [r, setR] = useState<SalesReport | null>(null);
  useEffect(() => {
    api.get<SalesReport>("/reports/sales").then(setR).catch(() => undefined);
  }, []);
  if (!r) return <div className="text-slate-400">Loading report…</div>;
  const maxRail = Math.max(1, ...r.byRail.map((x) => x.amountMinor));
  const maxDay = Math.max(1, ...r.byDay.map((x) => x.amountMinor));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi label="Orders" value={String(r.orderCount)} />
        <Kpi label="Gross" value={<Money minor={r.grossMinor} currency={currency} />} />
        <Kpi label="Tax" value={<Money minor={r.taxMinor} currency={currency} />} />
        <Kpi label="Net" value={<Money minor={r.netMinor} currency={currency} />} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-4">
          <h3 className="mb-3 text-sm font-semibold text-slate-600">Payment mix (per rail)</h3>
          <div className="space-y-2">
            {r.byRail.map((x) => (
              <div key={x.rail}>
                <div className="mb-1 flex justify-between text-sm">
                  <span>{x.rail}</span>
                  <span className="text-slate-500"><Money minor={x.amountMinor} currency={currency} /> · {x.count}</span>
                </div>
                <div className="h-2 rounded-full bg-slate-100">
                  <div className="h-2 rounded-full bg-brand" style={{ width: `${(x.amountMinor / maxRail) * 100}%` }} />
                </div>
              </div>
            ))}
            {r.byRail.length === 0 && <div className="text-sm text-slate-400">No payments yet.</div>}
          </div>
        </Card>
        <Card className="p-4">
          <h3 className="mb-3 text-sm font-semibold text-slate-600">Sales by day</h3>
          <div className="flex h-32 items-end gap-1">
            {r.byDay.map((d) => (
              <div key={d.date} className="flex flex-1 flex-col items-center gap-1" title={`${d.date}: ${d.orderCount} orders`}>
                <div className="w-full rounded-t bg-brand/80" style={{ height: `${(d.amountMinor / maxDay) * 100}%` }} />
                <div className="text-[10px] text-slate-400">{d.date.slice(5)}</div>
              </div>
            ))}
            {r.byDay.length === 0 && <div className="text-sm text-slate-400">No sales yet.</div>}
          </div>
        </Card>
      </div>
      <Card className="p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-600">Top items</h3>
          <a href={`${API_BASE}/reports/sales.csv`} className="text-sm font-medium text-brand" onClick={(e) => downloadCsv(e)}>
            Export CSV
          </a>
        </div>
        <table className="w-full text-sm">
          <tbody>
            {r.topItems.map((i) => (
              <tr key={i.name} className="border-t border-slate-100">
                <td className="py-1.5">{i.name}</td>
                <td className="py-1.5 text-right text-slate-500">{i.qty}×</td>
                <td className="py-1.5 text-right"><Money minor={i.revenueMinor} currency={currency} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

async function downloadCsv(e: React.MouseEvent) {
  e.preventDefault();
  const token = useAuth.getState().token;
  const res = await fetch(`${API_BASE}/reports/sales.csv`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "shopmaster-sales.csv";
  a.click();
  URL.revokeObjectURL(url);
}

function Kpi({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <Card className="p-4">
      <div className="text-xs uppercase tracking-wide text-slate-400">{label}</div>
      <div className="mt-1 text-xl font-bold text-slate-800">{value}</div>
    </Card>
  );
}

function MenuAdmin() {
  const [menu, setMenu] = useState<MenuCategoryDTO[]>([]);
  const [nameEn, setNameEn] = useState("");
  const [price, setPrice] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const currency = useAuth((s) => s.organization?.currency ?? "AUD");

  const load = () => api.get<MenuCategoryDTO[]>("/menu").then(setMenu);
  useEffect(() => {
    load();
  }, []);

  async function toggle86(id: string, available: boolean) {
    await api.post(`/menu/items/${id}/availability`, { available: !available });
    load();
  }
  async function addItem() {
    if (!nameEn || !categoryId || !price) return;
    await api.post("/menu/items", { categoryId, nameEn, priceMinor: Math.round(parseFloat(price) * 100) });
    setNameEn("");
    setPrice("");
    load();
  }

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <h3 className="mb-2 text-sm font-semibold text-slate-600">Add item</h3>
        <div className="flex flex-wrap gap-2">
          <select className="rounded-lg border border-slate-200 px-3 py-2 text-sm" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="">Category…</option>
            {menu.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <input placeholder="Name" value={nameEn} onChange={(e) => setNameEn(e.target.value)} className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm" />
          <input placeholder="Price" value={price} onChange={(e) => setPrice(e.target.value)} className="w-24 rounded-lg border border-slate-200 px-3 py-2 text-sm" />
          <Button onClick={addItem}>Add</Button>
        </div>
      </Card>
      {menu.map((c) => (
        <Card key={c.id} className="p-4">
          <h3 className="mb-2 font-semibold">{c.name}</h3>
          <div className="divide-y divide-slate-100">
            {c.items.map((it) => (
              <div key={it.id} className="flex items-center gap-3 py-2">
                <div className="flex-1">
                  <span className={`font-medium ${it.available ? "" : "text-slate-400 line-through"}`}>{it.name}</span>
                  <span className="ml-2 text-sm text-slate-400"><Money minor={it.priceMinor} currency={currency} /></span>
                </div>
                {!it.available && <Badge tone="rose">86</Badge>}
                <Button size="sm" variant={it.available ? "secondary" : "primary"} onClick={() => toggle86(it.id, it.available)}>
                  {it.available ? "Mark 86" : "Restore"}
                </Button>
              </div>
            ))}
          </div>
        </Card>
      ))}
    </div>
  );
}

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
      <p className="mb-3 text-sm text-slate-500">Printable QR codes — a customer scans to order from their own phone (QR-01). No hardware.</p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 md:grid-cols-5">
        {tables.map((t) => (
          <Card key={t.id} className="p-3 text-center">
            {qr[t.qrToken] ? <img src={qr[t.qrToken]} alt={t.label} className="mx-auto h-32 w-32" /> : <div className="mx-auto h-32 w-32 animate-pulse rounded bg-slate-100" />}
            <div className="mt-1 font-semibold">{t.label}</div>
            <a href={`/t/${t.qrToken}`} className="text-xs text-brand">/t/{t.qrToken}</a>
          </Card>
        ))}
      </div>
    </div>
  );
}

function Staff() {
  const org = useAuth((s) => s.organization);
  const [staff, setStaff] = useState<{ id: string; name: string; role: string }[]>([]);
  useEffect(() => {
    if (org) api.get<{ id: string; name: string; role: string }[]>(`/orgs/${org.slug}/staff`, false).then(setStaff);
  }, [org]);
  return (
    <Card className="p-4">
      <div className="divide-y divide-slate-100">
        {staff.map((s) => (
          <div key={s.id} className="flex items-center justify-between py-2">
            <span className="font-medium">{s.name}</span>
            <Badge>{s.role}</Badge>
          </div>
        ))}
      </div>
    </Card>
  );
}

function Settings() {
  const { organization, capabilities } = useAuth();
  const [ctx, setCtx] = useState<Ctx | null>(null);
  useEffect(() => {
    api.get<Ctx>("/context").then(setCtx);
  }, []);
  const loc = ctx?.locations[0];
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Card className="p-4">
        <h3 className="mb-2 text-sm font-semibold text-slate-600">Business</h3>
        <dl className="space-y-1 text-sm">
          <Field k="Name" v={organization?.name} />
          <Field k="Tier" v={organization?.tier} />
          <Field k="Type" v={organization?.businessType} />
          <Field k="Currency" v={organization?.currency} />
          <Field k="Tax" v={loc ? `${loc.taxJurisdiction} · ${(loc.taxRateBps / 100).toFixed(0)}% ${loc.taxInclusive ? "inclusive" : "on top"}` : "…"} />
        </dl>
      </Card>
      <Card className="p-4">
        <h3 className="mb-2 text-sm font-semibold text-slate-600">Enabled capabilities</h3>
        <div className="flex flex-wrap gap-1.5">
          {capabilities &&
            Object.entries(capabilities.features)
              .filter(([, v]) => v)
              .map(([k]) => <Badge key={k} tone="green">{k}</Badge>)}
          {capabilities?.quickMode && <Badge tone="amber">quickMode</Badge>}
        </div>
      </Card>
    </div>
  );
}

function Field({ k, v }: { k: string; v?: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-slate-400">{k}</dt>
      <dd className="font-medium text-slate-700">{v ?? "—"}</dd>
    </div>
  );
}
