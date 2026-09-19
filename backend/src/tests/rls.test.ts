import { assertRoleEnforcesRls, closePool } from '../db';
import {
  adminPool,
  appPool,
  cleanupTestTenants,
  createProject,
  signupTenant,
  TestTenant,
} from './helpers';

// These tests talk to Postgres directly as the API's own role, with NO
// WHERE tenant_id anywhere — so they only pass if RLS itself is doing the work.

let a: TestTenant;
let b: TestTenant;

beforeAll(async () => {
  await cleanupTestTenants();
  a = await signupTenant('rls-a');
  b = await signupTenant('rls-b');
  await createProject(a.token, 'A-only');
  await createProject(b.token, 'B-only');
});

afterAll(async () => {
  await cleanupTestTenants();
  await adminPool.end();
  await appPool.end();
  await closePool();
});

async function asTenant<T>(tenantId: number | null, fn: (q: typeof appPool.query) => Promise<T>) {
  const client = await appPool.connect();
  try {
    await client.query('BEGIN');
    if (tenantId !== null) {
      await client.query("SELECT set_config('app.tenant_id', $1, true)", [String(tenantId)]);
    }
    const out = await fn(client.query.bind(client) as any);
    await client.query('ROLLBACK');
    return out;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}

describe('Row Level Security (database layer)', () => {
  it('the API role neither is a superuser nor bypasses RLS', async () => {
    await expect(assertRoleEnforcesRls()).resolves.toBeUndefined();
  });

  it('sees nothing when no tenant is set', async () => {
    const rows = await asTenant(null, (q) => q('SELECT * FROM projects'));
    expect(rows.rowCount).toBe(0);
  });

  it("only sees its own tenant's rows with no WHERE clause", async () => {
    const rows = await asTenant(a.tenantId, (q) => q('SELECT name, tenant_id FROM projects'));
    expect(rows.rows.length).toBeGreaterThan(0);
    expect(rows.rows.every((r: any) => r.tenant_id === a.tenantId)).toBe(true);
    expect(rows.rows.map((r: any) => r.name)).not.toContain('B-only');
  });

  it('cannot read other tenants from users / tenants either', async () => {
    const users = await asTenant(a.tenantId, (q) => q('SELECT DISTINCT tenant_id FROM users'));
    expect(users.rows.map((r: any) => r.tenant_id)).toEqual([a.tenantId]);
    const tenants = await asTenant(a.tenantId, (q) => q('SELECT id FROM tenants'));
    expect(tenants.rows.map((r: any) => r.id)).toEqual([a.tenantId]);
  });

  it("cannot INSERT a row for another tenant (WITH CHECK)", async () => {
    await expect(
      asTenant(a.tenantId, (q) =>
        q('INSERT INTO projects (name, tenant_id) VALUES ($1, $2)', ['sneaky', b.tenantId])
      )
    ).rejects.toMatchObject({ code: '42501' });
  });

  it("cannot UPDATE another tenant's rows", async () => {
    const res = await asTenant(a.tenantId, (q) =>
      q("UPDATE projects SET name = 'hacked' WHERE tenant_id = $1", [b.tenantId])
    );
    expect(res.rowCount).toBe(0);
  });

  it('cannot create tenants or touch them directly', async () => {
    await expect(
      asTenant(a.tenantId, (q) => q("INSERT INTO tenants (name, slug) VALUES ('x', 'test-direct')"))
    ).rejects.toMatchObject({ code: '42501' });
  });

  it("the set_config tenant does not leak to the next use of a pooled connection", async () => {
    const client = await appPool.connect();
    try {
      await client.query('BEGIN');
      await client.query("SELECT set_config('app.tenant_id', $1, true)", [String(a.tenantId)]);
      await client.query('COMMIT');
      const after = await client.query('SELECT count(*)::int AS n FROM projects');
      expect(after.rows[0].n).toBe(0);
    } finally {
      client.release();
    }
  });
});
