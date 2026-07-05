import { Router } from "express";
import { z } from "zod";
import {
  getMenuTree,
  createCategory,
  createItem,
  setItemAvailability,
  updateItem,
  deleteItem,
  updateCategory,
  deleteCategory,
  addModifier,
  deleteModifier,
} from "@shopmaster/core";
import { zUpsertCategory, zUpsertItem, zStation, LOCALES, type Locale } from "@shopmaster/shared";
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

const zPatchItem = z.object({
  nameEn: z.string().min(1).optional(),
  nameNe: z.string().optional(),
  descriptionEn: z.string().optional(),
  descriptionNe: z.string().optional(),
  priceMinor: z.number().int().nonnegative().optional(),
  station: zStation.optional(),
  categoryId: z.string().optional(),
  photoUrl: z.string().nullable().optional(),
});

menuRouter.patch(
  "/menu/items/:id",
  requireAuth,
  requirePermission("menu.manage"),
  h(async (req, res) => {
    const ctx = requireCtx(req);
    res.json(await updateItem(ctx, req.params.id, zPatchItem.parse(req.body)));
  }),
);

menuRouter.delete(
  "/menu/items/:id",
  requireAuth,
  requirePermission("menu.manage"),
  h(async (req, res) => {
    const ctx = requireCtx(req);
    res.json(await deleteItem(ctx, req.params.id));
  }),
);

menuRouter.post(
  "/menu/items/:id/modifiers",
  requireAuth,
  requirePermission("menu.manage"),
  h(async (req, res) => {
    const ctx = requireCtx(req);
    const input = z
      .object({ groupName: z.string().min(1), nameEn: z.string().min(1), nameNe: z.string().optional(), priceDeltaMinor: z.number().int() })
      .parse(req.body);
    res.status(201).json(await addModifier(ctx, req.params.id, input));
  }),
);

menuRouter.delete(
  "/menu/modifiers/:id",
  requireAuth,
  requirePermission("menu.manage"),
  h(async (req, res) => {
    const ctx = requireCtx(req);
    res.json(await deleteModifier(ctx, req.params.id));
  }),
);

menuRouter.patch(
  "/menu/categories/:id",
  requireAuth,
  requirePermission("menu.manage"),
  h(async (req, res) => {
    const ctx = requireCtx(req);
    res.json(await updateCategory(ctx, req.params.id, zUpsertCategory.partial().parse(req.body)));
  }),
);

menuRouter.delete(
  "/menu/categories/:id",
  requireAuth,
  requirePermission("menu.manage"),
  h(async (req, res) => {
    const ctx = requireCtx(req);
    res.json(await deleteCategory(ctx, req.params.id));
  }),
);
