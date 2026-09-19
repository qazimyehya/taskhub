import request from 'supertest';
import {
  adminPool,
  app,
  appPool,
  auth,
  cleanupTestTenants,
  createProject,
  signupTenant,
  TestTenant,
  uniq,
} from './helpers';

let a: TestTenant;
let b: TestTenant;
let projectIdA: number;

beforeAll(async () => {
  await cleanupTestTenants();
});

afterAll(async () => {
  await cleanupTestTenants();
  await adminPool.end();
  await appPool.end();
});

describe('Auth flow', () => {
  it('signs up tenant A', async () => {
    a = await signupTenant('a');
    expect(a.token).toBeTruthy();
    expect(a.cookie.join(';')).toMatch(/refreshToken=.*HttpOnly/i);
  });

  it('signs up tenant B', async () => {
    b = await signupTenant('b');
    expect(b.tenantId).not.toBe(a.tenantId);
  });

  it('rejects a duplicate slug with 409', async () => {
    const res = await request(app).post('/auth/signup').send({
      email: 'other@example.com',
      password: 'password123',
      firstName: 'X',
      lastName: 'Y',
      tenantName: 'Dup',
      tenantSlug: a.slug,
    });
    expect(res.status).toBe(409);
  });

  it('logs in successfully', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ email: a.email, password: a.password, tenantSlug: a.slug });
    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeTruthy();
    expect(res.body.user.tenantId).toBe(a.tenantId);
  });

  it('rejects a wrong password', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ email: a.email, password: 'nope-nope', tenantSlug: a.slug });
    expect(res.status).toBe(401);
  });

  it('rejects a wrong tenant slug', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ email: a.email, password: a.password, tenantSlug: `test-missing-${uniq()}` });
    expect(res.status).toBe(401);
  });

  it('rejects a missing token', async () => {
    expect((await request(app).get('/projects')).status).toBe(401);
  });

  it('rejects an invalid token', async () => {
    expect((await request(app).get('/projects').set(auth('garbage'))).status).toBe(401);
  });
});

describe('Tenant isolation (application layer)', () => {
  it('tenant A can create a project', async () => {
    projectIdA = (await createProject(a.token, 'Project A')).id;
    expect(projectIdA).toBeGreaterThan(0);
  });

  it('tenant B can create a project', async () => {
    expect((await createProject(b.token, 'Project B')).id).toBeGreaterThan(0);
  });

  it("tenant B cannot see tenant A's projects", async () => {
    const res = await request(app).get('/projects').set(auth(b.token));
    expect(res.body.projects.map((p: any) => p.name)).not.toContain('Project A');
  });

  it("tenant A cannot see tenant B's projects", async () => {
    const res = await request(app).get('/projects').set(auth(a.token));
    expect(res.body.projects.map((p: any) => p.name)).not.toContain('Project B');
  });

  it("tenant B cannot access tenant A's project by id", async () => {
    expect((await request(app).get(`/projects/${projectIdA}`).set(auth(b.token))).status).toBe(404);
  });

  it("tenant B cannot delete tenant A's project", async () => {
    expect((await request(app).delete(`/projects/${projectIdA}`).set(auth(b.token))).status).toBe(404);
    expect((await request(app).get(`/projects/${projectIdA}`).set(auth(a.token))).status).toBe(200);
  });
});
