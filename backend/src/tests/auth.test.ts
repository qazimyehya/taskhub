import request from 'supertest';
import express from 'express';
import cookieParser from 'cookie-parser';
import authRoutes from '../routes/auth';
import projectRoutes from '../routes/projects';
import pool from '../db';

// Create test app
const app = express();
app.use(express.json());
app.use(cookieParser());
app.use('/auth', authRoutes);
app.use('/projects', projectRoutes);

// Test data
const tenantA = {
  email: 'test@tenant-a.com',
  password: 'password123',
  firstName: 'Test',
  lastName: 'User',
  tenantName: 'Tenant A',
  tenantSlug: 'tenant-a-test',
};

const tenantB = {
  email: 'test@tenant-b.com',
  password: 'password123',
  firstName: 'Test',
  lastName: 'User',
  tenantName: 'Tenant B',
  tenantSlug: 'tenant-b-test',
};

let tokenA: string;
let tokenB: string;
let projectIdA: number;

// Clean up test data after all tests
afterAll(async () => {
  // Delete in correct order (foreign keys!)
  // 1. Delete tasks first
  await pool.query(
    `DELETE FROM tasks WHERE tenant_id IN (
      SELECT id FROM tenants WHERE slug IN ('tenant-a-test', 'tenant-b-test')
    )`
  );
  // 2. Delete projects
  await pool.query(
    `DELETE FROM projects WHERE tenant_id IN (
      SELECT id FROM tenants WHERE slug IN ('tenant-a-test', 'tenant-b-test')
    )`
  );
  // 3. Delete users
  await pool.query(
    `DELETE FROM users WHERE tenant_id IN (
      SELECT id FROM tenants WHERE slug IN ('tenant-a-test', 'tenant-b-test')
    )`
  );
  // 4. Delete tenants
  await pool.query(
    `DELETE FROM tenants WHERE slug IN ('tenant-a-test', 'tenant-b-test')`
  );
  await pool.end();
});
// ─────────────────────────────────────────
// AUTH TESTS
// ─────────────────────────────────────────
describe('Authentication', () => {

  test('Should signup Tenant A successfully', async () => {
    const res = await request(app)
      .post('/auth/signup')
      .send(tenantA);

    expect(res.status).toBe(201);
    expect(res.body.message).toBe('Account created successfully');
    expect(res.body.accessToken).toBeDefined();
    expect(res.body.user.role).toBe('admin');
    expect(res.body.user.tenantId).toBeDefined();

    tokenA = res.body.accessToken;
  });

  test('Should signup Tenant B successfully', async () => {
    const res = await request(app)
      .post('/auth/signup')
      .send(tenantB);

    expect(res.status).toBe(201);
    expect(res.body.accessToken).toBeDefined();

    tokenB = res.body.accessToken;
  });

  test('Should not signup with duplicate slug', async () => {
    const res = await request(app)
      .post('/auth/signup')
      .send(tenantA);

    expect(res.status).toBe(409);
    expect(res.body.error).toBe('Conflict');
  });

  test('Should login successfully', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({
        email: tenantA.email,
        password: tenantA.password,
        tenantSlug: tenantA.tenantSlug,
      });

    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeDefined();
    expect(res.body.user.email).toBe(tenantA.email);
  });

  test('Should not login with wrong password', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({
        email: tenantA.email,
        password: 'wrongpassword',
        tenantSlug: tenantA.tenantSlug,
      });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Unauthorized');
  });

  test('Should not login with wrong tenant', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({
        email: tenantA.email,
        password: tenantA.password,
        tenantSlug: 'wrong-tenant',
      });

    expect(res.status).toBe(401);
  });

  test('Should reject request without token', async () => {
    const res = await request(app)
      .get('/projects');

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Unauthorized');
  });

  test('Should reject invalid token', async () => {
    const res = await request(app)
      .get('/projects')
      .set('Authorization', 'Bearer invalidtoken123');

    expect(res.status).toBe(401);
  });
});

// ─────────────────────────────────────────
// TENANT ISOLATION TESTS
// ─────────────────────────────────────────
describe('Tenant Isolation', () => {

  test('Tenant A can create a project', async () => {
    const res = await request(app)
      .post('/projects')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ name: 'Tenant A Project', description: 'Test project' });

    expect(res.status).toBe(201);
    expect(res.body.project.name).toBe('Tenant A Project');

    projectIdA = res.body.project.id;
  });

  test('Tenant B can create their own project', async () => {
    const res = await request(app)
      .post('/projects')
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ name: 'Tenant B Project', description: 'Test project' });

    expect(res.status).toBe(201);
    expect(res.body.project.name).toBe('Tenant B Project');
  });

  test('Tenant B CANNOT see Tenant A projects', async () => {
    const res = await request(app)
      .get('/projects')
      .set('Authorization', `Bearer ${tokenB}`);

    expect(res.status).toBe(200);

    // Tenant B should only see their own projects
    const projectNames = res.body.projects.map((p: any) => p.name);
    expect(projectNames).not.toContain('Tenant A Project');
    expect(projectNames).toContain('Tenant B Project');
  });

  test('Tenant A CANNOT see Tenant B projects', async () => {
    const res = await request(app)
      .get('/projects')
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(200);

    const projectNames = res.body.projects.map((p: any) => p.name);
    expect(projectNames).toContain('Tenant A Project');
    expect(projectNames).not.toContain('Tenant B Project');
  });

  test('Tenant B CANNOT access Tenant A project by ID', async () => {
    const res = await request(app)
      .get(`/projects/${projectIdA}`)
      .set('Authorization', `Bearer ${tokenB}`);

    expect(res.status).toBe(404);
  });

  test('Tenant B CANNOT delete Tenant A project', async () => {
    const res = await request(app)
      .delete(`/projects/${projectIdA}`)
      .set('Authorization', `Bearer ${tokenB}`);

    expect(res.status).toBe(404);
  });
});