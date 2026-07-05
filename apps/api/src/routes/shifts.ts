import { Router } from "express";
import { openShift, closeShift, getCurrentShift, listShifts } from "@shopmaster/core";
import { zOpenShiftRequest, zCloseShiftRequest } from "@shopmaster/shared";
import { h, requireCtx } from "../http.js";
import { requireAuth, requirePermission } from "../auth-middleware.js";

export const shiftsRouter = Router();

/** Recent shifts (open + closed) for reconciliation review (POS-07). */
shiftsRouter.get(
  "/shifts",
  requireAuth,
  requirePermission("reports.view"),
  h(async (req, res) => {
    const ctx = requireCtx(req);
    res.json(await listShifts(ctx));
  }),
);

/** The open shift for a location (live drawer totals), or null. */
shiftsRouter.get(
  "/shifts/current",
  requireAuth,
  requirePermission("order.pay"),
  h(async (req, res) => {
    const ctx = requireCtx(req);
    const locationId = typeof req.query.locationId === "string" ? req.query.locationId : undefined;
    res.json(await getCurrentShift(ctx, locationId));
  }),
);

/** Open a drawer session with a starting float. */
shiftsRouter.post(
  "/shifts/open",
  requireAuth,
  requirePermission("order.pay"),
  h(async (req, res) => {
    const ctx = requireCtx(req);
    const input = zOpenShiftRequest.parse(req.body);
    res.status(201).json(await openShift(ctx, input));
  }),
);

/** Close a shift by counting the drawer; records expected/counted/variance. */
shiftsRouter.post(
  "/shifts/:id/close",
  requireAuth,
  requirePermission("order.pay"),
  h(async (req, res) => {
    const ctx = requireCtx(req);
    const input = zCloseShiftRequest.parse(req.body);
    res.json(await closeShift(ctx, req.params.id, input));
  }),
);
