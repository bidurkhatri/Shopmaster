/**
 * Verify Postgres Row-Level Security tenant isolation (DB-04) — the automated version of the manual
 * check in docs/POSTGRES.md. Run against a seeded Postgres after applying prisma/rls.sql.
 *
 *   DATABASE_URL           owner/superuser connection (reads ground truth; bypasses RLS)
 *   RLS_APP_DATABASE_URL   the runtime non-superuser role the app connects as (RLS applies)
 *
 *   node scripts/verify-rls.mjs   (or: pnpm --filter @shopmaster/db verify:rls)
 *
 * Asserts, for every organization: the app role scoped to that org sees exactly its own orders and
 * ZERO of any other org's; and that an UNSCOPED app connection sees no rows at all (fail-closed).
 * Exits non-zero on any breach so CI fails loudly.
 */
import pg from "pg";

const OWNER_URL = process.env.DATABASE_URL;
const APP_URL = process.env.RLS_APP_DATABASE_URL;
if (!OWNER_URL || !APP_URL) {
  console.error("Set DATABASE_URL (owner) and RLS_APP_DATABASE_URL (app role).");
  process.exit(2);
}

const owner = new pg.Client({ connectionString: OWNER_URL });
const app = new pg.Client({ connectionString: APP_URL });
let failures = 0;
const check = (name, cond) => {
  console.log(`${cond ? "  ✓" : "  ✗"} ${name}`);
  if (!cond) failures++;
};

async function scopeTo(orgId) {
  await app.query("SELECT set_config('app.org_id', $1, false)", [orgId]);
}
async function count(client, sql, params = []) {
  const r = await client.query(sql, params);
  return Number(r.rows[0].count);
}

try {
  await owner.connect();
  await app.connect();

  const orgs = (await owner.query('SELECT id, slug FROM "Organization" ORDER BY slug')).rows;
  if (orgs.length < 2) throw new Error(`Need >=2 seeded orgs to prove isolation, found ${orgs.length}`);

  const truth = {};
  for (const o of orgs) {
    truth[o.id] = await count(owner, 'SELECT count(*) FROM "Order" WHERE "organizationId" = $1', [o.id]);
  }

  for (const o of orgs) {
    console.log(`\norg ${o.slug} (${o.id}):`);
    await scopeTo(o.id);
    const own = await count(app, 'SELECT count(*) FROM "Order"');
    check(`sees own ${truth[o.id]} order(s)`, own === truth[o.id]);
    check(`sees exactly 1 organization row`, (await count(app, 'SELECT count(*) FROM "Organization"')) === 1);
    for (const other of orgs) {
      if (other.id === o.id) continue;
      const leaked = await count(app, 'SELECT count(*) FROM "Order" WHERE "organizationId" = $1', [other.id]);
      check(`leaks 0 of ${other.slug}'s orders`, leaked === 0);
    }
  }

  console.log("\nunscoped (no app.org_id set):");
  await app.query("SELECT set_config('app.org_id', '', false)");
  check("fail-closed: 0 orders visible", (await count(app, 'SELECT count(*) FROM "Order"')) === 0);

  console.log(failures === 0 ? "\nRLS isolation VERIFIED ✓" : `\nRLS isolation FAILED: ${failures} breach(es) ✗`);
  process.exit(failures === 0 ? 0 : 1);
} catch (e) {
  console.error("verify-rls error:", e.message);
  process.exit(2);
} finally {
  await owner.end().catch(() => {});
  await app.end().catch(() => {});
}
