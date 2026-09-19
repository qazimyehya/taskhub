-- ─────────────────────────────────────────────────────────────────────────────
-- Make Row Level Security actually enforced.
--
-- Previously the API connected as the `postgres` superuser, which bypasses RLS
-- unconditionally (even with FORCE ROW LEVEL SECURITY), and `SET LOCAL` was
-- issued outside a transaction so it never took effect.
--
-- After this migration the API must connect as `taskhub_app`: a plain role that
-- owns nothing, can't bypass RLS, and only sees rows of the tenant set with
--   SELECT set_config('app.tenant_id', '<id>', true)   -- inside a transaction
-- The password for the role is set by backend/scripts/setup-app-role.js (never
-- stored in a migration).
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Application role ---------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'taskhub_app') THEN
    CREATE ROLE taskhub_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
  END IF;
END
$$;

-- 2. Tenant helper --------------------------------------------------------------
-- Returns NULL (=> zero rows visible) when app.tenant_id is unset or empty,
-- instead of raising "unrecognized configuration parameter".
CREATE OR REPLACE FUNCTION app_current_tenant() RETURNS integer
LANGUAGE sql STABLE
AS $$ SELECT NULLIF(current_setting('app.tenant_id', true), '')::integer $$;

-- 3. Policies -------------------------------------------------------------------
DROP POLICY IF EXISTS users_tenant_isolation ON users;
DROP POLICY IF EXISTS projects_tenant_isolation ON projects;
DROP POLICY IF EXISTS project_members_tenant_isolation ON project_members;
DROP POLICY IF EXISTS tasks_tenant_isolation ON tasks;

CREATE POLICY users_tenant_isolation ON users
  USING (tenant_id = app_current_tenant())
  WITH CHECK (tenant_id = app_current_tenant());

CREATE POLICY projects_tenant_isolation ON projects
  USING (tenant_id = app_current_tenant())
  WITH CHECK (tenant_id = app_current_tenant());

CREATE POLICY project_members_tenant_isolation ON project_members
  USING (tenant_id = app_current_tenant())
  WITH CHECK (tenant_id = app_current_tenant());

CREATE POLICY tasks_tenant_isolation ON tasks
  USING (tenant_id = app_current_tenant())
  WITH CHECK (tenant_id = app_current_tenant());

-- refresh_tokens (created in the previous migration)
ALTER TABLE refresh_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE refresh_tokens FORCE ROW LEVEL SECURITY;
CREATE POLICY refresh_tokens_tenant_isolation ON refresh_tokens
  USING (tenant_id = app_current_tenant())
  WITH CHECK (tenant_id = app_current_tenant());

-- tenants: a tenant can only read its own row. No INSERT/UPDATE policy and no
-- INSERT/UPDATE grant: tenants are created through app_create_tenant() below.
DROP POLICY IF EXISTS tenants_tenant_isolation ON tenants;
CREATE POLICY tenants_tenant_isolation ON tenants
  FOR SELECT
  USING (id = app_current_tenant());

-- 4. Pre-authentication lookups ---------------------------------------------------
-- Signup/login must resolve a slug to a tenant *before* a tenant context exists.
-- SECURITY DEFINER functions (owned by the migration role, which bypasses RLS)
-- expose exactly those two operations and nothing else.
CREATE OR REPLACE FUNCTION app_find_tenant_id(p_slug text) RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$ SELECT id FROM tenants WHERE slug = p_slug AND deleted_at IS NULL $$;

-- Raises unique_violation (23505) when the slug is taken.
CREATE OR REPLACE FUNCTION app_create_tenant(p_name text, p_slug text) RETURNS integer
LANGUAGE sql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$ INSERT INTO tenants (name, slug, plan) VALUES (p_name, p_slug, 'free') RETURNING id $$;

REVOKE ALL ON FUNCTION app_find_tenant_id(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION app_create_tenant(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_current_tenant() TO taskhub_app;
GRANT EXECUTE ON FUNCTION app_find_tenant_id(text) TO taskhub_app;
GRANT EXECUTE ON FUNCTION app_create_tenant(text, text) TO taskhub_app;

-- 5. Least-privilege grants ---------------------------------------------------------
GRANT USAGE ON SCHEMA public TO taskhub_app;

GRANT SELECT                         ON tenants         TO taskhub_app;
GRANT SELECT, INSERT, UPDATE         ON users           TO taskhub_app;
GRANT SELECT, INSERT, UPDATE         ON projects        TO taskhub_app;
GRANT SELECT, INSERT, DELETE         ON project_members TO taskhub_app;
GRANT SELECT, INSERT, UPDATE         ON tasks           TO taskhub_app;
GRANT SELECT, INSERT, UPDATE         ON refresh_tokens  TO taskhub_app;

GRANT USAGE, SELECT ON SEQUENCE users_id_seq           TO taskhub_app;
GRANT USAGE, SELECT ON SEQUENCE projects_id_seq        TO taskhub_app;
GRANT USAGE, SELECT ON SEQUENCE project_members_id_seq TO taskhub_app;
GRANT USAGE, SELECT ON SEQUENCE tasks_id_seq           TO taskhub_app;
GRANT USAGE, SELECT ON SEQUENCE refresh_tokens_id_seq  TO taskhub_app;
