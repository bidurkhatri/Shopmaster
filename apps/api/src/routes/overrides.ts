import { Router } from "express";
import { z } from "zod";
import { authorizeOverride } from "@shopmaster/core";
import { prisma } from "@shopmaster/db";
import { h, HttpError, requireCtx } from "../http.js";
import { requireAuth } from "../auth-middleware.js";

export const overridesRouter = Router();

// Only these permissions can be granted by a manager PIN at the terminal (POS-05/11).
const zVerify = z.object({
  pin: z.string().min(3),
  permission: z.enum(["order.discount", "order.void"]),
  context: z.string().max(200).optional(),
});

/** Verify a manager/owner PIN authorizes a sensitive action; records who approved it. */
overridesRouter.post(
  "/overrides/verify",
  requireAuth,
  h(async (req, res) => {
    const ctx = requireCtx(req);
    const { pin, permission, context } = zVerify.parse(req.body);
    const approval = await authorizeOverride(ctx.organizationId, pin, permission);
    if (!approval) throw new HttpError(403, "PIN is not authorized for this action");
    await prisma.auditLogEntry.create({
      data: {
        organizationId: ctx.organizationId,
        actorId: approval.staffId,
        action: "OVERRIDE_APPROVED",
        target: permission,
        after: JSON.stringify({ context: context ?? null, approvedBy: approval.name }),
      },
    });
    res.json({ approved: true, approverName: approval.name });
  }),
);
