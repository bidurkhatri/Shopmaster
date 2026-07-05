import Link from "next/link";

function Tile({ href, title, desc, tag }: { href: string; title: string; desc: string; tag: string }) {
  return (
    <Link
      href={href}
      className="tap block rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:border-brand hover:shadow-md"
    >
      <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-brand">{tag}</div>
      <div className="text-lg font-semibold text-slate-900">{title}</div>
      <div className="mt-1 text-sm text-slate-500">{desc}</div>
    </Link>
  );
}

export default function Home() {
  return (
    <main className="mx-auto max-w-5xl px-5 py-10">
      <header className="mb-8">
        <div className="text-sm font-semibold uppercase tracking-widest text-brand">ShopMaster</div>
        <h1 className="mt-1 text-3xl font-bold text-slate-900">One order engine, four channels</h1>
        <p className="mt-2 max-w-2xl text-slate-600">
          POS, self-service kiosk, QR/NFC table ordering and branded online ordering — the same menu,
          the same order, the same kitchen queue. Built to run a one-person tea stall in Nepal and a
          forty-table restaurant in Sydney on the same codebase.
        </p>
      </header>

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Staff surfaces</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Tile href="/login" tag="Staff" title="Sign in" desc="Owner/manager login, then switch staff by PIN." />
          <Tile href="/pos" tag="POS" title="Point of sale" desc="Quick mode for a tea stall, full mode for a restaurant." />
          <Tile href="/kitchen" tag="KDS" title="Kitchen display" desc="One queue across POS, QR, kiosk and online." />
          <Tile href="/admin" tag="Back office" title="Admin console" desc="Menu, tables/QR codes, staff, tax, reports." />
          <Tile href="/kiosk" tag="Kiosk" title="Self-service kiosk" desc="Locked-down guided ordering." />
          <Tile href="/switch" tag="Auth" title="Staff PIN switch" desc="Offline-capable Tier-2 login." />
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Customer surfaces</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Tile href="/t/hv-t1" tag="QR / NFC" title="Scan a table (Table 1)" desc="Harbour View Kitchen — order from your phone." />
          <Tile href="/s/harbour-view" tag="Online" title="Harbour View storefront" desc="Branded online ordering, pickup or delivery." />
          <Tile href="/s/himalayan-tea" tag="Online" title="Himalayan Tea House" desc="Nepali tea stall — NPR, Nepali menu." />
        </div>
      </section>

      <footer className="mt-10 rounded-2xl bg-slate-100 p-5 text-sm text-slate-600">
        <div className="font-semibold text-slate-800">Demo logins</div>
        <div className="mt-1">
          Restaurant owner: <code className="rounded bg-white px-1">owner@harbour-view.test</code> /{" "}
          <code className="rounded bg-white px-1">password123</code> · staff PINs 1111–5555
        </div>
        <div>
          Tea stall owner: <code className="rounded bg-white px-1">owner@himalayan-tea.test</code> /{" "}
          <code className="rounded bg-white px-1">password123</code> · PIN 1234
        </div>
      </footer>
    </main>
  );
}
