"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/store";
import { Button, Card } from "@/components/ui";
import type { AuthResponse } from "@shopmaster/shared";

/** Tier-2 offline staff switch: select a name, enter a PIN (Auth-Flow B1–B3). */
export default function SwitchPage() {
  const router = useRouter();
  const { organization, setSession } = useAuth();
  const [staff, setStaff] = useState<{ id: string; name: string; role: string }[]>([]);
  const [selected, setSelected] = useState<{ id: string; name: string } | null>(null);
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (organization) api.get<{ id: string; name: string; role: string }[]>(`/orgs/${organization.slug}/staff`, false).then(setStaff);
  }, [organization]);

  async function submit() {
    if (!selected) return;
    try {
      const res = await api.post<AuthResponse>("/auth/pin", { staffId: selected.id, pin }, false);
      setSession(res);
      router.push("/pos");
    } catch {
      setError("Wrong PIN");
      setPin("");
    }
  }

  if (!organization) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 text-slate-500">
        <p>Pair this device first.</p>
        <Link href="/login" className="font-medium text-brand">Go to sign in →</Link>
      </div>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-sm p-6">
        <h1 className="mb-1 text-lg font-bold">{organization.name}</h1>
        {!selected ? (
          <>
            <p className="mb-3 text-sm text-slate-500">Who's on shift?</p>
            <div className="grid grid-cols-2 gap-2">
              {staff.map((s) => (
                <button key={s.id} onClick={() => setSelected(s)} className="tap rounded-xl border border-slate-200 p-3 text-left hover:border-brand">
                  <div className="text-sm font-semibold">{s.name}</div>
                  <div className="text-xs text-slate-400">{s.role}</div>
                </button>
              ))}
            </div>
          </>
        ) : (
          <>
            <p className="mb-3 text-sm text-slate-500">PIN for {selected.name}</p>
            <div className="mb-3 flex justify-center gap-2">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className={`h-4 w-4 rounded-full ${pin.length > i ? "bg-brand" : "bg-slate-200"}`} />
              ))}
            </div>
            {error && <div className="mb-2 text-center text-sm text-rose-600">{error}</div>}
            <div className="grid grid-cols-3 gap-2">
              {["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "⌫"].map((k, idx) => (
                <button
                  key={idx}
                  disabled={k === ""}
                  onClick={() => {
                    if (k === "⌫") setPin((p) => p.slice(0, -1));
                    else if (k) setPin((p) => (p.length < 6 ? p + k : p));
                  }}
                  className="tap rounded-xl bg-slate-100 py-4 text-lg font-semibold disabled:opacity-0"
                >
                  {k}
                </button>
              ))}
            </div>
            <Button size="lg" className="mt-3 w-full" onClick={submit} disabled={pin.length < 3}>
              Unlock
            </Button>
            <button onClick={() => { setSelected(null); setPin(""); setError(null); }} className="mt-2 w-full text-sm text-slate-400">
              ← Someone else
            </button>
          </>
        )}
      </Card>
    </main>
  );
}
