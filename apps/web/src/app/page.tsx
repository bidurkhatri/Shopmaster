"use client";

import type { ComponentType } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, Card, Badge, SectionTitle, ThemeToggle } from "@/components/ui";
import {
  IconStore,
  IconReceipt,
  IconDevice,
  IconGrid,
  IconGlobe,
  IconMenuList,
  IconWifiOff,
  IconChart,
  IconUsers,
  IconBolt,
  IconCard,
  IconSettings,
  IconArrowRight,
  IconSparkle,
} from "@/components/icons";

type Icon = ComponentType<{ className?: string }>;
type Tone = "brand" | "blue" | "amber" | "green";

const TONE_BOX: Record<Tone, string> = {
  brand: "bg-brand/10 text-brand",
  blue: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  amber: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  green: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
};

// NOTE: "Point of sale" is asserted by an E2E test and must appear exactly once
// in the DOM — it lives only in the CHANNELS showcase title below.
const CHANNELS: { icon: Icon; short: string; title: string; tone: Tone; desc: string }[] = [
  { icon: IconReceipt, short: "POS", title: "Point of sale", tone: "brand", desc: "Quick mode for a one-person tea stall, full mode for a busy restaurant floor." },
  { icon: IconDevice, short: "Kiosk", title: "Self-service kiosk", tone: "blue", desc: "Locked-down, guided ordering that lets guests order and pay for themselves." },
  { icon: IconGrid, short: "QR tables", title: "QR / NFC tables", tone: "amber", desc: "Guests scan the table and order from their phone — straight to the kitchen." },
  { icon: IconGlobe, short: "Online", title: "Online ordering", tone: "green", desc: "Your own branded storefront for pickup or delivery, on any device." },
];

const FEATURES: { icon: Icon; title: string; desc: string }[] = [
  { icon: IconMenuList, title: "One kitchen queue", desc: "Every channel lands in a single KDS queue — no missed tickets, no double entry." },
  { icon: IconWifiOff, title: "Works offline", desc: "Orders keep flowing on flaky Wi-Fi and sync automatically the moment you reconnect." },
  { icon: IconChart, title: "Live reports", desc: "Sales, taxes and top items across every channel, updated in real time." },
  { icon: IconUsers, title: "Staff PIN switch", desc: "Owners sign in once; staff switch on-device by PIN, even fully offline." },
  { icon: IconBolt, title: "Built for speed", desc: "Thumb-friendly targets and instant totals tuned for tablets and the rush." },
  { icon: IconGlobe, title: "Any currency & locale", desc: "From NPR at a tea stall to AUD across forty tables — one codebase." },
  { icon: IconCard, title: "Cash & card", desc: "Take payment your way, with the rails that fit each region." },
  { icon: IconSettings, title: "Back-office admin", desc: "Menu, tables, QR codes, staff, tax and reports in one console." },
];

const PERSONAS: { icon: Icon; tone: Tone; name: string; detail: string; meta: string }[] = [
  { icon: IconStore, tone: "amber", name: "Himalayan Tea House", detail: "One-person tea stall · Kathmandu", meta: "NPR · Nepali menu · runs on a single phone" },
  { icon: IconReceipt, tone: "blue", name: "Harbour View Kitchen", detail: "40-table restaurant · Sydney", meta: "AUD · QR tables · full kitchen display" },
];

const STAFF: { href: string; tag: string; tone: Tone; title: string; desc: string; icon: Icon }[] = [
  { href: "/login", tag: "Staff", tone: "brand", title: "Sign in", desc: "Owner/manager login, then switch staff by PIN.", icon: IconUsers },
  { href: "/pos", tag: "POS", tone: "green", title: "POS terminal", desc: "Quick mode for a tea stall, full mode for a restaurant.", icon: IconReceipt },
  { href: "/kitchen", tag: "KDS", tone: "amber", title: "Kitchen display", desc: "One queue across POS, QR, kiosk and online.", icon: IconMenuList },
  { href: "/admin", tag: "Back office", tone: "blue", title: "Admin console", desc: "Menu, tables/QR codes, staff, tax, reports.", icon: IconSettings },
  { href: "/kiosk", tag: "Kiosk", tone: "brand", title: "Self-service kiosk", desc: "Locked-down guided ordering.", icon: IconDevice },
  { href: "/switch", tag: "Auth", tone: "green", title: "Staff PIN switch", desc: "Offline-capable Tier-2 login.", icon: IconBolt },
];

