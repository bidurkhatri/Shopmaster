"use client";
import { useEffect, useState, useCallback } from "react";
import { StaffShell } from "@/components/StaffShell";
import { Button, Card, Badge, EmptyState } from "@/components/ui";
import { IconClock, IconReceipt, IconCheck, IconBolt } from "@/components/icons";
import { api } from "@/lib/api";
import type { OrderDTO } from "@shopmaster/shared";

export default function KitchenPage() {
  return (
    <StaffShell>
      <Kitchen />
    </StaffShell>
  );
}

const CHANNEL_TONE: Record<string, "blue" | "green" | "amber" | "slate"> = {
  POS: "slate",
  QR: "blue",
  KIOSK: "amber",
  ONLINE: "green",
};

const CHANNEL_LABEL: Record<string, string> = {
  POS: "POS",
  QR: "QR",
  KIOSK: "Kiosk",
  ONLINE: "Online",
};

const STATION: Record<string, { tone: "amber" | "blue" | "slate"; dot: string; label: string }> = {
  KITCHEN: { tone: "amber", dot: "bg-amber-500", label: "Kitchen" },
  BAR: { tone: "blue", dot: "bg-blue-500", label: "Bar" },
};

/** Left-edge accent colour: emerald when ready, station-tinted when single-station, brand when mixed. */
function accentClass(o: OrderDTO): string {
  if (o.status === "READY") return "bg-emerald-400";
  const stations = new Set(o.items.map((i) => i.station));
  if (stations.size === 1) {
    const only = [...stations][0];
    if (only === "BAR") return "bg-blue-400";
    if (only === "KITCHEN") return "bg-amber-400";
  }
  return "bg-brand";
}

function destinationOf(o: OrderDTO): string {
  const where = o.tableLabel
    ? `Table ${o.tableLabel}`
    : o.fulfillment === "PICKUP"
      ? "Pickup"
      : o.fulfillment === "DELIVERY"
        ? "Delivery"
        : "Counter";
  return o.customerName ? `${where} · ${o.customerName}` : where;
}

function formatElapsed(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

/** Freshness tone that escalates with wait time; ready tickets stay green. */
function ageTone(ms: number, ready: boolean): "green" | "amber" | "rose" | "slate" {
  if (ready) return "green";
  const min = ms / 60000;
  if (min >= 10) return "rose";
  if (min >= 5) return "amber";
  return "slate";
}

function Kitchen() {
  const [orders, setOrders] = useState<OrderDTO[]>([]);
  const [now, setNow] = useState(() => Date.now());

  const load = useCallback(() => {
    api.get<OrderDTO[]>("/kitchen").then(setOrders).catch(() => undefined);
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
  }, [load]);

  // Live clock — drives the per-ticket elapsed badge, one tick per second.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  async function setStatus(id: string, status: "READY" | "CLOSED") {
    await api.post(`/orders/${id}/status`, { status });
    load();
  }

  const readyCount = orders.filter((o) => o.status === "READY").length;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="text-lg font-bold">Kitchen Display</h1>
        <div className="flex items-center gap-2">
          {readyCount > 0 && (
            <Badge tone="green">
              <IconCheck className="h-3.5 w-3.5" />
              {readyCount} ready
            </Badge>
          )}
          <Badge tone="brand">{orders.length} active</Badge>
        </div>
      </div>

      {orders.length === 0 ? (
        <EmptyState
          icon={<IconReceipt className="h-6 w-6" />}
          title="Queue is clear"
          description="No active tickets. Confirmed orders from POS, QR, kiosk and online appear here in real time."
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {orders.map((o) => {
            const ready = o.status === "READY";
            const elapsed = now - new Date(o.createdAt).getTime();
            const tone = ageTone(elapsed, ready);
            return (
              <Card
                key={o.id}
                className={`relative flex flex-col overflow-hidden p-0 transition-shadow ${
                  ready ? "border-emerald-400/60 bg-emerald-500/[0.06] ring-2 ring-emerald-400/50" : "hover:shadow-lift"
                }`}
              >
                <span className={`absolute inset-y-0 left-0 w-1.5 ${accentClass(o)}`} aria-hidden />

                <div className="flex flex-1 flex-col p-4 pl-5">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <Badge tone={CHANNEL_TONE[o.channel] ?? "slate"}>{CHANNEL_LABEL[o.channel] ?? o.channel}</Badge>
                    <Badge tone={tone}>
                      <IconClock className="h-3.5 w-3.5" />
                      <span className="tabular-nums">{formatElapsed(elapsed)}</span>
                    </Badge>
                  </div>

                  <div className="mb-2 flex items-baseline justify-between gap-2">
                    <div className="truncate text-sm font-semibold text-ink">{destinationOf(o)}</div>
                    <div className="shrink-0 text-xs tabular-nums text-muted">{new Date(o.createdAt).toLocaleTimeString()}</div>
                  </div>

                  {ready && (
                    <div className="mb-2">
                      <Badge tone="green">
                        <IconCheck className="h-3.5 w-3.5" />
                        Ready
                      </Badge>
                    </div>
                  )}

                  <ul className="flex-1 space-y-1.5 border-t border-line py-3 text-sm">
                    {o.items.map((i) => {
                      const st = STATION[i.station];
                      return (
                        <li key={i.id} className={`flex items-start justify-between gap-2 ${i.voided ? "line-through opacity-40" : ""}`}>
                          <span className="min-w-0">
                            <span className="mr-1 font-semibold text-brand">{i.qty}×</span>
                            <span className="text-ink">{i.nameSnapshot}</span>
                            {i.modifiers.length > 0 && (
                              <span className="block text-xs text-muted">{i.modifiers.map((m) => m.name).join(", ")}</span>
                            )}
                          </span>
                          <span className="mt-0.5 inline-flex shrink-0 items-center gap-1 text-xs text-muted">
                            <span className={`h-1.5 w-1.5 rounded-full ${st?.dot ?? "bg-surface-2"}`} aria-hidden />
                            {st?.label ?? i.station}
                          </span>
                        </li>
                      );
                    })}
                  </ul>

                  <div className="mt-auto flex gap-2">
                    {!ready ? (
                      <Button size="sm" className="flex-1" icon={<IconCheck className="h-4 w-4" />} onClick={() => setStatus(o.id, "READY")}>
                        Mark ready
                      </Button>
                    ) : (
                      <Button size="sm" variant="secondary" className="flex-1" icon={<IconBolt className="h-4 w-4" />} onClick={() => setStatus(o.id, "CLOSED")}>
                        Bump / done
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
