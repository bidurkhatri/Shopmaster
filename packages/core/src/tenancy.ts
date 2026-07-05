/**
 * Multi-tenancy enforcement, application layer (BE-10 / BE-11).
 *
 * Every request carries a validated org context; every tenant-scoped query must be filtered by it.
 * These helpers make that the default rather than something each handler must remember. On Postgres,
 * Row-Level Security (DB-04) is the independent second layer underneath this; on SQLite this app-layer
 * guard is the enforcement, so we treat it as load-bearing and assert loudly on violation.
 */

export interface TenantContext {
  organizationId: string;
  locationIds: string[];
  staffId?: string;
  deviceId?: string;
  role?: string;
}

export class TenantViolationError extends Error {
  status = 403;
  constructor(message = "Cross-tenant access denied") {
    super(message);
    this.name = "TenantViolationError";
  }
}

/** Where-clause fragment that scopes any tenant-owned table to the caller's organization. */
export function tenantScope(ctx: TenantContext): { organizationId: string } {
  return { organizationId: ctx.organizationId };
}

/** Assert a fetched row belongs to the caller's tenant before returning/mutating it. */
export function assertTenant(ctx: TenantContext, row: { organizationId: string } | null | undefined): void {
  if (!row || row.organizationId !== ctx.organizationId) {
    throw new TenantViolationError();
  }
}
