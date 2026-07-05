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
import { SignJWT, jwtVerify, createRemoteJWKSet, type JWTPayload } from "jose";
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

/**
 * Auth0 mode (AUTH-flow Tier-1) is a pure configuration switch: set AUTH0_ISSUER (or AUTH0_DOMAIN)
 * and we verify RS256 tokens minted by Auth0 against its published JWKS, reading the
 * organization_id / role / location_ids that an Auth0 Action injects as namespaced custom claims.
 * With no AUTH0_* env set we fall back to the self-contained HS256 tokens signSession issues, so the
 * whole product runs with zero external identity provider. Swapping to Auth0 touches no code.
 */
const AUTH0_ISSUER = normalizeIssuer(process.env.AUTH0_ISSUER ?? (process.env.AUTH0_DOMAIN ? `https://${process.env.AUTH0_DOMAIN}/` : undefined));
const AUTH0_AUDIENCE = process.env.AUTH0_AUDIENCE;
const CLAIMS_NS = process.env.AUTH0_CLAIMS_NAMESPACE ?? "https://shopmaster.app/";

function normalizeIssuer(iss?: string): string | undefined {
  if (!iss) return undefined;
  return iss.endsWith("/") ? iss : `${iss}/`;
}

let jwks: ReturnType<typeof createRemoteJWKSet> | undefined;
function remoteJwks() {
  if (!AUTH0_ISSUER) return undefined;
  if (!jwks) jwks = createRemoteJWKSet(new URL(`${AUTH0_ISSUER}.well-known/jwks.json`));
  return jwks;
}

export function isAuth0Enabled(): boolean {
  return Boolean(AUTH0_ISSUER);
}

export async function signSession(claims: SessionClaims, expiresIn = "12h"): Promise<string> {
  // Self-contained tokens (used when Auth0 is not configured). In Auth0 mode, Auth0 mints the token.
  return await new SignJWT({ ...claims })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(secret());
}

function claimsFrom(payload: JWTPayload): SessionClaims {
  // Accept both our self-contained claims and Auth0's namespaced custom claims.
  const pick = <T,>(key: string): T | undefined =>
    (payload[key] as T) ?? (payload[`${CLAIMS_NS}${key}`] as T);
  return {
    sub: payload.sub as string,
    name: (pick<string>("name") ?? "") as string,
    role: pick<Role>("role") as Role,
    organizationId: pick<string>("organizationId") as string,
    locationIds: (pick<string[]>("locationIds") ?? []) as string[],
  };
}

export async function verifySession(token: string): Promise<SessionClaims> {
  if (AUTH0_ISSUER) {
    const j = remoteJwks()!;
    const { payload } = await jwtVerify(token, j, {
      issuer: AUTH0_ISSUER,
      ...(AUTH0_AUDIENCE ? { audience: AUTH0_AUDIENCE } : {}),
    });
    return claimsFrom(payload);
  }
  const { payload } = await jwtVerify(token, secret());
  return claimsFrom(payload);
}
