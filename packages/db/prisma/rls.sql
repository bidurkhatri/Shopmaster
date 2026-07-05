-- ShopMaster — Row-Level Security policies (DB-04), the independent second tenancy layer beneath
-- the app-layer scoping in packages/core/src/tenancy.ts (BE-10/11). Apply AFTER `prisma db push`
-- / `prisma migrate deploy` against Postgres, as the table owner.
--
-- The application sets the caller's org per transaction from the validated TenantContext:
--     SELECT set_config('app.org_id', <organizationId>, true);   -- true = transaction-local (pool-safe)
-- current_setting('app.org_id', true) returns NULL when unset, so an un-scoped query sees NO rows
-- (fail-closed). Superusers bypass RLS, so the app MUST connect as a non-superuser, non-owner role.
--
-- Idempotent: safe to re-run (drops the policy before recreating it).

-- Tables that carry organizationId directly.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'Location','StaffMember','Device','MenuCategory','MenuItem',
    'OrderEvent','Order','Payment','AuditLogEntry','CustomerProfile','InventoryItem'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', t);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I USING ("organizationId" = current_setting(''app.org_id'', true)) WITH CHECK ("organizationId" = current_setting(''app.org_id'', true))',
      t
    );
  END LOOP;
END $$;

-- Organization root: keyed on its own id.
ALTER TABLE "Organization" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Organization" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "Organization";
CREATE POLICY tenant_isolation ON "Organization"
  USING ("id" = current_setting('app.org_id', true))
  WITH CHECK ("id" = current_setting('app.org_id', true));

-- Child tables without organizationId — scope through their parent.
ALTER TABLE "Modifier" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Modifier" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "Modifier";
CREATE POLICY tenant_isolation ON "Modifier"
  USING (EXISTS (SELECT 1 FROM "MenuItem" mi WHERE mi."id" = "Modifier"."menuItemId"
                 AND mi."organizationId" = current_setting('app.org_id', true)));

ALTER TABLE "TableOrTab" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TableOrTab" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "TableOrTab";
CREATE POLICY tenant_isolation ON "TableOrTab"
  USING (EXISTS (SELECT 1 FROM "Location" l WHERE l."id" = "TableOrTab"."locationId"
                 AND l."organizationId" = current_setting('app.org_id', true)));

ALTER TABLE "OrderItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "OrderItem" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "OrderItem";
CREATE POLICY tenant_isolation ON "OrderItem"
  USING (EXISTS (SELECT 1 FROM "Order" o WHERE o."id" = "OrderItem"."orderId"
                 AND o."organizationId" = current_setting('app.org_id', true)));

-- Grant the runtime (non-superuser) role table privileges; RLS still restricts which ROWS it sees.
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO shopmaster_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO shopmaster_app;
