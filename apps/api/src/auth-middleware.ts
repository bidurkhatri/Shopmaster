import type { Request, Response, NextFunction } from "express";
import { verifySession } from "@shopmaster/core";
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
