import { Router } from "express";
import { getMenuTree, createCategory, createItem, setItemAvailability } from "@shopmaster/core";
import { zUpsertCategory, zUpsertItem, LOCALES, type Locale } from "@shopmaster/shared";
import { h, requireCtx } from "../http.js";
import { requireAuth, requirePermission } from "../auth-middleware.js";

export const menuRouter = Router();

function locale(q: unknown): Locale {
  const l = typeof q === "string" ? q : "en";
  return (LOCALES as readonly string[]).includes(l) ? (l as Locale) : "en";
}

menuRouter.get(
  "/menu",
  requireAuth,
  h(async (req, res) => {
    const ctx = requireCtx(req);
    res.json(await getMenuTree(ctx.organizationId, locale(req.query.locale)));
  }),
);

menuRouter.post(
  "/menu/categories",
  requireAuth,
  requirePermission("menu.manage"),
  h(async (req, res) => {
    const ctx = requireCtx(req);
    const input = zUpsertCategory.parse(req.body);
    res.status(201).json(await createCategory(ctx, input));
  }),
);

menuRouter.post(
  "/menu/items",
  requireAuth,
  requirePermission("menu.manage"),
  h(async (req, res) => {
    const ctx = requireCtx(req);
    const input = zUpsertItem.parse(req.body);
    res.status(201).json(await createItem(ctx, input));
  }),
);

/** One-tap 86 (MENU-04). */
menuRouter.post(
  "/menu/items/:id/availability",
  requireAuth,
  requirePermission("menu.manage"),
  h(async (req, res) => {
    const ctx = requireCtx(req);
    const available = Boolean(req.body?.available);
    res.json(await setItemAvailability(ctx, req.params.id, available));
  }),
);
