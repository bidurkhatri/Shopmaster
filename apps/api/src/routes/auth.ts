import { Router } from "express";
import { prisma } from "@shopmaster/db";
import { verifyPassword, verifyPin } from "@shopmaster/core";
import { zLoginRequest, zPinVerifyRequest, zPairRequest } from "@shopmaster/shared";
import { h, HttpError } from "../http.js";
import { buildAuthResponse } from "../dto-helpers.js";

export const authRouter = Router();

/** Tier-1: owner/manager login with email + password (Auth-Flow A2/A3). */
authRouter.post(
  "/login",
  h(async (req, res) => {
    const { email, password } = zLoginRequest.parse(req.body);
    const staff = await prisma.staffMember.findFirst({ where: { email }, include: { organization: true } });
    if (!staff || !verifyPassword(password, staff.passwordHash)) {
      throw new HttpError(401, "Invalid email or password");
    }
    res.json(await buildAuthResponse(staff, staff.organization));
  }),
);

/** Tier-2: offline-capable staff PIN switch (Auth-Flow B2/B3). */
authRouter.post(
  "/pin",
  h(async (req, res) => {
    const { staffId, pin } = zPinVerifyRequest.parse(req.body);
    const staff = await prisma.staffMember.findUnique({ where: { id: staffId }, include: { organization: true } });
    if (!staff || !staff.active || !verifyPin(pin, staff.pinHash)) {
      throw new HttpError(401, "Invalid PIN");
    }
    res.json(await buildAuthResponse(staff, staff.organization));
  }),
);

/** Tier-1: pair a new device (Auth-Flow A1–A6). Returns a session + device record. */
authRouter.post(
  "/pair",
  h(async (req, res) => {
    const { email, password, deviceName, locationId } = zPairRequest.parse(req.body);
    const staff = await prisma.staffMember.findFirst({ where: { email }, include: { organization: true } });
    if (!staff || !verifyPassword(password, staff.passwordHash)) {
      throw new HttpError(401, "Invalid credentials");
    }
    const device = await prisma.device.create({
      data: {
        organizationId: staff.organizationId,
        locationId: locationId ?? null,
        name: deviceName,
        credentialFingerprint: `dev_${staff.organizationId}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
      },
    });
    const auth = await buildAuthResponse(staff, staff.organization);
    res.json({ ...auth, device: { id: device.id, name: device.name, pairedAt: device.pairedAt } });
  }),
);
