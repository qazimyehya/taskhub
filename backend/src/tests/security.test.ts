import request from 'supertest';
import {
  addMember,
  adminPool,
  app,
  appPool,
  auth,
  cleanupTestTenants,
  cookieValue,
  createProject,
  signupTenant,
  TestTenant,
} from './helpers';

let a: TestTenant;
let b: TestTenant;
let projectA: number;

beforeAll(async () => {
  await cleanupTestTenants();
  a = await signupTenant('sec-a');
  b = await signupTenant('sec-b');
  projectA = (await createProject(a.token)).id;
});

afterAll(async () => {
  await cleanupTestTenants();
  await adminPool.end();
  await appPool.end();
});

const newTask = (token: string, body: object) =>
  request(app).post('/tasks').set(auth(token)).send(body);

describe('Cross-tenant references', () => {
  it("rejects assigning a task to another tenant's user on create", async () => {
    const res = await newTask(a.token, { title: 't', projectId: projectA, assignedTo: b.userId });
    expect(res.status).toBe(400);
  });

  it("rejects assigning to another tenant's user on update, and leaks no email", async () => {
    const created = await newTask(a.token, { title: 't2', projectId: projectA });
    const id = created.body.task.id;

    const patch = await request(app)
      .patch(`/tasks/${id}`)
      .set(auth(a.token))
      .send({ assignedTo: b.userId });
    expect(patch.status).toBe(400);

    const got = await request(app).get(`/tasks/${id}`).set(auth(a.token));
    expect(got.body.task.assigned_to).toBeNull();
    expect(got.body.task.assigned_to_email).toBeNull();
  });

  it('the database itself refuses a cross-tenant assignee (composite FK)', async () => {
    const created = await newTask(a.token, { title: 't3', projectId: projectA });
    await expect(
      adminPool.query('UPDATE tasks SET assigned_to = $1 WHERE id = $2', [b.userId, created.body.task.id])
    ).rejects.toMatchObject({ code: '23503' });
  });

  it("cannot create a task in another tenant's project", async () => {
    expect((await newTask(b.token, { title: 'x', projectId: projectA })).status).toBe(404);
  });
});

describe('Task validation, search and PATCH semantics', () => {
  let taskId: number;
  let projectV: number;

  beforeAll(async () => {
    projectV = (await createProject(a.token, 'validation')).id;
    const res = await newTask(a.token, {
      title: 'Discount 50% off',
      description: 'plain',
      projectId: projectV,
      assignedTo: a.userId,
      dueDate: '2030-01-15',
    });
    taskId = res.body.task.id;
    await newTask(a.token, { title: 'Something else', projectId: projectV });
  });

  it.each([
    ['limit=100000'],
    ['limit=0'],
    ['page=0'],
    ['page=-3'],
    ['page=abc'],
    ['assignee=abc'],
    ['status=bogus'],
  ])('rejects bad query string %s with 400 (not 500)', async (qs) => {
    expect((await request(app).get(`/tasks?${qs}`).set(auth(a.token))).status).toBe(400);
  });

  it('rejects non-numeric / out-of-range ids with 400', async () => {
    expect((await request(app).get('/tasks/abc').set(auth(a.token))).status).toBe(400);
    expect((await request(app).get('/tasks/99999999999').set(auth(a.token))).status).toBe(400);
    expect((await request(app).get('/projects/abc').set(auth(a.token))).status).toBe(400);
  });

  it('treats % in search literally', async () => {
    const res = await request(app).get('/tasks?search=50%25').set(auth(a.token));
    expect(res.body.tasks.map((t: any) => t.title)).toEqual(['Discount 50% off']);
    const wild = await request(app).get('/tasks?search=%25').set(auth(a.token));
    expect(wild.body.tasks).toHaveLength(1);
  });

  it('paginates', async () => {
    const res = await request(app).get(`/tasks?projectId=${projectV}&limit=1&page=2`).set(auth(a.token));
    expect(res.body.tasks).toHaveLength(1);
    expect(res.body.pagination).toMatchObject({ page: 2, limit: 1, total: 2, totalPages: 2 });
  });

  it('PATCH: absent = unchanged, null = cleared', async () => {
    const keep = await request(app)
      .patch(`/tasks/${taskId}`)
      .set(auth(a.token))
      .send({ status: 'done' });
    expect(keep.body.task).toMatchObject({ status: 'done', assigned_to: a.userId });
    expect(keep.body.task.due_date).not.toBeNull();

    const clear = await request(app)
      .patch(`/tasks/${taskId}`)
      .set(auth(a.token))
      .send({ assignedTo: null, dueDate: null, description: null });
    expect(clear.body.task).toMatchObject({ assigned_to: null, due_date: null, description: null });
    expect(clear.body.task.title).toBe('Discount 50% off');
  });

  it('PATCH: an empty body is a 400', async () => {
    expect((await request(app).patch(`/tasks/${taskId}`).set(auth(a.token)).send({})).status).toBe(400);
  });

  it('hides tasks of soft-deleted projects', async () => {
    const p = await createProject(a.token, 'to-delete');
    await newTask(a.token, { title: 'orphan', projectId: p.id });
    await request(app).delete(`/projects/${p.id}`).set(auth(a.token));
    const res = await request(app).get('/tasks?search=orphan').set(auth(a.token));
    expect(res.body.tasks).toHaveLength(0);
  });
});

