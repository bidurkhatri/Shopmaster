import type { Request, Response, NextFunction } from "express";

/**
 * The dev-only JWT signing default mirrored from `packages/core/src/auth.ts`. It is an explicit
 * placeholder (SECURITY.md §6) that must never survive into production — `assertProdConfig` below is
 * what enforces that.
 */
const DEV_JWT_SECRET = "shopmaster-dev-secret-change-me";

/**
 * Baseline security response headers (SECURITY.md / PLAT-14), with NO external dependency — no
 * `helmet`, just `res.setHeader`. The API serves JSON only, so the safe posture is aggressive:
 * refuse content-type sniffing, deny framing outright, leak no referrer, kill DNS prefetch, and
 * switch off the browser features a JSON API never uses.
 */
export function securityHeaders(_req: Request, res: Response, next: NextFunction): void {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("X-DNS-Prefetch-Control", "off");
  // Minimal Permissions-Policy — a JSON API needs none of these powerful features, so deny them all.
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  next();
}

/**
 * Fail-fast startup guard (PLAT-14 — no default secrets in production). Throws if the process is
 * running in production with `JWT_SECRET` unset or still equal to the well-known dev placeholder
 * (SECURITY.md §6/§7): in production the signing key must come from the secrets manager, never a
 * default baked into the source. Called once at boot in `apps/api/src/index.ts`, before the server
 * binds, so a misconfigured production deploy dies immediately instead of minting forgeable tokens.
 */
export function assertProdConfig(): void {
  if (process.env.NODE_ENV !== "production") return;
  const secret = process.env.JWT_SECRET;
  if (!secret || secret === DEV_JWT_SECRET) {
    throw new Error(
      "Refusing to start in production: JWT_SECRET is unset or still the dev default. " +
        "Inject a real secret from the secrets manager (PLAT-14).",
    );
  }
}
