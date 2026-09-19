import request from 'supertest';

// Loaded in isolation so the limiter picks up a tiny limit.
let app: import('express').Express;

beforeAll(() => {
  process.env.AUTH_RATE_LIMIT_MAX = '3';
  jest.isolateModules(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    app = require('../app').createApp();
  });
});

describe('Login rate limiting', () => {
  it('returns 429 after the configured number of failed attempts', async () => {
    const attempt = () =>
      request(app)
        .post('/auth/login')
        .send({ email: 'nobody@example.com', password: 'wrong-password', tenantSlug: 'test-none' });

    const statuses: number[] = [];
    for (let i = 0; i < 5; i++) statuses.push((await attempt()).status);

    expect(statuses.slice(0, 3)).toEqual([401, 401, 401]);
    expect(statuses.slice(3)).toEqual([429, 429]);
  });
});
