"use client";
import { useEffect, useState, useCallback } from "react";
import { StaffShell } from "@/components/StaffShell";
import { Button, Card, Badge } from "@/components/ui";
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

function Kitchen() {
  const [orders, setOrders] = useState<OrderDTO[]>([]);

  const load = useCallback(() => {
    api.get<OrderDTO[]>("/kitchen").then(setOrders).catch(() => undefined);
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
  }, [load]);

  async function setStatus(id: string, status: "READY" | "CLOSED") {
    await api.post(`/orders/${id}/status`, { status });
    load();
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h1 className="text-lg font-bold">Kitchen Display</h1>
        <span className="text-sm text-slate-400">{orders.length} active</span>
      </div>
      {orders.length === 0 && (
        <div className="rounded-2xl border border-dashed border-slate-200 py-16 text-center text-slate-400">
          No active tickets. Confirmed orders from POS, QR, kiosk and online appear here.
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {orders.map((o) => (
          <Card key={o.id} className={`flex flex-col p-4 ${o.status === "READY" ? "border-emerald-300" : ""}`}>
            <div className="mb-2 flex items-center justify-between">
              <Badge tone={CHANNEL_TONE[o.channel] ?? "slate"}>{o.channel}</Badge>
              <span className="text-xs text-slate-400">{new Date(o.createdAt).toLocaleTimeString()}</span>
            </div>
            <div className="mb-1 text-sm font-semibold">
              {o.tableLabel ? `Table ${o.tableLabel}` : o.fulfillment === "PICKUP" ? "Pickup" : o.fulfillment === "DELIVERY" ? "Delivery" : "Counter"}
              {o.customerName ? ` · ${o.customerName}` : ""}
            </div>
            <ul className="flex-1 space-y-1 py-2 text-sm">
              {o.items.map((i) => (
                <li key={i.id} className="flex justify-between">
                  <span>
                    <span className="font-semibold text-brand">{i.qty}×</span> {i.nameSnapshot}
                  </span>
                  <span className="text-xs text-slate-400">{i.station}</span>
                </li>
              ))}
            </ul>
            <div className="mt-2 flex gap-2">
              {o.status !== "READY" ? (
                <Button size="sm" className="flex-1" onClick={() => setStatus(o.id, "READY")}>
                  Mark ready
                </Button>
              ) : (
                <Button size="sm" variant="secondary" className="flex-1" onClick={() => setStatus(o.id, "CLOSED")}>
                  Bump / done
                </Button>
              )}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
