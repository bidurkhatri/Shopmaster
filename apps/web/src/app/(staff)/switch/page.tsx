"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/store";
import { Button, Card, EmptyState, Skeleton } from "@/components/ui";
import { IconDevice, IconUsers } from "@/components/icons";
import type { AuthResponse } from "@shopmaster/shared";

function initialsOf(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

/** Tier-2 offline staff switch: select a name, enter a PIN (Auth-Flow B1–B3). */
export default function SwitchPage() {
  const router = useRouter();
  const { organization, setSession } = useAuth();
  const [staff, setStaff] = useState<{ id: string; name: string; role: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<{ id: string; name: string } | null>(null);
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!organization) return;
    setLoading(true);
    api
      .get<{ id: string; name: string; role: string }[]>(`/orgs/${organization.slug}/staff`, false)
      .then(setStaff)
      .finally(() => setLoading(false));
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
      <main className="flex min-h-screen items-center justify-center bg-bg px-4 text-ink">
        <Card className="w-full max-w-sm p-6">
          <EmptyState
            icon={<IconDevice className="h-6 w-6" />}
            title="Device not paired"
            description="Pair this device with your shop before staff can sign in by PIN."
            action={
              <Link href="/login">
                <Button size="lg">Go to sign in</Button>
              </Link>
            }
          />
        </Card>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-bg px-4 text-ink">
      <Card className="w-full max-w-sm p-6">
        <div className="mb-4 flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand text-sm font-bold text-white shadow-soft">
            {initialsOf(organization.name)}
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-lg font-bold text-ink">{organization.name}</h1>
            <p className="text-sm text-muted">{selected ? `PIN for ${selected.name}` : "Who's on shift?"}</p>
          </div>
        </div>

        {!selected ? (
          loading ? (
            <div className="grid grid-cols-2 gap-2">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-[4.5rem]" />
              ))}
            </div>
          ) : staff.length === 0 ? (
            <EmptyState
              icon={<IconUsers className="h-6 w-6" />}
              title="No staff yet"
              description="Add staff members in Admin to enable PIN sign-in."
            />
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {staff.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setSelected(s)}
                  className="tap flex items-center gap-2.5 rounded-xl border border-line bg-surface p-3 text-left hover:border-brand hover:bg-surface-2"
                >
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand/15 text-xs font-bold text-brand">
                    {initialsOf(s.name)}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-ink">{s.name}</span>
                    <span className="block truncate text-xs capitalize text-muted">{s.role}</span>
                  </span>
                </button>
              ))}
            </div>
          )
        ) : (
          <>
            <div className="mb-4 flex justify-center gap-2.5">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className={`h-3.5 w-3.5 rounded-full transition-colors ${pin.length > i ? "bg-brand" : "bg-surface-2 ring-1 ring-line"}`}
                />
              ))}
            </div>
            {error && (
              <div className="mb-3 rounded-xl border border-rose-500/25 bg-rose-500/10 px-3 py-2 text-center text-sm font-medium text-rose-600 dark:text-rose-400">
                {error}
              </div>
            )}
            <div className="grid grid-cols-3 gap-2">
              {["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "⌫"].map((k, idx) => (
                <button
                  key={idx}
                  disabled={k === ""}
                  onClick={() => {
                    if (k === "⌫") setPin((p) => p.slice(0, -1));
                    else if (k) setPin((p) => (p.length < 6 ? p + k : p));
                  }}
                  className="tap rounded-xl bg-surface-2 py-4 text-lg font-semibold text-ink hover:bg-surface hover:ring-1 hover:ring-line disabled:opacity-0"
                >
                  {k}
                </button>
              ))}
            </div>
            <Button size="lg" className="mt-4 w-full" onClick={submit} disabled={pin.length < 3}>
              Unlock
            </Button>
            <button
              onClick={() => {
                setSelected(null);
                setPin("");
                setError(null);
              }}
              className="tap mt-2 w-full rounded-lg py-2 text-sm font-medium text-muted hover:text-ink"
            >
              ← Someone else
            </button>
          </>
        )}
      </Card>
    </main>
  );
}
