/**
 * Multi-tenancy guard unit tests (BE-10 / BE-11, GAP-05 at the unit level).
 *
 * GAP-05 flags that tenant isolation "is worth a dedicated test suite, not just code review." This
 * file pins down the application-layer guard in `tenancy.ts` in isolation:
 *   - `tenantScope` always narrows to the caller's organization and exposes nothing else;
 *   - `assertTenant` accepts a same-org row and rejects a cross-org, null, or undefined row with a
 *     403 `TenantViolationError`.
 * (The route boundary translates that 403 into a 404 for probing resistance — SECURITY.md §4 — which
 * is exercised at the API layer, not here.)
 */
import { describe, it, expect } from "vitest";
import { assertTenant, tenantScope, TenantViolationError, type TenantContext } from "./tenancy.js";

const ctx: TenantContext = { organizationId: "org-1", locationIds: ["loc-1"], staffId: "staff-1", deviceId: "dev-1", role: "OWNER" };

function caught(fn: () => void): unknown {
  try {
    fn();
  } catch (e) {
    return e;
  }
  return undefined;
}

describe("tenantScope", () => {
  it("scopes a query to the caller's organization", () => {
    expect(tenantScope(ctx)).toEqual({ organizationId: "org-1" });
  });

  it("exposes only organizationId — never location/staff/device context", () => {
    // The scope fragment must not leak other TenantContext fields into a where-clause.
    expect(Object.keys(tenantScope(ctx))).toEqual(["organizationId"]);
  });
});

describe("assertTenant", () => {
  it("passes for a row owned by the caller's organization", () => {
    expect(() => assertTenant(ctx, { organizationId: "org-1" })).not.toThrow();
  });

  it("passes for a same-org row carrying extra fields", () => {
    expect(() => assertTenant(ctx, { organizationId: "org-1", id: "o-9", total: 1234 } as { organizationId: string })).not.toThrow();
  });

  it("throws TenantViolationError (403) for a cross-org row", () => {
    const err = caught(() => assertTenant(ctx, { organizationId: "org-2" }));
    expect(err).toBeInstanceOf(TenantViolationError);
    expect((err as TenantViolationError).status).toBe(403);
    expect((err as Error).name).toBe("TenantViolationError");
    expect((err as Error).message).toBe("Cross-tenant access denied");
    // And as a terse form for good measure:
    expect(() => assertTenant(ctx, { organizationId: "org-2" })).toThrow(TenantViolationError);
  });

  it("throws for a null row (missing/not-found is treated as a violation, GAP-05)", () => {
    const err = caught(() => assertTenant(ctx, null));
    expect(err).toBeInstanceOf(TenantViolationError);
    expect((err as TenantViolationError).status).toBe(403);
  });

  it("throws for an undefined row (GAP-05)", () => {
    const err = caught(() => assertTenant(ctx, undefined));
    expect(err).toBeInstanceOf(TenantViolationError);
    expect((err as TenantViolationError).status).toBe(403);
  });
});
