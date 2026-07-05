import { Router } from "express";
import { getInventory, setStock, adjustStock } from "@shopmaster/core";
import { zSetStockRequest, zAdjustStockRequest, LOCALES, type Locale } from "@shopmaster/shared";
import { h, requireCtx } from "../http.js";
import { requireAuth, requirePermission } from "../auth-middleware.js";

export const inventoryRouter = Router();

function locale(q: unknown): Locale {
  const l = typeof q === "string" ? q : "en";
  return (LOCALES as readonly string[]).includes(l) ? (l as Locale) : "en";
}

/** Inventory snapshot: per-item stock, low-stock flags, and recent movements (INV-01/02). */
inventoryRouter.get(
  "/inventory",
  requireAuth,
  requirePermission("menu.manage"),
  h(async (req, res) => {
    const ctx = requireCtx(req);
    res.json(await getInventory(ctx, locale(req.query.locale)));
  }),
);

/** Set an absolute stock level (a stock-take). */
inventoryRouter.post(
  "/inventory/set",
  requireAuth,
  requirePermission("menu.manage"),
  h(async (req, res) => {
    const ctx = requireCtx(req);
    const input = zSetStockRequest.parse(req.body);
    res.json(await setStock(ctx, input));
  }),
);

/** Apply a relative change (restock / write-off). */
inventoryRouter.post(
  "/inventory/adjust",
  requireAuth,
  requirePermission("menu.manage"),
  h(async (req, res) => {
    const ctx = requireCtx(req);
    const input = zAdjustStockRequest.parse(req.body);
    res.json(await adjustStock(ctx, input));
  }),
);
