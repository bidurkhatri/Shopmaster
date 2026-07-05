"use client";
import { useEffect, useState } from "react";
import { subscribeOutbox, pendingCount, lastSyncAt, startOutboxSync } from "@/lib/outbox";
import { useAuth } from "@/lib/store";
import { Badge } from "@/components/ui";
import { IconWifi, IconWifiOff, IconClock } from "@/components/icons";

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
      <span
        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-medium ${
          online
            ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
            : "border-rose-500/25 bg-rose-500/10 text-rose-600 dark:text-rose-400"
        }`}
      >
        {online ? <IconWifi className="h-3.5 w-3.5" /> : <IconWifiOff className="h-3.5 w-3.5" />}
        {online ? "Online" : "Offline"}
      </span>
      {pending > 0 && (
        <Badge tone="amber">
          <IconClock className="h-3 w-3" />
          {pending} queued
        </Badge>
      )}
      {last && (
        <span className="hidden text-muted lg:inline">· synced {new Date(last).toLocaleTimeString()}</span>
      )}
    </div>
  );
}
