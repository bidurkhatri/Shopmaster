"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/store";
import { Button, Card, Field, Input, ThemeToggle } from "@/components/ui";
import { IconStore } from "@/components/icons";
import type { AuthResponse } from "@shopmaster/shared";

export default function LoginPage() {
  const router = useRouter();
  const setSession = useAuth((s) => s.setSession);
  const [email, setEmail] = useState("owner@harbour-view.test");
  const [password, setPassword] = useState("password123");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await api.post<AuthResponse>("/auth/login", { email, password }, false);
      setSession(res);
      router.push("/pos");
    } catch (err) {
      setError((err as Error).message || "Login failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center bg-bg px-4 text-ink">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-brand text-white shadow-soft">
            <IconStore className="h-7 w-7" />
          </div>
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-brand">ShopMaster</div>
          <h1 className="mt-1 text-2xl font-bold text-ink">Welcome back</h1>
          <p className="mt-1 text-sm text-muted">Sign in to open the register.</p>
        </div>

        <Card className="p-6">
          <form onSubmit={submit} className="space-y-4">
            <Field label="Email">
              <Input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                autoComplete="username"
                placeholder="you@example.com"
              />
            </Field>
            <Field label="Password">
              <Input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
              />
            </Field>
            {error && (
              <div className="rounded-xl border border-rose-500/25 bg-rose-500/10 px-3 py-2 text-sm font-medium text-rose-600 dark:text-rose-400">
                {error}
              </div>
            )}
            <Button type="submit" size="lg" className="w-full" loading={busy}>
              Sign in
            </Button>
          </form>
        </Card>

        <p className="mt-4 px-2 text-center text-xs text-muted">
          Tier-1 login (owner/manager). Staff switch by PIN happens on-device, offline (Auth-Flow).
        </p>
      </div>
    </main>
  );
}
