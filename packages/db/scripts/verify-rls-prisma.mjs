/**
 * Verify tenant isolation through the ACTUAL application primitive (DB-04) — not just raw SQL.
 *
 * Where verify-rls.mjs proves the Postgres policies with a hand-set GUC, this proves the wiring the
 * app really uses: the `@shopmaster/db` `prisma` proxy + `withTenantContext`. It connects as the
 * non-superuser app role, and asserts:
 *   - inside `withTenantContext(orgId, …)` a proxied query sees exactly that org's rows and zero of
 *     any other org's;
 *   - OUTSIDE any context, a proxied query sees nothing (fail-closed).
 *
 *   DATABASE_URL           MUST be the runtime app role (RLS applies) — the proxy connects with it.
 *   RLS_OWNER_DATABASE_URL  owner/superuser, used only to read ground-truth org ids.
 *
 *   node scripts/verify-rls-prisma.mjs   (or: pnpm --filter @shopmaster/db verify:rls:prisma)
 */
import pg from "pg";
import { prisma, withTenantContext, usingPostgres } from "@shopmaster/db";

const OWNER_URL = process.env.RLS_OWNER_DATABASE_URL;
if (!usingPostgres) {
  console.error("DATABASE_URL must point at Postgres (the app role). Got a non-postgres URL.");
  process.exit(2);
}
if (!OWNER_URL) {
  console.error("Set RLS_OWNER_DATABASE_URL (owner) to read ground-truth org ids.");
  process.exit(2);
}

const owner = new pg.Client({ connectionString: OWNER_URL });
let failures = 0;
const check = (name, cond) => {
  console.log(`${cond ? "  ✓" : "  ✗"} ${name}`);
  if (!cond) failures++;
};

try {
  await owner.connect();
  const orgs = (await owner.query('SELECT id, slug FROM "Organization" ORDER BY slug')).rows;
  const truth = {};
  for (const o of orgs) {
    truth[o.id] = Number((await owner.query('SELECT count(*) FROM "Order" WHERE "organizationId" = $1', [o.id])).rows[0].count);
  }

  for (const o of orgs) {
    console.log(`\norg ${o.slug}:`);
    const seen = await withTenantContext(o.id, (c) => c.order.count());
    check(`withTenantContext sees own ${truth[o.id]} order(s)`, seen === truth[o.id]);
    for (const other of orgs) {
      if (other.id === o.id) continue;
      const leaked = await withTenantContext(o.id, (c) => c.order.count({ where: { organizationId: other.id } }));
      check(`leaks 0 of ${other.slug}'s orders`, leaked === 0);
    }
  }

  console.log("\nno context (proxied query outside withTenantContext):");
  const unscoped = await prisma.order.count();
  check("fail-closed: 0 orders visible", unscoped === 0);

  console.log(failures === 0 ? "\nRLS (Prisma primitive) VERIFIED ✓" : `\nRLS (Prisma primitive) FAILED: ${failures} breach(es) ✗`);
  process.exit(failures === 0 ? 0 : 1);
} catch (e) {
  console.error("verify-rls-prisma error:", e.message);
  process.exit(2);
} finally {
  await owner.end().catch(() => {});
  await prisma.$disconnect().catch(() => {});
}
