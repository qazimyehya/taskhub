import { Pool, PoolClient } from 'pg';
import { config } from './config';

// Runtime pool. Connects as the restricted `taskhub_app` role (see the
// enforce_rls_app_role migration) so Postgres RLS policies actually apply.
const pool = new Pool({ connectionString: config.appDatabaseUrl });

pool.on('error', (err) => {
  console.error('Unexpected idle database client error:', err);
});

export type Db = PoolClient;

// Run `fn` inside a transaction. Commits on return, rolls back on throw.
export async function withTransaction<T>(fn: (db: Db) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  let broken = false;
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {
      broken = true; // connection is unusable, make the pool discard it
    }
    throw err;
  } finally {
    client.release(broken);
  }
}

// Bind the transaction to a tenant for RLS. `is_local = true` scopes it to the
// current transaction, so it can never leak to the next request that reuses
// this pooled connection.
export async function setTenant(db: Db, tenantId: number): Promise<void> {
  if (!Number.isInteger(tenantId)) {
    throw new Error('setTenant: tenantId must be an integer');
  }
  await db.query("SELECT set_config('app.tenant_id', $1, true)", [String(tenantId)]);
}

// Every tenant-scoped query must go through this: one transaction, RLS bound
// to `tenantId` (always taken from the verified JWT, never from the request body).
export function withTenant<T>(tenantId: number, fn: (db: Db) => Promise<T>): Promise<T> {
  return withTransaction(async (db) => {
    await setTenant(db, tenantId);
    return fn(db);
  });
}

// Resolve slug -> tenant id before a tenant context exists (login).
// Backed by a SECURITY DEFINER function; the app role can't read `tenants` directly.
export async function findTenantIdBySlug(slug: string): Promise<number | null> {
  const result = await pool.query('SELECT app_find_tenant_id($1) AS id', [slug]);
  return result.rows[0].id;
}

// Signup: create a tenant row (SECURITY DEFINER function). Throws 23505 on duplicate slug.
export async function createTenant(db: Db, name: string, slug: string): Promise<number> {
  const result = await db.query('SELECT app_create_tenant($1, $2) AS id', [name, slug]);
  return result.rows[0].id;
}

// Refuse to run with a role that bypasses RLS — that silently turns the
// database-level tenant isolation off (this is exactly what happened when the
// API connected as `postgres`).
export async function assertRoleEnforcesRls(): Promise<void> {
  const result = await pool.query(
    `SELECT current_user AS name, rolsuper, rolbypassrls
       FROM pg_roles WHERE rolname = current_user`
  );
  const role = result.rows[0];
  if (role.rolsuper || role.rolbypassrls) {
    throw new Error(
      `APP_DATABASE_URL connects as "${role.name}", which bypasses Row Level Security. ` +
        'Connect as the restricted taskhub_app role instead (see README).'
    );
  }
}

export async function closePool(): Promise<void> {
  await pool.end();
}

export default pool;
