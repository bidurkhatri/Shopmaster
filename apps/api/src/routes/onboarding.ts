import { Router } from "express";
import { z } from "zod";
import { prisma } from "@shopmaster/db";
import { createMerchant } from "@shopmaster/core";
import { zBusinessType, zCurrency } from "@shopmaster/shared";
import { h, HttpError } from "../http.js";
import { rateLimit } from "../rate-limit.js";
import { buildAuthResponse } from "../dto-helpers.js";

/**
 * Merchant self-onboarding (GAP-07) — the public front door for the PRD headline "15 minutes to
 * first sale" (PRD §5). Unauthenticated by definition (there's no account yet), so it carries its
 * own rate limiting like the other public endpoints (BE-13). One POST stands up the whole tenant
 * (org + location + owner + starter menu) via createMerchant, then hands back a ready-to-use owner
 * session (AuthResponse) — reusing buildAuthResponse — so the browser goes straight to the POS with
 * no second login.
 */
export const onboardingRouter = Router();

const signupLimit = rateLimit({ windowMs: 60_000, max: 10 });

const zSignupRequest = z.object({
  orgName: z.string().min(1).max(80),
  businessType: zBusinessType,
  currency: zCurrency,
  ownerName: z.string().min(1).max(80),
  ownerEmail: z.string().email(),
  password: z.string().min(8),
  pin: z.string().regex(/^\d{4,6}$/, "PIN must be 4–6 digits"),
});

onboardingRouter.post(
  "/onboarding/signup",
  signupLimit,
  h(async (req, res) => {
    const input = zSignupRequest.parse(req.body);
    const { organizationId, ownerId } = await createMerchant(input);

    const [org, owner] = await Promise.all([
      prisma.organization.findUnique({ where: { id: organizationId } }),
      prisma.staffMember.findUnique({ where: { id: ownerId } }),
    ]);
    if (!org || !owner) throw new HttpError(500, "Onboarding failed to create the account");

    res.status(201).json(await buildAuthResponse(owner, org));
  }),
);