const CUSTOMER: { href: string; tag: string; tone: Tone; title: string; desc: string; icon: Icon }[] = [
  { href: "/t/hv-t1", tag: "QR / NFC", tone: "amber", title: "Scan a table (Table 1)", desc: "Harbour View Kitchen — order from your phone.", icon: IconGrid },
  { href: "/s/harbour-view", tag: "Online", tone: "blue", title: "Harbour View storefront", desc: "Branded online ordering, pickup or delivery.", icon: IconGlobe },
  { href: "/s/himalayan-tea", tag: "Online", tone: "amber", title: "Himalayan Tea House", desc: "Nepali tea stall — NPR, Nepali menu.", icon: IconStore },
];

const QUEUE = [
  { n: "#128", src: "POS", item: "Flat White ×2" },
  { n: "#129", src: "QR", item: "Chicken Momo · Table 7" },
  { n: "#130", src: "Online", item: "Masala Tea ×3" },
];

function QuickTile({ t }: { t: { href: string; tag: string; tone: Tone; title: string; desc: string; icon: Icon } }) {
  const Ico = t.icon;
  return (
    <Link href={t.href} className="tap group block">
      <Card className="flex h-full flex-col p-5 transition hover:-translate-y-0.5 hover:border-brand hover:shadow-lift">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-surface-2 text-muted transition group-hover:bg-brand/10 group-hover:text-brand">
            <Ico className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <Badge tone={t.tone}>{t.tag}</Badge>
            <div className="mt-1.5 font-semibold text-ink">{t.title}</div>
            <div className="mt-0.5 text-sm text-muted">{t.desc}</div>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-1 text-sm font-semibold text-brand opacity-0 transition group-hover:opacity-100">
          Open <IconArrowRight className="h-4 w-4" />
        </div>
      </Card>
    </Link>
  );
}

