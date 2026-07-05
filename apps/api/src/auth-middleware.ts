import type { Request, Response, NextFunction } from "express";
import { verifySession } from "@shopmaster/core";
import { withTenantContext, usingPostgres } from "@shopmaster/db";
import { permissionsFor, type Permission, type Role } from "@shopmaster/shared";
import { HttpError } from "./http.js";

/** Attach a validated TenantContext to the request from the Bearer JWT (BE-10). */
export async function authenticate(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const header = req.header("authorization");
    if (!header?.startsWith("Bearer ")) {
      next();
      return;
    }
    const token = header.slice("Bearer ".length);
    const claims = await verifySession(token);
    req.claims = claims;
    req.ctx = {
      organizationId: claims.organizationId,
      locationIds: claims.locationIds,
      staffId: claims.sub,
      role: claims.role,
    };
    next();
  } catch {
    next(); // invalid token → treated as unauthenticated; requireAuth will reject
  }
}

/**
 * Make Postgres RLS (DB-04) the *active* second layer: run each authenticated request inside its
 * caller's tenant context, so every query issued through the `prisma` proxy has `app.org_id` set and
 * the database itself refuses cross-tenant rows underneath the app-layer scoping. No-op on SQLite
 * (no RLS) and for unauthenticated requests, so the self-contained run and public routes are
 * unaffected. The transaction stays open until the response finishes, then commits.
 */
export function tenantContext(req: Request, res: Response, next: NextFunction): void {
  const ctx = req.ctx;
  if (!usingPostgres || !ctx?.organizationId) {
    next();
    return;
  }
  void withTenantContext(
    ctx.organizationId,
    () =>
      new Promise<void>((resolve) => {
        res.once("finish", resolve);
        res.once("close", resolve);
        next();
      }),
  ).catch(next);
}

export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  if (!req.ctx) throw new HttpError(401, "Authentication required");
  next();
}

/** Guard a route by a specific permission (STAFF-01). */
export function requirePermission(permission: Permission) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const role = req.ctx?.role as Role | undefined;
    if (!role) throw new HttpError(401, "Authentication required");
    if (!permissionsFor(role).includes(permission)) {
      throw new HttpError(403, `Missing permission: ${permission}`);
    }
    next();
  };
}
