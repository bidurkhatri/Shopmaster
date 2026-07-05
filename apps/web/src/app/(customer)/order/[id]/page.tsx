"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import { Card, Money, Badge } from "@/components/ui";
import type { OrderDTO } from "@shopmaster/shared";

const STATUS_LABEL: Record<string, string> = {
  OPEN: "Order started",
  CONFIRMED: "In the kitchen",
  READY: "Ready",
  CLOSED: "Completed",
  VOID: "Cancelled",
};
const STATUS_TONE: Record<string, "slate" | "amber" | "green" | "blue"> = {
  OPEN: "slate",
  CONFIRMED: "amber",
  READY: "green",
  CLOSED: "blue",
  VOID: "slate",
};

export default function OrderStatusPage() {
  const { id } = useParams<{ id: string }>();
  const [order, setOrder] = useState<OrderDTO | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = () =>
      api
        .get<OrderDTO>(`/public/orders/${id}`, false)
        .then(setOrder)
        .catch((e) => setError((e as Error).message));
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [id]);

  if (error) return <div className="flex min-h-screen items-center justify-center text-slate-400">Order not found.</div>;
  if (!order) return <div className="flex min-h-screen items-center justify-center text-slate-400">Loading…</div>;

  return (
    <div className="mx-auto max-w-md px-4 py-10">
      <Card className="p-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-400">Order</div>
            <div className="font-mono text-sm">{order.id.slice(-8)}</div>
          </div>
          <Badge tone={STATUS_TONE[order.status] ?? "slate"}>{STATUS_LABEL[order.status] ?? order.status}</Badge>
        </div>
        <div className="space-y-1 border-t border-slate-100 pt-3 text-sm">
          {order.items.map((i) => (
            <div key={i.id} className="flex justify-between">
              <span>{i.qty}× {i.nameSnapshot}</span>
              <Money minor={i.lineTotalMinor} currency={order.currency} />
            </div>
          ))}
        </div>
        <div className="mt-3 space-y-1 border-t border-slate-100 pt-3 text-sm">
          <div className="flex justify-between text-slate-500"><span>Subtotal</span><Money minor={order.subtotalMinor} currency={order.currency} /></div>
          <div className="flex justify-between text-slate-500"><span>Tax</span><Money minor={order.taxMinor} currency={order.currency} /></div>
          <div className="flex justify-between pt-1 text-base font-bold"><span>Total</span><Money minor={order.totalMinor} currency={order.currency} /></div>
          {order.paidMinor > 0 && <div className="flex justify-between text-emerald-600"><span>Paid</span><Money minor={order.paidMinor} currency={order.currency} /></div>}
        </div>
      </Card>
    </div>
  );
}
