/**
 * Reporting & Analytics (RPT-01..04). Daily sales, item mix, payment mix (broken out per rail so a
 * silent failure in one rail is visible, PLAT-12), and channel mix. Includes orders that were taken
 * during offline periods once they've synced (RPT-04) — nothing is dropped, because the data is the
 * materialized result of the event log.
 */
import { prisma } from "@shopmaster/db";
import type { SalesReport, Channel, PaymentRail, Currency } from "@shopmaster/shared";
import type { TenantContext } from "./tenancy.js";

export async function salesReport(ctx: TenantContext, from: Date, to: Date, locationId?: string): Promise<SalesReport> {
  const org = await prisma.organization.findUnique({ where: { id: ctx.organizationId } });
  const currency = (org?.currency ?? "AUD") as Currency;

  const orders = await prisma.order.findMany({
    where: {
      organizationId: ctx.organizationId,
      ...(locationId ? { locationId } : {}), // MULTI: scope to one location when asked
      createdAt: { gte: from, lte: to },
      status: { in: ["CLOSED", "CONFIRMED", "READY"] },
    },
    include: { items: true, payments: true },
  });

  let grossMinor = 0;
  let taxMinor = 0;
  let tipsMinor = 0;
  const railMap = new Map<string, { amountMinor: number; count: number }>();
  const channelMap = new Map<string, { amountMinor: number; count: number }>();
  const itemMap = new Map<string, { qty: number; revenueMinor: number }>();
  const dayMap = new Map<string, { amountMinor: number; orderCount: number }>();

  for (const o of orders) {
    grossMinor += o.totalMinor;
    taxMinor += o.taxMinor;

    const ch = channelMap.get(o.channel) ?? { amountMinor: 0, count: 0 };
    ch.amountMinor += o.totalMinor;
    ch.count += 1;
    channelMap.set(o.channel, ch);

    const day = o.createdAt.toISOString().slice(0, 10);
    const d = dayMap.get(day) ?? { amountMinor: 0, orderCount: 0 };
    d.amountMinor += o.totalMinor;
    d.orderCount += 1;
    dayMap.set(day, d);

    for (const it of o.items) {
      if (it.voided) continue;
      const im = itemMap.get(it.nameSnapshot) ?? { qty: 0, revenueMinor: 0 };
      im.qty += it.qty;
      im.revenueMinor += it.lineTotalMinor;
      itemMap.set(it.nameSnapshot, im);
    }

    for (const p of o.payments) {
      if (p.status !== "CAPTURED") continue;
      tipsMinor += p.tipMinor;
      const r = railMap.get(p.rail) ?? { amountMinor: 0, count: 0 };
      r.amountMinor += p.amountMinor;
      r.count += 1;
      railMap.set(p.rail, r);
    }
  }

  return {
    currency,
    from: from.toISOString(),
    to: to.toISOString(),
    orderCount: orders.length,
    grossMinor,
    taxMinor,
    netMinor: grossMinor - taxMinor,
    tipsMinor,
    byRail: [...railMap.entries()].map(([rail, v]) => ({ rail: rail as PaymentRail, ...v })).sort((a, b) => b.amountMinor - a.amountMinor),
    byChannel: [...channelMap.entries()].map(([channel, v]) => ({ channel: channel as Channel, ...v })).sort((a, b) => b.amountMinor - a.amountMinor),
    topItems: [...itemMap.entries()]
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.revenueMinor - a.revenueMinor)
      .slice(0, 8),
    byDay: [...dayMap.entries()].map(([date, v]) => ({ date, ...v })).sort((a, b) => a.date.localeCompare(b.date)),
  };
}
