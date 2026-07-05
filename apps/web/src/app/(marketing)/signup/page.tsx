"use client";
/**
 * Merchant self-onboarding wizard (GAP-07) — the web front end of the PRD headline "15 minutes to
 * first sale" (PRD §5). A short guided flow (business type → currency → store → owner) that POSTs to
 * /onboarding/signup, drops the returned owner session into the auth store, and lands the merchant
 * straight in the POS. Styling follows the (staff)/login page and the shared ui.tsx primitives.
 */
import { Fragment, type ReactNode, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/store";
import { Badge, Button, Card, Field, Input, ThemeToggle } from "@/components/ui";
import {
  IconArrowRight,
  IconBolt,
  IconCheck,
  IconGlobe,
  IconGrid,
  IconSparkle,
  IconStore,
  IconUsers,
  IconWifiOff,
} from "@/components/icons";
import { BUSINESS_TYPES, CURRENCIES, type AuthResponse, type BusinessType, type Currency } from "@shopmaster/shared";

const BUSINESS_LABELS: Record<BusinessType, { label: string; hint: string }> = {
  TEA_STALL: { label: "Tea stall", hint: "One counter, cash and QR" },
  CAFE: { label: "Café", hint: "Coffee, food, table service" },
  BAR: { label: "Bar", hint: "Drinks and bar tabs" },
  RESTAURANT: { label: "Restaurant", hint: "Full table service" },
  FOOD_TRUCK: { label: "Food truck", hint: "On the move, pickup" },
  TAKEAWAY: { label: "Takeaway", hint: "Order ahead, pickup" },
  QSR: { label: "Quick service", hint: "Counter, fast turnaround" },
};

const CURRENCY_LABELS: Record<Currency, { label: string; hint: string }> = {
  AUD: { label: "Australian Dollar (AUD)", hint: "GST 10% added on top of prices" },
  NPR: { label: "Nepali Rupee (NPR)", hint: "VAT 13% included in prices" },
};

const STEPS = ["Business", "Currency", "Your store", "Owner account"] as const;

const STEP_META: { icon: ReactNode; eyebrow: string; title: string }[] = [
  { icon: <IconGrid className="h-5 w-5" />, eyebrow: "Tell us about you", title: "What kind of business is this?" },
  { icon: <IconGlobe className="h-5 w-5" />, eyebrow: "Money & tax", title: "Which currency do you sell in?" },
  { icon: <IconStore className="h-5 w-5" />, eyebrow: "Your brand", title: "Name your store" },
  { icon: <IconUsers className="h-5 w-5" />, eyebrow: "Almost there", title: "Create your owner account" },
];

export default function SignupPage() {
  const router = useRouter();
  const setSession = useAuth((s) => s.setSession);

  const [step, setStep] = useState(0);
  const [businessType, setBusinessType] = useState<BusinessType>("CAFE");
  const [currency, setCurrency] = useState<Currency>("AUD");
  const [orgName, setOrgName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const canContinue =
    step === 0
      ? Boolean(businessType)
      : step === 1
        ? Boolean(currency)
        : step === 2
          ? orgName.trim().length > 0
          : ownerName.trim().length > 0 &&
            /.+@.+\..+/.test(ownerEmail) &&
            password.length >= 8 &&
            /^\d{4,6}$/.test(pin);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const res = await api.post<AuthResponse>(
        "/onboarding/signup",
        { orgName: orgName.trim(), businessType, currency, ownerName: ownerName.trim(), ownerEmail: ownerEmail.trim(), password, pin },
        false,
      );
      setSession(res);
      router.push("/pos");
    } catch (err) {
      setError((err as Error).message || "Signup failed");
      setBusy(false);
    }
  }

  function next() {
    setError(null);
    if (step < STEPS.length - 1) setStep((s) => s + 1);
    else void submit();
  }

  const isLast = step === STEPS.length - 1;

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-bg px-4 py-10 text-ink">
      {/* Ambient brand glow — decorative only */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-gradient-to-b from-brand/10 to-transparent" />
      <div aria-hidden className="pointer-events-none absolute -top-24 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-brand/10 blur-3xl" />

      <div className="absolute right-4 top-4 z-10">
        <ThemeToggle />
      </div>

      <div className="relative z-10 w-full max-w-xl">
        {/* Header */}
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-brand text-white shadow-soft">
            <IconStore className="h-7 w-7" />
          </div>
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-brand">ShopMaster</div>
          <h1 className="mt-1 text-2xl font-bold text-ink sm:text-3xl">Set up your store</h1>
          <p className="mt-1 max-w-sm text-sm text-muted">
            From here to your first sale in about 15 minutes. No hardware needed.
          </p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            <Badge tone="green">
              <IconBolt className="h-3.5 w-3.5" /> 15-min setup
            </Badge>
            <Badge tone="blue">
              <IconWifiOff className="h-3.5 w-3.5" /> Works offline
            </Badge>
            <Badge tone="brand">
              <IconSparkle className="h-3.5 w-3.5" /> Free sample menu
            </Badge>
          </div>
        </div>

        {/* Progress stepper */}
        <div className="mb-5">
          <ol className="flex items-start">
            {STEPS.map((label, i) => {
              const done = i < step;
              const active = i === step;
              return (
                <Fragment key={label}>
                  <li className="flex flex-col items-center">
                    <div
                      className={`grid h-9 w-9 place-items-center rounded-full text-sm font-semibold transition ${
                        done
                          ? "bg-brand text-white shadow-soft"
                          : active
                            ? "border-2 border-brand bg-brand/10 text-brand"
                            : "border border-line bg-surface text-muted"
                      }`}
                    >
                      {done ? <IconCheck className="h-4 w-4" /> : <span>{i + 1}</span>}
                    </div>
                    <span
                      className={`mt-2 hidden max-w-[6rem] text-center text-[11px] leading-tight sm:block ${
                        active ? "font-semibold text-ink" : done ? "text-ink/70" : "text-muted"
                      }`}
                    >
                      {label}
                    </span>
                  </li>
                  {i < STEPS.length - 1 && (
                    <div className={`mt-4 h-0.5 flex-1 rounded-full transition ${i < step ? "bg-brand" : "bg-line"}`} />
                  )}
                </Fragment>
              );
            })}
          </ol>
          <div className="mt-2 text-center text-xs font-medium text-muted sm:hidden">
            Step {step + 1} of {STEPS.length} · {STEPS[step]}
          </div>
        </div>

        {/* Step card */}
        <Card className="p-6 sm:p-8">
          <div className="mb-5 flex items-center gap-3">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand/10 text-brand">{STEP_META[step].icon}</div>
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wide text-muted">{STEP_META[step].eyebrow}</div>
              <h2 className="text-lg font-bold text-ink">{STEP_META[step].title}</h2>
            </div>
          </div>

          <div className="space-y-4">
            {step === 0 && (
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                {BUSINESS_TYPES.map((bt) => {
                  const selected = businessType === bt;
                  return (
                    <button
                      key={bt}
                      type="button"
                      onClick={() => setBusinessType(bt)}
                      aria-pressed={selected}
                      className={`tap rounded-2xl border p-4 text-left transition ${
                        selected
                          ? "border-brand bg-brand/5 ring-2 ring-brand"
                          : "border-line bg-surface hover:border-brand/40 hover:bg-surface-2"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-ink">{BUSINESS_LABELS[bt].label}</div>
                          <div className="mt-0.5 text-xs text-muted">{BUSINESS_LABELS[bt].hint}</div>
                        </div>
                        <span
                          className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border transition ${
                            selected ? "border-brand bg-brand text-white" : "border-line text-transparent"
                          }`}
                        >
                          <IconCheck className="h-3 w-3" />
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {step === 1 && (
              <div>
                <div className="space-y-2.5">
                  {CURRENCIES.map((c) => {
                    const selected = currency === c;
                    return (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setCurrency(c)}
                        aria-pressed={selected}
                        className={`tap block w-full rounded-2xl border p-4 text-left transition ${
                          selected
                            ? "border-brand bg-brand/5 ring-2 ring-brand"
                            : "border-line bg-surface hover:border-brand/40 hover:bg-surface-2"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span
                            className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl text-xs font-bold tracking-tight transition ${
                              selected ? "bg-brand text-white" : "bg-surface-2 text-muted"
                            }`}
                          >
                            {c}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-semibold text-ink">{CURRENCY_LABELS[c].label}</div>
                            <div className="mt-0.5 text-xs text-muted">{CURRENCY_LABELS[c].hint}</div>
                          </div>
                          <span
                            className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border transition ${
                              selected ? "border-brand bg-brand text-white" : "border-line text-transparent"
                            }`}
                          >
                            <IconCheck className="h-3 w-3" />
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
                <p className="mt-3 text-xs text-muted">We set your tax defaults from this — you can change them later in Admin.</p>
              </div>
            )}

            {step === 2 && (
              <div>
                <Field label="Store name" hint="This is what customers see. We'll start you with a small sample menu you can edit.">
                  <Input
                    value={orgName}
                    onChange={(e) => setOrgName(e.target.value)}
                    placeholder="e.g. Himalayan Tea House"
                    autoFocus
                  />
                </Field>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-3">
                <Field label="Your name">
                  <Input value={ownerName} onChange={(e) => setOwnerName(e.target.value)} autoComplete="name" />
                </Field>
                <Field label="Email">
                  <Input
                    value={ownerEmail}
                    onChange={(e) => setOwnerEmail(e.target.value)}
                    type="email"
                    autoComplete="email"
                    placeholder="you@example.com"
                  />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Password">
                    <Input
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      type="password"
                      autoComplete="new-password"
                      placeholder="8+ characters"
                    />
                  </Field>
                  <Field label="Staff PIN">
                    <Input
                      className="tabular-nums"
                      value={pin}
                      onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      inputMode="numeric"
                      autoComplete="off"
                      placeholder="4–6 digits"
                    />
                  </Field>
                </div>
                <p className="text-xs text-muted">
                  Password signs you in online; the PIN is your quick, offline switch on the POS (Auth-Flow two-tier).
                </p>
              </div>
            )}

            {error && (
              <div className="rounded-xl border border-rose-500/25 bg-rose-500/10 px-3 py-2 text-sm font-medium text-rose-600 dark:text-rose-400">
                {error}
              </div>
            )}

            <div className="flex items-center justify-between gap-3 pt-1">
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setError(null);
                  setStep((s) => Math.max(0, s - 1));
                }}
                disabled={busy || step === 0}
              >
                Back
              </Button>
              <Button
                type="button"
                size="lg"
                onClick={next}
                loading={busy}
                icon={isLast ? <IconStore className="h-5 w-5" /> : <IconArrowRight className="h-5 w-5" />}
                disabled={busy || !canContinue}
              >
                {busy ? "Creating your store…" : isLast ? "Create store & start selling" : "Continue"}
              </Button>
            </div>
          </div>
        </Card>

        <p className="mt-5 text-center text-xs text-muted">
          Already have an account?{" "}
          <a href="/login" className="font-medium text-brand hover:underline">
            Sign in
          </a>
        </p>
      </div>
    </main>
  );
}
