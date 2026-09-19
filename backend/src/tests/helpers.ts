import request from 'supertest';
import { Pool } from 'pg';
import { createApp } from '../app';

export const app = createApp();

// Owner connection (bypasses RLS) — used for cleanup and for tampering with rows
// the API itself can't touch. Points at the *_test database (see setup.ts).
export const adminPool = new Pool({ connectionString: process.env.DATABASE_URL });

// Restricted connection, identical to what the API uses.
export const appPool = new Pool({ connectionString: process.env.APP_DATABASE_URL });

export const uniq = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export interface TestTenant {
  slug: string;
  email: string;
  password: string;
  token: string;
  cookie: string[];
  tenantId: number;
  userId: number;
}

export async function signupTenant(label: string): Promise<TestTenant> {
  const slug = `test-${label}-${uniq()}`;
  const email = `admin@${slug}.com`;
  const password = 'password123';

  const res = await request(app).post('/auth/signup').send({
    email,
    password,
    firstName: 'Test',
    lastName: 'Admin',
    tenantName: `Tenant ${label}`,
    tenantSlug: slug,
  });
  if (res.status !== 201) throw new Error(`signup failed: ${res.status} ${JSON.stringify(res.body)}`);

  return {
    slug,
    email,
    password,
    token: res.body.accessToken,
    cookie: res.headers['set-cookie'] as unknown as string[],
    tenantId: res.body.user.tenantId,
    userId: res.body.user.id,
  };
}

export const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

export async function createProject(token: string, name = 'Project') {
  const res = await request(app).post('/projects').set(auth(token)).send({ name });
  if (res.status !== 201) throw new Error(`createProject failed: ${res.status}`);
  return res.body.project as { id: number };
}

// Invite a member and log them in.
export async function addMember(admin: TestTenant, label = 'member') {
  const email = `${label}-${uniq()}@${admin.slug}.com`;
  const invite = await request(app)
    .post('/users/invite')
    .set(auth(admin.token))
    .send({ email, password: 'password123', firstName: 'M', lastName: 'M' });
  if (invite.status !== 201) throw new Error(`invite failed: ${invite.status}`);

  const login = await request(app)
    .post('/auth/login')
    .send({ email, password: 'password123', tenantSlug: admin.slug });

  return {
    id: invite.body.user.id as number,
    email,
    token: login.body.accessToken as string,
    cookie: login.headers['set-cookie'] as unknown as string[],
  };
}

export const cookieValue = (setCookie: string[] | undefined) =>
  (setCookie || []).find((c) => c.startsWith('refreshToken='))?.split(';')[0];

export async function cleanupTestTenants() {
  const ids = `(SELECT id FROM tenants WHERE slug LIKE 'test-%')`;
  for (const table of ['tasks', 'project_members', 'projects', 'refresh_tokens', 'users']) {
    await adminPool.query(`DELETE FROM ${table} WHERE tenant_id IN ${ids}`);
  }
  await adminPool.query(`DELETE FROM tenants WHERE slug LIKE 'test-%'`);
}