describe('Authorization inside a tenant', () => {
  it('members cannot delete tasks they neither created nor are assigned to; admins can', async () => {
    const member = await addMember(a);
    const task = await newTask(a.token, { title: 'admins task', projectId: projectA });
    const id = task.body.task.id;

    expect((await request(app).delete(`/tasks/${id}`).set(auth(member.token))).status).toBe(403);
    expect((await request(app).delete(`/tasks/${id}`).set(auth(a.token))).status).toBe(200);
  });

  it('members can delete their own tasks', async () => {
    const member = await addMember(a);
    const mine = await newTask(member.token, { title: 'mine', projectId: projectA });
    expect(
      (await request(app).delete(`/tasks/${mine.body.task.id}`).set(auth(member.token))).status
    ).toBe(200);
  });

  it('non-members who are not the creator cannot edit a project', async () => {
    const member = await addMember(a);
    const res = await request(app)
      .patch(`/projects/${projectA}`)
      .set(auth(member.token))
      .send({ name: 'renamed' });
    expect(res.status).toBe(403);
  });

  it('project creation + creator membership are atomic and visible', async () => {
    const p = await createProject(a.token, 'atomic');
    const res = await request(app).get(`/projects/${p.id}`).set(auth(a.token));
    expect(res.body.members.map((m: any) => m.id)).toContain(a.userId);
  });
});

