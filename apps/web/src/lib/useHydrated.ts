/**
 * True once the persisted auth store has rehydrated from localStorage. Guards against the
 * hydration race where `token` reads null on the first client render (before rehydration) and
 * a naive `if (!token) redirect` would bounce an authenticated user to /login.
 *
 * Starts false (SSR-safe) and resolves in an effect on the client only.
 */
"use client";
import { useEffect, useState } from "react";
import { useAuth } from "./store";

export function useHydrated(): boolean {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    const p = useAuth.persist;
    if (!p) {
      setHydrated(true);
      return;
    }
    setHydrated(p.hasHydrated());
    const unsub = p.onFinishHydration(() => setHydrated(true));
    return unsub;
  }, []);
  return hydrated;
}
