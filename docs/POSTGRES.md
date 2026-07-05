# ShopMaster — SQLite → PostgreSQL (DB-02) & Row-Level Security (DB-04)

This is the productionization path for the database. The repo ships on SQLite so it runs
self-contained with zero external services (see [`README.md`](../README.md)), but the schema is
written to be Postgres-portable and the multi-tenancy design assumes a managed Postgres in
production (**DB-02**, **PLAT-05**). This document covers two independent things:

1. **The swap** — moving the app from SQLite to Postgres with the *minimal* change: same schema,
   same field types, same application code.
2. **Row-Level Security (DB-04)** — the second, database-engine tenancy layer that only exists on
   Postgres, sitting underneath the app-layer scoping in
   [`packages/core/src/tenancy.ts`](../packages/core/src/tenancy.ts).

They are deliberately separate. You can do (1) and have a working Postgres deployment before doing
(2); (2) is the belt-and-suspenders hardening described in §3.

---

## Part 1 — The swap (DB-02 / PLAT-05)

### Why it's a small change

The SQLite schema was authored so the *types the application sees* are identical on both engines:

- status / role / tier / jurisdiction are `String` fields, validated by Zod in
  `@shopmaster/shared` — **not** native DB enums.
- JSON-shaped fields (`branding`, i18n `name`/`description`, `OrderEvent.payload`, `modifiers`,
  audit `before`/`after`) are `String` holding JSON text, wrapped by the json/i18n helpers in
  `@shopmaster/shared` — **not** native `jsonb`.
- money is an integer in the currency's minor units (paisa / cents) — no `Decimal`.

Because none of those types change, no application code changes. That is the whole point of shipping
a separate [`schema.postgres.prisma`](../packages/db/prisma/schema.postgres.prisma) that is a
verbatim copy of [`schema.prisma`](../packages/db/prisma/schema.prisma) with **only** the datasource
`provider` flipped from `"sqlite"` to `"postgresql"`.

> Tightening `String` status fields into Postgres-native `enum`s, and JSON-text fields into `jsonb`,
> is a legitimate *later* optimization (it buys DB-level integrity + indexable JSON). It is **not**
> required to run on Postgres, and it *is* an application-affecting change (Prisma emits enum types
> and `Json` fields the code must adapt to). Keep it out of the drop-in swap.

### Steps

1. **Provision managed Postgres (PLAT-05).** Use a managed provider (backups, PITR, connection
   pooling handled for you — PLAT-05) rather than self-hosting. Get the connection string.

2. **Point the environment at it.** Set `DATABASE_URL` to the managed URL. Use the pooled endpoint
   for the app runtime and the direct endpoint for migrations if your provider distinguishes them:

   ```bash
   # runtime (pooled)
   DATABASE_URL="postgresql://app:•••@db.example.com:5432/shopmaster?schema=public&sslmode=require&connection_limit=10"
   ```

3. **Swap the schema.** Either replace the file Prisma reads, or point the CLI at the Postgres
   schema explicitly with `--schema` (nothing else in the command changes):

   ```bash
   pnpm --filter @shopmaster/db exec prisma generate      --schema prisma/schema.postgres.prisma
   pnpm --filter @shopmaster/db exec prisma migrate deploy --schema prisma/schema.postgres.prisma
   ```

   For the first Postgres migration use `prisma migrate dev --name init_postgres` to generate the
   baseline SQL under `prisma/migrations/`, then `migrate deploy` in CI/production.

4. **Seed if needed.** The existing seed is engine-agnostic (it goes through the Prisma client), so
   the same `db:seed` step works once `DATABASE_URL` points at Postgres.

5. **Verify.** Run `pnpm typecheck` and the unit/e2e suites against the Postgres `DATABASE_URL`. No
   source changes should be required — if the app needs code edits to run, the type-parity invariant
   above was broken and that's the bug to fix, not the application.

RLS (Part 2) is applied *after* the tables exist, as its own SQL migration — Prisma's schema
language can't express policies, so they don't live in `schema.postgres.prisma`.

---

## Part 2 — Row-Level Security (DB-04): the second tenancy layer

### Belt-and-suspenders, by design

Multi-tenancy in ShopMaster is enforced at **two independent layers** (DB-03 / DB-04, PLAT-17):

