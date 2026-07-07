import { Router } from "express";
import { prisma } from "@shopmaster/db";
import { salesReport } from "@shopmaster/core";
import { resolveCapabilities, formatMoney, type Tier, type BusinessType } from "@shopmaster/shared";
import { h, requireCtx } from "../http.js";
import { requireAuth, requirePermission } from "../auth-middleware.js";

export const reportsRouter = Router();

function range(req: { query: Record<string, unknown> }) {
  const to = typeof req.query.to === "string" ? new Date(req.query.to) : new Date();
  const from = typeof req.query.from === "string" ? new Date(req.query.from) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const locationId = typeof req.query.locationId === "string" && req.query.locationId ? req.query.locationId : undefined;
  return { from, to, locationId };
}

reportsRouter.get(
  "/reports/sales",
  requireAuth,
  requirePermission("reports.view"),
  h(async (req, res) => {
    const ctx = requireCtx(req);
    const { from, to, locationId } = range(req);
    res.json(await salesReport(ctx, from, to, locationId));
  }),
);

/** CSV export for handoff to an accountant (RPT-02). */
reportsRouter.get(
  "/reports/sales.csv",
  requireAuth,
  requirePermission("reports.view"),
  h(async (req, res) => {
    const ctx = requireCtx(req);
    const { from, to, locationId } = range(req);
    const report = await salesReport(ctx, from, to, locationId);
    const rows = [
      ["ShopMaster sales report"],
      ["From", report.from, "To", report.to],
      [],
      ["Metric", "Value"],
      ["Orders", String(report.orderCount)],
      ["Gross", formatMoney(report.grossMinor, report.currency)],
      ["Tax", formatMoney(report.taxMinor, report.currency)],
      ["Net", formatMoney(report.netMinor, report.currency)],
      ["Tips", formatMoney(report.tipsMinor, report.currency)],
      [],
      ["Payment rail", "Amount", "Count"],
      ...report.byRail.map((r) => [r.rail, formatMoney(r.amountMinor, report.currency), String(r.count)]),
      [],
      ["Channel", "Amount", "Count"],
      ...report.byChannel.map((c) => [c.channel, formatMoney(c.amountMinor, report.currency), String(c.count)]),
      [],
      ["Top item", "Qty", "Revenue"],
      ...report.topItems.map((i) => [i.name, String(i.qty), formatMoney(i.revenueMinor, report.currency)]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", 'attachment; filename="shopmaster-sales.csv"');
    res.send(csv);
  }),
);

/** Capability manifest for the current org (FE-06). */
reportsRouter.get(
  "/capabilities",
  requireAuth,
  h(async (req, res) => {
    const ctx = requireCtx(req);
    const org = await prisma.organization.findUnique({ where: { id: ctx.organizationId } });
    if (!org) {
      res.status(404).json({ error: "Organization not found" });
      return;
    }
    res.json(resolveCapabilities(org.tier as Tier, org.businessType as BusinessType));
  }),
);
