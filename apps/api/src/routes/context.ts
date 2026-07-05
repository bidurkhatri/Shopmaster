import { Router } from "express";
import { prisma } from "@shopmaster/db";
import { resolveCapabilities, type Tier, type BusinessType } from "@shopmaster/shared";
import { h, requireCtx } from "../http.js";
import { requireAuth } from "../auth-middleware.js";
import { orgToDTO } from "../dto-helpers.js";

/** Authenticated session context: org, locations (with tax config), tables, capabilities. */
export const contextRouter = Router();

contextRouter.get(
  "/context",
  requireAuth,
  h(async (req, res) => {
    const ctx = requireCtx(req);
    const org = await prisma.organization.findUnique({ where: { id: ctx.organizationId } });
    if (!org) {
      res.status(404).json({ error: "Organization not found" });
      return;
    }
    const locations = await prisma.location.findMany({
      where: { organizationId: ctx.organizationId },
      include: { tables: { orderBy: { label: "asc" } } },
    });
    res.json({
      organization: orgToDTO(org),
      capabilities: resolveCapabilities(org.tier as Tier, org.businessType as BusinessType),
      locations: locations.map((l) => ({
        id: l.id,
        name: l.name,
        currency: org.currency,
        taxJurisdiction: l.taxJurisdiction,
        taxRateBps: l.taxRateBps,
        taxInclusive: l.taxInclusive,
        tables: l.tables.map((t) => ({ id: t.id, label: t.label, qrToken: t.qrToken, status: t.status })),
      })),
    });
  }),
);
