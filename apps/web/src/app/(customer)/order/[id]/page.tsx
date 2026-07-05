"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import { Card, Badge, Skeleton, EmptyState } from "@/components/ui";
import { IconReceipt, IconClock, IconCheck } from "@/components/icons";
import { Receipt } from "@/components/Receipt";
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
const STATUS_HINT: Record<string, string> = {
  OPEN: "We've received your order.",
  CONFIRMED: "The kitchen is preparing your order.",
  READY: "Your order is ready!",
  CLOSED: "Thanks for your order.",
  VOID: "This order was cancelled.",
};
/** Progress steps for the visual tracker. */
const STEPS = [
  { key: "CONFIRMED", label: "In the kitchen" },
  { key: "READY", label: "Ready" },
  { key: "CLOSED", label: "Completed" },
];
const STEP_INDEX: Record<string, number> = { OPEN: 0, CONFIRMED: 0, READY: 1, CLOSED: 2 };

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

  if (error)
    return (
      <div className="mx-auto max-w-md px-4 py-16">
        <EmptyState icon={<IconReceipt className="h-6 w-6" />} title="Order not found" description="We couldn't find this order. It may have expired." />
      </div>
    );

  if (!order)
    return (
      <div className="mx-auto max-w-md space-y-4 px-4 py-10">
        <Card className="space-y-4 p-6">
          <div className="flex items-center justify-between">
            <Skeleton className="h-10 w-32" />
            <Skeleton className="h-6 w-24 rounded-full" />
          </div>
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-24 w-full" />
        </Card>
      </div>
    );

  const activeStep = STEP_INDEX[order.status] ?? 0;
  const isVoid = order.status === "VOID";

  return (
    <div className="min-h-screen bg-bg">
      <div className="mx-auto max-w-md space-y-4 px-4 py-10">
        {/* Status */}
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-muted">
              <IconClock className="h-5 w-5" />
              <span className="text-sm font-medium">Order status</span>
            </div>
            <Badge tone={STATUS_TONE[order.status] ?? "slate"}>{STATUS_LABEL[order.status] ?? order.status}</Badge>
          </div>

          <p className="mt-3 text-lg font-semibold text-ink">{STATUS_HINT[order.status] ?? ""}</p>

          {!isVoid && (
            <ol className="mt-5 flex items-center">
              {STEPS.map((step, i) => {
                const done = i < activeStep;
                const active = i === activeStep && order.status !== "OPEN";
                const reached = done || active || i <= activeStep;
                return (
                  <li key={step.key} className="flex flex-1 items-center last:flex-none">
                    <div className="flex flex-col items-center">
                      <div
                        className={`grid h-8 w-8 place-items-center rounded-full border-2 text-xs font-bold ${
                          done
                            ? "border-brand bg-brand text-white"
                            : active
                              ? "border-brand text-brand"
                              : "border-line text-muted"
                        }`}
                      >
                        {done ? <IconCheck className="h-4 w-4" /> : i + 1}
                      </div>
                      <span className={`mt-1.5 text-[11px] font-medium ${reached ? "text-ink" : "text-muted"}`}>{step.label}</span>
                    </div>
                    {i < STEPS.length - 1 && <div className={`mx-1 h-0.5 flex-1 rounded-full ${i < activeStep ? "bg-brand" : "bg-line"}`} />}
                  </li>
                );
              })}
            </ol>
          )}
        </Card>

        {/* Receipt */}
        <Receipt order={order} tableLabel={order.tableLabel} />
      </div>
    </div>
  );
}