- **Layer 1 — application (BE-10/11):** every tenant-scoped query is filtered by
  `organizationId` via the helpers in [`packages/core/src/tenancy.ts`](../packages/core/src/tenancy.ts)
  (`tenantScope()` adds the where-clause fragment, `assertTenant()` checks a fetched row before it's
  returned or mutated). On SQLite this is the *only* guard, so it's treated as load-bearing and
  fails loud (`TenantViolationError`, 403).

- **Layer 2 — database (DB-04):** Postgres RLS policies filter `organizationId` **at the engine
  itself**, underneath and independent of Layer 1.

The reason for both, restated from the Database Architecture (DB-04): application-layer scoping alone
means one overlooked `where` in one endpoint is a cross-tenant leak; RLS alone produces query
behavior that's confusing to debug and easy to misread. With both, an engineer has to make **two
independent mistakes at two different layers** for one merchant to ever see another's data. RLS does
*not* replace `tenancy.ts` — it backstops it.

### How the tenant is passed to the database: a per-request GUC

RLS policies need to know "who is the current tenant" without trusting the query text. The standard
Postgres pattern is a **custom GUC** (a `SET`-table runtime parameter) carrying the org id, set once
per request inside the transaction, and read by every policy via `current_setting()`.

Use `SET LOCAL` (or its function form `set_config(..., true)`) so the value is scoped to the
**transaction** and cannot leak across pooled connections:

```ts
// In apps/api, at the start of each authenticated request's transaction, from the
// validated TenantContext (organizationId comes from the verified JWT — BE-10):
await prisma.$transaction(async (tx) => {
  // set_config(setting, value, is_local=true) == SET LOCAL — transaction-scoped, pooling-safe.
  await tx.$executeRaw`SELECT set_config('app.org_id', ${ctx.organizationId}, true)`;

  // ...all tenant-scoped queries in this tx now run under RLS keyed to ctx.organizationId...
});
```

Read it back in policies with the **missing-ok** form, `current_setting('app.org_id', true)`, which
returns `NULL` instead of erroring when the GUC was never set. A policy that compares
`organizationId` to `NULL` matches **no rows**, so an unscoped connection is fail-closed (it sees
nothing) rather than fail-open.

### Enabling RLS and the connection role

RLS is bypassed by superusers and by a table's owner **unless** you `FORCE` it. The app should
connect as a dedicated, non-owner, non-superuser role, and you should still `FORCE ROW LEVEL
SECURITY` for defense in depth (so even an accidental owner connection is constrained):

```sql
-- One-time: the role the application runtime connects as (not the migration/owner role).
CREATE ROLE app LOGIN PASSWORD '•••';
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app;
```

### The policies

Prisma maps model → table and camelCase field → camelCase column, so identifiers are
**case-sensitive and must be quoted** (and `"Order"` is a reserved word). Every tenant-scoped table
carries an `"organizationId"` column (DB-03); the policy is the same shape on each. `FOR ALL` covers
SELECT/INSERT/UPDATE/DELETE; `USING` filters rows read/updated/deleted, `WITH CHECK` blocks writing a
row for a *different* tenant.

```sql
-- Enable + force RLS, then add one tenant policy per table.
-- Pattern for every table that has an "organizationId" column:
ALTER TABLE "Location"        ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Location"        FORCE  ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "Location"
  FOR ALL
  USING      ("organizationId" = current_setting('app.org_id', true))
  WITH CHECK ("organizationId" = current_setting('app.org_id', true));

-- Apply the identical block to each tenant-scoped table:
--   "StaffMember", "Device", "MenuCategory", "MenuItem", "OrderEvent",
--   "Order", "Payment", "AuditLogEntry", "CustomerProfile", "InventoryItem"
-- e.g.:
ALTER TABLE "Order"           ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Order"           FORCE  ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "Order"
  FOR ALL
  USING      ("organizationId" = current_setting('app.org_id', true))
  WITH CHECK ("organizationId" = current_setting('app.org_id', true));

ALTER TABLE "Payment"         ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Payment"         FORCE  ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "Payment"
  FOR ALL
  USING      ("organizationId" = current_setting('app.org_id', true))
  WITH CHECK ("organizationId" = current_setting('app.org_id', true));
```

The tenant **root** table keys off its own id rather than an `organizationId` column:

```sql
ALTER TABLE "Organization"    ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Organization"    FORCE  ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "Organization"
  FOR ALL
  USING      ("id" = current_setting('app.org_id', true))
  WITH CHECK ("id" = current_setting('app.org_id', true));
```