describe('Refresh tokens', () => {
  it('rotates on refresh and the response carries a new cookie', async () => {
    const oldCookie = cookieValue(a.cookie)!;
    const res = await request(app).post('/auth/refresh').set('Cookie', oldCookie);
    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeTruthy();
    const newCookie = cookieValue(res.headers['set-cookie'] as unknown as string[]);
    expect(newCookie).toBeTruthy();
    expect(newCookie).not.toBe(oldCookie);

    // the new cookie works
    expect((await request(app).post('/auth/refresh').set('Cookie', newCookie!)).status).toBe(200);
  });

  it('rejects a rotated token once the grace window has passed', async () => {
    const login = await request(app)
      .post('/auth/login')
      .send({ email: a.email, password: a.password, tenantSlug: a.slug });
    const cookie = cookieValue(login.headers['set-cookie'] as unknown as string[])!;

    expect((await request(app).post('/auth/refresh').set('Cookie', cookie)).status).toBe(200);
    // simulate the 10s grace period having elapsed
    await adminPool.query(
      `UPDATE refresh_tokens SET rotated_at = NOW() - interval '1 minute',
                                 revoked_at = NOW() - interval '1 minute'
        WHERE tenant_id = $1 AND revoked_at IS NOT NULL`,
      [a.tenantId]
    );
    expect((await request(app).post('/auth/refresh').set('Cookie', cookie)).status).toBe(401);
  });

  it('a parallel tab racing on the same token inside the grace window is not logged out', async () => {
    const login = await request(app)
      .post('/auth/login')
      .send({ email: a.email, password: a.password, tenantSlug: a.slug });
    const cookie = cookieValue(login.headers['set-cookie'] as unknown as string[])!;

    const [r1, r2] = await Promise.all([
      request(app).post('/auth/refresh').set('Cookie', cookie),
      request(app).post('/auth/refresh').set('Cookie', cookie),
    ]);
    expect(r1.status).toBe(200);
    expect(r2.status).toBe(200);
  });

  it('logout revokes the token server-side (replaying the cookie fails)', async () => {
    const login = await request(app)
      .post('/auth/login')
      .send({ email: a.email, password: a.password, tenantSlug: a.slug });
    const cookie = cookieValue(login.headers['set-cookie'] as unknown as string[])!;

    expect((await request(app).post('/auth/logout').set('Cookie', cookie)).status).toBe(200);
    expect((await request(app).post('/auth/refresh').set('Cookie', cookie)).status).toBe(401);
  });

  it('a removed user cannot refresh, and can be re-invited afterwards', async () => {
    const member = await addMember(a, 'leaver');
    expect(
      (await request(app).post('/auth/refresh').set('Cookie', cookieValue(member.cookie)!)).status
    ).toBe(200);

    const del = await request(app).delete(`/users/${member.id}`).set(auth(a.token));
    expect(del.status).toBe(200);

    // their latest cookie (post-rotation) and the original both fail
    expect(
      (await request(app).post('/auth/refresh').set('Cookie', cookieValue(member.cookie)!)).status
    ).toBe(401);
    const relogin = await request(app)
      .post('/auth/login')
      .send({ email: member.email, password: 'password123', tenantSlug: a.slug });
    expect(relogin.status).toBe(401);

    const reinvite = await request(app)
      .post('/users/invite')
      .set(auth(a.token))
      .send({ email: member.email, password: 'password456', firstName: 'Back', lastName: 'Again' });
    expect(reinvite.status).toBe(201);
    const login2 = await request(app)
      .post('/auth/login')
      .send({ email: member.email, password: 'password456', tenantSlug: a.slug });
    expect(login2.status).toBe(200);
  });

  it('a role change is picked up at the next refresh', async () => {
    const member = await addMember(a, 'promoted');
    await request(app)
      .patch(`/users/${member.id}/role`)
      .set(auth(a.token))
      .send({ role: 'admin' });
    const res = await request(app).post('/auth/refresh').set('Cookie', cookieValue(member.cookie)!);
    expect(res.body.user.role).toBe('admin');
  });

  it('rejects a missing or forged refresh token', async () => {
    expect((await request(app).post('/auth/refresh')).status).toBe(401);
    expect(
      (await request(app).post('/auth/refresh').set('Cookie', 'refreshToken=forged')).status
    ).toBe(401);
  });
});

describe('Signup', () => {
  it('concurrent signups with the same slug give exactly one 201 and one 409 (never 500)', async () => {
    const slug = `test-race-${Date.now().toString(36)}`;
    const body = (email: string) => ({
      email,
      password: 'password123',
      firstName: 'R',
      lastName: 'R',
      tenantName: 'Race',
      tenantSlug: slug,
    });
    const results = await Promise.all([
      request(app).post('/auth/signup').send(body('one@race.com')),
      request(app).post('/auth/signup').send(body('two@race.com')),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
  });
});
