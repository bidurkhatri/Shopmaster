"use client";
/**
 * Merchant self-onboarding wizard (GAP-07) — the web front end of the PRD headline "15 minutes to
 * first sale" (PRD §5). A short guided flow (business type → currency → store → owner) that POSTs to
 * /onboarding/signup, drops the returned owner session into the auth store, and lands the merchant
 * straight in the POS. Styling follows the (staff)/login page and the shared ui.tsx primitives.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/store";
import { Button, Card } from "@/components/ui";
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

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
      <Card className="w-full max-w-lg p-6">
        <div className="mb-1 text-sm font-semibold uppercase tracking-widest text-brand">ShopMaster</div>
        <h1 className="text-xl font-bold">Set up your store</h1>
        <p className="mt-1 text-sm text-slate-500">From here to your first sale in about 15 minutes. No hardware needed.</p>

        {/* Progress */}
        <div className="mt-5 flex items-center gap-2">
          {STEPS.map((label, i) => (
            <div key={label} className="flex-1">
              <div className={`h-1.5 rounded-full ${i <= step ? "bg-brand" : "bg-slate-200"}`} />
              <div className={`mt-1 text-[11px] ${i === step ? "font-semibold text-brand" : "text-slate-400"}`}>{label}</div>
            </div>
          ))}
        </div>

        <div className="mt-6 space-y-4">
          {step === 0 && (
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">What kind of business is this?</label>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {BUSINESS_TYPES.map((bt) => (
                  <button
                    key={bt}
                    type="button"
                    onClick={() => setBusinessType(bt)}
                    className={`tap rounded-xl border p-3 text-left ${
                      businessType === bt ? "border-brand bg-white ring-2 ring-brand" : "border-slate-200 bg-white hover:bg-slate-50"
                    }`}
                  >
                    <div className="text-sm font-semibold text-slate-900">{BUSINESS_LABELS[bt].label}</div>
                    <div className="mt-0.5 text-xs text-slate-500">{BUSINESS_LABELS[bt].hint}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 1 && (
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Which currency do you sell in?</label>
              <div className="space-y-2">
                {CURRENCIES.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCurrency(c)}
                    className={`tap block w-full rounded-xl border p-3 text-left ${
                      currency === c ? "border-brand bg-white ring-2 ring-brand" : "border-slate-200 bg-white hover:bg-slate-50"
                    }`}
                  >
                    <div className="text-sm font-semibold text-slate-900">{CURRENCY_LABELS[c].label}</div>
                    <div className="mt-0.5 text-xs text-slate-500">{CURRENCY_LABELS[c].hint}</div>
                  </button>
                ))}
              </div>
              <p className="mt-2 text-xs text-slate-400">We set your tax defaults from this — you can change them later in Admin.</p>
            </div>
          )}

          {step === 2 && (
            <div>
              <label className="mb-1 block text-sm text-slate-600">Store name</label>
              <input
                className="w-full rounded-xl border border-slate-200 px-3 py-2"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                placeholder="e.g. Himalayan Tea House"
                autoFocus
              />
              <p className="mt-2 text-xs text-slate-400">This is what customers see. We'll start you with a small sample menu you can edit.</p>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-sm text-slate-600">Your name</label>
                <input
                  className="w-full rounded-xl border border-slate-200 px-3 py-2"
                  value={ownerName}
                  onChange={(e) => setOwnerName(e.target.value)}
                  autoComplete="name"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-slate-600">Email</label>
                <input
                  className="w-full rounded-xl border border-slate-200 px-3 py-2"
                  value={ownerEmail}
                  onChange={(e) => setOwnerEmail(e.target.value)}
                  type="email"
                  autoComplete="email"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-sm text-slate-600">Password</label>
                  <input
                    className="w-full rounded-xl border border-slate-200 px-3 py-2"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    type="password"
                    autoComplete="new-password"
                    placeholder="8+ characters"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm text-slate-600">Staff PIN</label>
                  <input
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 tabular-nums"
                    value={pin}
                    onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    inputMode="numeric"
                    autoComplete="off"
                    placeholder="4–6 digits"
                  />
                </div>
              </div>
              <p className="text-xs text-slate-400">
                Password signs you in online; the PIN is your quick, offline switch on the POS (Auth-Flow two-tier).
              </p>
            </div>
          )}

          {error && <div className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>}

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
            <Button type="button" size="lg" onClick={next} disabled={busy || !canContinue}>
              {busy ? "Creating your store…" : step === STEPS.length - 1 ? "Create store & start selling" : "Continue"}
            </Button>
          </div>
        </div>

        <p className="mt-5 text-xs text-slate-400">
          Already have an account?{" "}
          <a href="/login" className="font-medium text-brand hover:underline">
            Sign in
          </a>
        </p>
      </Card>
    </main>
  );
}