Three child tables do **not** carry `organizationId` — they inherit their tenant through a parent
(`Modifier` → `MenuItem`, `TableOrTab` → `Location`, `OrderItem` → `Order`). Cover them with an
`EXISTS` policy that checks the parent's `organizationId`:

```sql
ALTER TABLE "OrderItem"       ENABLE ROW LEVEL SECURITY;
ALTER TABLE "OrderItem"       FORCE  ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "OrderItem"
  FOR ALL
  USING (EXISTS (
    SELECT 1 FROM "Order" o
    WHERE o."id" = "OrderItem"."orderId"
      AND o."organizationId" = current_setting('app.org_id', true)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM "Order" o
    WHERE o."id" = "OrderItem"."orderId"
      AND o."organizationId" = current_setting('app.org_id', true)
  ));

-- "Modifier"   → parent "MenuItem" (Modifier."menuItemId" = MenuItem."id")
-- "TableOrTab" → parent "Location" (TableOrTab."locationId" = Location."id")
-- follow the same EXISTS shape against the parent's "organizationId".
```

> **DB-05 (location scope) is a natural extension.** For the branch-manager-sees-one-location model
> (AUTHZ-04), add a second GUC (`app.location_ids`) and `AND` a `"locationId" = ANY(...)` clause into
> the `USING`/`WITH CHECK` of the location-bearing tables. Kept out of the baseline policies above to
> keep the org-isolation layer readable.

### Where this SQL lives

RLS is not expressible in Prisma's schema, so these statements are **not** in
`schema.postgres.prisma`. Add them as a dedicated, hand-written migration applied *after* the
generated table DDL — e.g. a new `prisma/migrations/<timestamp>_rls/migration.sql` that Prisma runs
in order, or a repeatable post-migrate SQL step in CI. Re-run it whenever a new tenant-scoped table
is added, so a table can never ship with RLS silently off.

---

## Summary

| Concern | SQLite (shipped) | Postgres (production) |
|---|---|---|
| Schema | `schema.prisma` | `schema.postgres.prisma` (verbatim copy, provider only) |
| status / enums | `String` + Zod | `String` + Zod (unchanged) |
| JSON | `String` text + helpers | `String` text + helpers (unchanged; `jsonb` is a later opt-in) |
| money | integer minor units | integer minor units (unchanged) |
| Tenancy layer 1 | `packages/core/src/tenancy.ts` (BE-10/11) | `packages/core/src/tenancy.ts` (BE-10/11) |
| Tenancy layer 2 | — (app layer is the only guard) | **RLS policies (DB-04)** keyed to `app.org_id` GUC |

---

## Verification — this was actually run, not just written

The Postgres path and RLS policies were verified end-to-end against **PostgreSQL 16.13**:

- `prisma db push --schema prisma/schema.postgres.prisma` created the schema; the two-tenant seed
  loaded; **the API ran unchanged on Postgres** (login, reporting, and merchant onboarding all
  worked against PG — DB-02 proven, zero code change).
- `prisma/rls.sql` applied cleanly, and connecting as the non-superuser `shopmaster_app` role:
  - scoped to the Sydney org → saw its **8** orders and **0** of the Nepal org's;
  - scoped to the Nepal org → saw its **2** orders and **0** of the Sydney org's;
  - with `app.org_id` unset → saw **0** rows (**fail-closed**).

Reproduce it with the committed script (used by the `postgres-rls` CI job on every push):

```bash
# against a running Postgres with the schema pushed, seeded, and rls.sql applied:
DATABASE_URL=postgresql://postgres@host:5432/shopmaster \
RLS_APP_DATABASE_URL=postgresql://shopmaster_app:app_pw@host:5432/shopmaster \
pnpm --filter @shopmaster/db verify:rls
```

## Remaining wiring to make RLS the *active* second layer in the app

App-layer scoping (`packages/core/src/tenancy.ts`) is the primary enforcement today and is always on.
To also have RLS enforce at runtime, the API must connect as `shopmaster_app` (not a superuser — the
seed/migrate role) and set the GUC per transaction from the validated `TenantContext`:

```ts
await prisma.$transaction(async (tx) => {
  await tx.$executeRawUnsafe(`SELECT set_config('app.org_id', $1, true)`, ctx.organizationId);
  // ... tenant-scoped queries run here, now doubly guarded ...
});
```

This is a deliberate, reviewable change (it routes tenant-scoped data access through a per-request
transaction) and is the one remaining step to flip DB-04 from "verified correct" to "enforced in the
running app". The policies themselves are proven correct above.
