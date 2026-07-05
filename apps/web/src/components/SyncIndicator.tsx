"use client";
import { useEffect, useState } from "react";
import { subscribeOutbox, pendingCount, lastSyncAt, startOutboxSync } from "@/lib/outbox";
import { useAuth } from "@/lib/store";

/** Always-visible sync status (SYNC-05 / FE-11): online/offline, outbox depth, last sync. */
export function SyncIndicator() {
  const deviceId = useAuth((s) => s.deviceId);
  const [online, setOnline] = useState(true);
  const [pending, setPending] = useState(0);
  const [last, setLast] = useState<string | null>(null);

  useEffect(() => {
    startOutboxSync(deviceId ?? undefined);
    const refresh = () => {
      setOnline(typeof navigator === "undefined" ? true : navigator.onLine);
      void pendingCount().then(setPending);
      setLast(lastSyncAt());
    };
    refresh();
    const unsub = subscribeOutbox(refresh);
    const onNet = () => refresh();
    window.addEventListener("online", onNet);
    window.addEventListener("offline", onNet);
    const t = setInterval(refresh, 3000);
    return () => {
      unsub();
      window.removeEventListener("online", onNet);
      window.removeEventListener("offline", onNet);
      clearInterval(t);
    };
  }, [deviceId]);

  return (
    <div className="flex items-center gap-2 text-xs">
      <span className={`h-2 w-2 rounded-full ${online ? "bg-emerald-500" : "bg-rose-500"}`} />
      <span className="font-medium text-slate-600">{online ? "Online" : "Offline"}</span>
      {pending > 0 && (
        <span className="rounded-full bg-amber-100 px-2 py-0.5 font-medium text-amber-800">{pending} queued</span>
      )}
      {last && <span className="hidden text-slate-400 sm:inline">· synced {new Date(last).toLocaleTimeString()}</span>}
    </div>
  );
}
