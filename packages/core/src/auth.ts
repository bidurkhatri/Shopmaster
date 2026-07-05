/**
 * Two-tier authentication primitives (Auth-Flow).
 *
 * Tier 1 (online, rare): owner/manager logs in with email+password → we mint a signed JWT carrying
 *   organization_id, role, location_ids (Auth-Flow A3 / BE-10). In production this is Auth0's
 *   Universal Login + a device-scoped refresh token; here it's a self-contained, Auth0-swappable
 *   JWT so the whole thing runs with no external identity provider.
 * Tier 2 (offline): staff selects their name + enters a PIN, checked against a locally-cached hash
 *   with ZERO connectivity (Auth-Flow B2/B3). That's `verifyPin` below.
 *
 * bcryptjs (pure JS, no native build) hashes passwords and PINs; `jose` signs/verifies the JWT.
 */
import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import type { Role } from "@shopmaster/shared";

const SALT_ROUNDS = 8;

export function hashPassword(plain: string): string {
  return bcrypt.hashSync(plain, SALT_ROUNDS);
}
export function verifyPassword(plain: string, hash: string | null | undefined): boolean {
  if (!hash) return false;
  return bcrypt.compareSync(plain, hash);
}
export const hashPin = hashPassword;
export const verifyPin = verifyPassword;

export interface SessionClaims {
  sub: string; // staff id
  name: string;
  role: Role;
  organizationId: string;
  locationIds: string[];
}

function secret(): Uint8Array {
  const s = process.env.JWT_SECRET ?? "shopmaster-dev-secret-change-me";
  return new TextEncoder().encode(s);
}

export async function signSession(claims: SessionClaims, expiresIn = "12h"): Promise<string> {
  return await new SignJWT({ ...claims })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(secret());
}

export async function verifySession(token: string): Promise<SessionClaims> {
  const { payload } = await jwtVerify(token, secret());
  return {
    sub: payload.sub as string,
    name: payload.name as string,
    role: payload.role as Role,
    organizationId: payload.organizationId as string,
    locationIds: (payload.locationIds as string[]) ?? [],
  };
}