export default function Home() {
  const router = useRouter();
  const year = new Date().getFullYear();

  return (
    <div className="min-h-screen bg-bg text-ink">
      {/* ------------------------------------------------------------- nav */}
      <nav className="sticky top-0 z-30 border-b border-line bg-bg/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-5 py-3">
          <div className="flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand text-white shadow-soft">
              <IconStore className="h-5 w-5" />
            </span>
            <span className="text-lg font-bold tracking-tight">ShopMaster</span>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button variant="ghost" size="sm" className="hidden sm:inline-flex" onClick={() => router.push("/login")}>
              Sign in
            </Button>
            <Button size="sm" onClick={() => router.push("/signup")}>
              Get started
            </Button>
          </div>
        </div>
      </nav>

      <main>
        {/* ----------------------------------------------------------- hero */}
        <section className="relative overflow-hidden">
          <div aria-hidden className="pointer-events-none absolute inset-0">
            <div className="absolute -top-24 left-1/2 h-72 w-[46rem] max-w-full -translate-x-1/2 rounded-full bg-brand/20 blur-3xl" />
            <div className="absolute -bottom-32 right-0 h-72 w-72 rounded-full bg-brand-accent/10 blur-3xl" />
          </div>

          <div className="relative mx-auto max-w-6xl px-5 pb-14 pt-16 sm:pt-24">
            <div className="mx-auto max-w-3xl text-center">
              <Badge tone="brand">
                <IconSparkle className="h-3.5 w-3.5" /> One platform · four channels
              </Badge>
              <h1 className="mt-5 text-4xl font-extrabold tracking-tight sm:text-6xl">One order engine, four channels</h1>
              <p className="mx-auto mt-5 max-w-2xl text-lg text-muted">
                POS, self-service kiosk, QR/NFC table ordering and branded online ordering — the same menu, the same order,
                the same kitchen queue.
              </p>
              <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Button size="lg" className="w-full sm:w-auto" onClick={() => router.push("/signup")}>
                  Start free <IconArrowRight className="h-4 w-4" />
                </Button>
                <Button size="lg" variant="secondary" className="w-full sm:w-auto" onClick={() => router.push("/login")}>
                  Sign in
                </Button>
              </div>
              <p className="mt-4 text-sm text-muted">
                No card required · Runs a tea stall and a 40-table restaurant on the same codebase.
              </p>
            </div>

            {/* hero visual — four channels flowing into one queue */}
            <Card className="mx-auto mt-14 max-w-4xl p-6 sm:p-8">
              <div className="grid gap-6 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
                <div className="grid grid-cols-2 gap-3">
                  {CHANNELS.map((c) => {
                    const Ico = c.icon;
                    return (
                      <div key={c.short} className="flex items-center gap-2.5 rounded-xl border border-line bg-surface-2 px-3 py-2.5">
                        <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${TONE_BOX[c.tone]}`}>
                          <Ico className="h-4 w-4" />
                        </span>
                        <span className="truncate text-sm font-semibold">{c.short}</span>
                      </div>
                    );
                  })}
                </div>

                <div className="flex items-center justify-center">
                  <span className="grid h-11 w-11 place-items-center rounded-full border border-line bg-surface text-muted shadow-soft">
                    <IconArrowRight className="h-5 w-5 rotate-90 sm:rotate-0" />
                  </span>
                </div>

                <div className="rounded-2xl bg-gradient-to-br from-brand to-brand-accent p-5 text-white shadow-soft">
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <IconMenuList className="h-5 w-5" /> Kitchen queue
                  </div>
                  <div className="mt-3 space-y-2">
                    {QUEUE.map((q) => (
                      <div key={q.n} className="flex items-center justify-between gap-2 rounded-lg bg-white/10 px-3 py-2 text-sm">
                        <span className="truncate">
                          <span className="font-semibold tabular-nums">{q.n}</span>
                          <span className="text-white/80"> · {q.item}</span>
                        </span>
                        <span className="shrink-0 rounded-full bg-white/20 px-2 py-0.5 text-[11px] font-semibold">{q.src}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </section>

        {/* ------------------------------------------------ four channels */}
        <section className="mx-auto max-w-6xl px-5 py-16">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight">Four channels, one order</h2>
            <p className="mt-3 text-muted">Sell however your guests want to order. It all becomes the same order, in the same queue.</p>
          </div>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {CHANNELS.map((c) => {
              const Ico = c.icon;
              return (
                <Card key={c.title} className="p-6">
                  <span className={`grid h-12 w-12 place-items-center rounded-2xl ${TONE_BOX[c.tone]}`}>
                    <Ico className="h-6 w-6" />
                  </span>
                  <div className="mt-4 text-lg font-semibold">{c.title}</div>
                  <p className="mt-1.5 text-sm text-muted">{c.desc}</p>
                </Card>
              );
            })}
          </div>
        </section>

        {/* ---------------------------------------------------- features */}
        <section className="border-y border-line bg-surface/60">
          <div className="mx-auto max-w-6xl px-5 py-16">
            <div className="mx-auto max-w-2xl text-center">
              <Badge tone="brand">
                <IconBolt className="h-3.5 w-3.5" /> Everything included
              </Badge>
              <h2 className="mt-4 text-3xl font-bold tracking-tight">Built to run the whole shop</h2>
              <p className="mt-3 text-muted">One system for the counter, the floor, the kitchen and the back office.</p>
            </div>
            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {FEATURES.map((f) => {
                const Ico = f.icon;
                return (
                  <div key={f.title} className="rounded-2xl border border-line bg-surface p-5 shadow-soft">
                    <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand/10 text-brand">
                      <Ico className="h-5 w-5" />
                    </span>
                    <div className="mt-3 font-semibold">{f.title}</div>
                    <p className="mt-1 text-sm text-muted">{f.desc}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* --------------------------------- tea stall ↔ 40-table band */}
        <section className="mx-auto max-w-6xl px-5 py-16">
          <Card className="overflow-hidden">
            <div className="grid lg:grid-cols-2">
              <div className="bg-brand p-8 text-white sm:p-10">
                <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-0.5 text-xs font-medium">
                  <IconSparkle className="h-3.5 w-3.5" /> Same codebase
                </span>
                <h2 className="mt-4 text-3xl font-bold tracking-tight">One system. Every kind of shop.</h2>
                <p className="mt-4 max-w-md text-white/80">
                  From a one-person tea stall in Nepal to a forty-table restaurant in Sydney — ShopMaster scales from a single
                  phone to a full floor without changing tools.
                </p>
                <div className="mt-6 flex flex-wrap gap-2">
                  {["NPR & AUD", "Offline-first", "Multi-tenant"].map((chip) => (
                    <span key={chip} className="rounded-full bg-white/15 px-3 py-1 text-xs font-medium">
                      {chip}
                    </span>
                  ))}
                </div>
              </div>
              <div className="grid gap-4 p-8 sm:p-10">
                {PERSONAS.map((p) => {
                  const Ico = p.icon;
                  return (
                    <div key={p.name} className="flex items-start gap-4 rounded-2xl border border-line bg-surface-2 p-4">
                      <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${TONE_BOX[p.tone]}`}>
                        <Ico className="h-5 w-5" />
                      </span>
                      <div className="min-w-0">
                        <div className="font-semibold">{p.name}</div>
                        <div className="mt-0.5 text-sm text-muted">{p.detail}</div>
                        <div className="mt-1 text-xs text-muted">{p.meta}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </Card>
        </section>

        {/* ---------------------------------------------- quick links */}
        <section className="border-t border-line bg-surface-2/40">
          <div className="mx-auto max-w-6xl px-5 py-16">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-2xl font-bold tracking-tight">Jump straight in</h2>
              <p className="mt-2 text-muted">Explore the live demo surfaces — no setup required.</p>
            </div>

            <div className="mt-10">
              <SectionTitle>Staff surfaces</SectionTitle>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {STAFF.map((t) => (
                  <QuickTile key={t.href} t={t} />
                ))}
              </div>
            </div>

            <div className="mt-10">
              <SectionTitle>Customer surfaces</SectionTitle>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {CUSTOMER.map((t) => (
                  <QuickTile key={t.href} t={t} />
                ))}
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* ------------------------------------------------------ footer */}
      <footer className="border-t border-line bg-bg">
        <div className="mx-auto max-w-6xl px-5 py-12">
          <Card className="p-6">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <IconUsers className="h-4 w-4 text-brand" /> Demo logins
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-line bg-surface-2 p-4">
                <div className="text-sm font-semibold">Restaurant owner</div>
                <div className="mt-2 space-y-1.5 text-sm text-muted">
                  <div>
                    Email <code className="rounded border border-line bg-surface px-1.5 py-0.5 font-mono text-[13px] text-ink">owner@harbour-view.test</code>
                  </div>
                  <div>
                    Password <code className="rounded border border-line bg-surface px-1.5 py-0.5 font-mono text-[13px] text-ink">password123</code>
                  </div>
                  <div>Staff PINs 1111–5555</div>
                </div>
              </div>
              <div className="rounded-xl border border-line bg-surface-2 p-4">
                <div className="text-sm font-semibold">Tea stall owner</div>
                <div className="mt-2 space-y-1.5 text-sm text-muted">
                  <div>
                    Email <code className="rounded border border-line bg-surface px-1.5 py-0.5 font-mono text-[13px] text-ink">owner@himalayan-tea.test</code>
                  </div>
                  <div>
                    Password <code className="rounded border border-line bg-surface px-1.5 py-0.5 font-mono text-[13px] text-ink">password123</code>
                  </div>
                  <div>PIN 1234</div>
                </div>
              </div>
            </div>
            <div className="mt-5 flex flex-wrap gap-3">
              <Button size="sm" onClick={() => router.push("/login")}>
                Sign in
              </Button>
              <Button size="sm" variant="secondary" onClick={() => router.push("/signup")}>
                Create an account
              </Button>
            </div>
          </Card>
          <div className="mt-6 text-center text-xs text-muted">
            © {year} ShopMaster · One order engine for cafes, bars, restaurants and food trucks.
          </div>
        </div>
      </footer>
    </div>
  );
}
