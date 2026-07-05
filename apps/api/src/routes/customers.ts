import { Router } from "express";
import { listCustomers, getCustomer } from "@shopmaster/core";
import { h, HttpError, requireCtx } from "../http.js";
import { requireAuth, requirePermission } from "../auth-middleware.js";

export const customersRouter = Router();

/** Rewards customers ranked by spend (CRM-02). */
customersRouter.get(
  "/customers",
  requireAuth,
  requirePermission("reports.view"),
  h(async (req, res) => {
    const ctx = requireCtx(req);
    res.json(await listCustomers(ctx));
  }),
);

/** One customer with recent order history; 404s cross-tenant (GAP-05). */
customersRouter.get(
  "/customers/:id",
  requireAuth,
  requirePermission("reports.view"),
  h(async (req, res) => {
    const ctx = requireCtx(req);
    const customer = await getCustomer(ctx, req.params.id);
    if (!customer) throw new HttpError(404, "Customer not found");
    res.json(customer);
  }),
);
