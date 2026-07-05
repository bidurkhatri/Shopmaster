import { Router } from "express";
import { prisma } from "@shopmaster/db";
import { getMenuTree } from "@shopmaster/core";
import { LOCALES, type Locale } from "@shopmaster/shared";
import { h, HttpError } from "../http.js";
import { orgToDTO } from "../dto-helpers.js";

/** Public, unauthenticated storefront + QR endpoints. Read-only org/menu/table info. */
export const orgsRouter = Router();

function localeFrom(q: unknown, fallback: string): Locale {
  const l = typeof q === "string" ? q : fallback;
  return (LOCALES as readonly string[]).includes(l) ? (l as Locale) : "en";
}

orgsRouter.get(
  "/orgs/:slug",
  h(async (req, res) => {
    const org = await prisma.organization.findUnique({ where: { slug: req.params.slug } });
    if (!org) throw new HttpError(404, "Store not found");
    res.json(orgToDTO(org));
  }),
);

orgsRouter.get(
  "/orgs/:slug/menu",
  h(async (req, res) => {
    const org = await prisma.organization.findUnique({ where: { slug: req.params.slug } });
    if (!org) throw new HttpError(404, "Store not found");
    res.json(await getMenuTree(org.id, localeFrom(req.query.locale, org.locale)));
  }),
);

/** Staff roster (id + name + role only) for the Tier-2 PIN switcher screen. */
orgsRouter.get(
  "/orgs/:slug/staff",
  h(async (req, res) => {
    const org = await prisma.organization.findUnique({ where: { slug: req.params.slug } });
    if (!org) throw new HttpError(404, "Store not found");
    const staff = await prisma.staffMember.findMany({
      where: { organizationId: org.id, active: true },
      select: { id: true, name: true, role: true },
      orderBy: { name: "asc" },
    });
    res.json(staff);
  }),
);

/** QR/NFC entry point (QR-01/02): resolve a table token to its store + menu. */
orgsRouter.get(
  "/tables/:qrToken",
  h(async (req, res) => {
    const table = await prisma.tableOrTab.findUnique({
      where: { qrToken: req.params.qrToken },
      include: { location: { include: { organization: true } } },
    });
    if (!table) throw new HttpError(404, "Table not found");
    const org = table.location.organization;
    res.json({
      table: { id: table.id, label: table.label, qrToken: table.qrToken },
      location: { id: table.location.id, name: table.location.name },
      organization: orgToDTO(org),
      menu: await getMenuTree(org.id, localeFrom(req.query.locale, org.locale)),
    });
  }),
);
