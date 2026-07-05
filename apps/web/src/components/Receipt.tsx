"use client";
import { Button, Money } from "@/components/ui";
import { IconPrinter } from "@/components/icons";
import type { OrderDTO } from "@shopmaster/shared";

/** Human labels for the payment rails so a receipt reads "Paid (Card)" rather than "Paid (TYRO)". */
const RAIL_LABEL: Record<string, string> = {
  CASH: "Cash",
  CARD: "Card",
  TYRO: "Card",
  STRIPE: "Card",
  SQUARE: "Card",
  FONEPAY: "FonePay",
  ESEWA: "eSewa",
  KHALTI: "Khalti",
};

function railLabel(rail: string) {
  return RAIL_LABEL[rail] ?? rail.charAt(0) + rail.slice(1).toLowerCase();
}

/**
 * A clean, printable customer receipt. On screen it is theme-aware; when the browser prints,
 * a scoped stylesheet hides the rest of the page so only this receipt lands on paper.
 */
export function Receipt({
  order,
  storeName,
  tableLabel,
}: {
  order: OrderDTO;
  storeName?: string;
  tableLabel?: string | null;
}) {
  const currency = order.currency;
  const paid = order.payments?.find((p) => p.status === "CAPTURED") ?? order.payments?.[0];
  const when = order.createdAt ? new Date(order.createdAt) : null;

  return (
    <>
      <style
        dangerouslySetInnerHTML={{
          __html: `
@media print {
  body * { visibility: hidden !important; }
  .receipt-print, .receipt-print * { visibility: visible !important; }
  .receipt-print {
    position: absolute; left: 0; top: 0; right: 0; margin: 0 auto;
    max-width: 380px; box-shadow: none !important; border: none !important;
    background: #fff !important; color: #000 !important;
  }
  .receipt-noprint { display: none !important; }
  @page { margin: 12mm; }
}`,
        }}
      />
      <div className="receipt-print overflow-hidden rounded-2xl border border-line bg-surface shadow-soft">
        <div className="px-6 py-6">
          {/* Header */}
          <div className="text-center">
            {storeName && <div className="text-lg font-bold tracking-tight text-ink">{storeName}</div>}
            <div className="mt-0.5 text-xs uppercase tracking-widest text-muted">Receipt</div>
          </div>

          {/* Meta */}
          <div className="mt-4 flex flex-wrap justify-center gap-x-4 gap-y-1 text-center text-xs text-muted">
            <span>
              Order <span className="font-mono text-ink">#{order.id.slice(-8).toUpperCase()}</span>
            </span>
            {tableLabel && <span>Table {tableLabel}</span>}
            {when && <span>{when.toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}</span>}
          </div>

          <Dashed />

          {/* Items */}
          <div className="space-y-2.5">
            {order.items
              .filter((i) => !i.voided)
              .map((i) => (
                <div key={i.id} className="text-sm">
                  <div className="flex items-start justify-between gap-3">
                    <span className="text-ink">
                      <span className="mr-1 tabular-nums text-muted">{i.qty}&times;</span>
                      {i.nameSnapshot}
                    </span>
                    <span className="tabular-nums text-ink">
                      <Money minor={i.lineTotalMinor} currency={currency} />
                    </span>
                  </div>
                  {i.modifiers.length > 0 && (
                    <div className="mt-0.5 pl-5 text-xs text-muted">
                      {i.modifiers.map((m) => m.name).join(", ")}
                    </div>
                  )}
                </div>
              ))}
          </div>

          <Dashed />

          {/* Totals */}
          <div className="space-y-1 text-sm">
            <Row label="Subtotal" value={<Money minor={order.subtotalMinor} currency={currency} />} muted />
            <Row label="Tax" value={<Money minor={order.taxMinor} currency={currency} />} muted />
            <div className="flex items-center justify-between pt-1 text-base font-bold text-ink">
              <span>Total</span>
              <span className="tabular-nums">
                <Money minor={order.totalMinor} currency={currency} />
              </span>
            </div>
          </div>

          {order.paidMinor > 0 && (
            <>
              <Dashed />
              <div className="space-y-1 text-sm">
                <Row
                  label={paid ? `Paid (${railLabel(paid.rail)})` : "Paid"}
                  value={<Money minor={order.paidMinor} currency={currency} />}
                  strong
                />
                {order.balanceMinor > 0 && (
                  <Row label="Balance due" value={<Money minor={order.balanceMinor} currency={currency} />} />
                )}
              </div>
            </>
          )}

          <div className="mt-5 text-center text-xs text-muted">Thank you</div>

          {/* Print action — hidden on paper */}
          <div className="receipt-noprint mt-5">
            <Button
              variant="secondary"
              size="md"
              className="w-full"
              icon={<IconPrinter className="h-4 w-4" />}
              onClick={() => window.print()}
            >
              Print receipt
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}

function Dashed() {
  return <div className="my-4 border-t border-dashed border-line" />;
}

function Row({ label, value, muted, strong }: { label: string; value: React.ReactNode; muted?: boolean; strong?: boolean }) {
  return (
    <div className={`flex items-center justify-between ${muted ? "text-muted" : strong ? "font-semibold text-emerald-600 dark:text-emerald-400" : "text-ink"}`}>
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}
