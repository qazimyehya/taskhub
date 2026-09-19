# TaskHub

Multi-tenant task management: organizations sign up, invite members, and manage projects and tasks in isolation from every other organization.

**Stack:** Node.js · Express · TypeScript · PostgreSQL 15 · Prisma (migrations only) · `pg` at runtime · Zod · JWT · React · Vite · React Query · Zustand · Nginx · Docker

## Quick start (Docker)

```bash
cp .env.example .env        # then fill in the CHANGE_ME values (openssl rand -hex 32)
docker compose up --build -d
```

- App: <http://localhost> (use Chrome; Safari lacks `requestIdleCallback`)
- API (direct, this machine only): <http://localhost:3001/health>
- Postgres is published to the host on `127.0.0.1:5433` (override with `POSTGRES_HOST_PORT`) so it doesn't clash with a local Postgres on 5432.
- The UI talks to the API through nginx at `/api`, so there's no CORS and the backend sees real client IPs.

On start the backend runs the Prisma migrations as the DB owner, sets the password of the restricted `taskhub_app` role, then starts the API as that role.

## Local development

```bash
# 1. Postgres running locally with a taskhub_db database
cd backend
cp .env.example .env         # fill in DATABASE_URL (owner), APP_DB_PASSWORD, APP_DATABASE_URL, secrets
npm install
npm run db:migrate           # migrations + sets the taskhub_app password
npm run dev                  # http://localhost:3001

cd ../frontend
cp .env.example .env
npm install
npm run dev                  # http://localhost:5173
```

## Tests

Tests run against their **own** database and refuse to start against anything not named `*_test`.

```bash
cd backend
cp .env.test.example .env.test   # edit passwords
npm run test:db:setup            # creates taskhub_test, migrates, sets the app-role password
npm test
```

| Suite | What it proves |
| --- | --- |
| `auth.test.ts` | signup / login / tokens, application-level tenant isolation |
| `rls.test.ts` | **database-level** isolation: queries as the API's own role with *no* `WHERE tenant_id` only see their tenant; cross-tenant writes and tenant creation are refused |
| `security.test.ts` | cross-tenant assignee rejected (API + composite FK), input validation, PATCH null-clearing, refresh rotation / logout revocation / removed users, role checks, signup race |
| `ratelimit.test.ts` | login attempts are limited per IP |

## Multi-tenancy & security model

Shared schema, shared tables, `tenant_id` on every row. Isolation is enforced at three independent layers:

1. **Application** – `tenantId` always comes from the verified JWT (never the request body) and every query filters by it.
2. **Row Level Security** – every tenant table has `ENABLE` + `FORCE ROW LEVEL SECURITY`, with policies `tenant_id = app_current_tenant()`. Every request runs in a transaction that starts with `set_config('app.tenant_id', <id>, true)` (`withTenant()` in [`backend/src/db.ts`](backend/src/db.ts)).
   RLS only means something if the connecting role can't bypass it — superusers and table owners always can. So the API connects as **`taskhub_app`** (owns nothing, no `BYPASSRLS`), and `server.ts` **refuses to start** if `APP_DATABASE_URL` resolves to a role that bypasses RLS. `DATABASE_URL` (owner) is only used for migrations.
   Signup/login must find a tenant before a tenant context exists; that goes through two narrow `SECURITY DEFINER` functions rather than a permissive policy.
3. **Tenant-scoped foreign keys** – references to tenant-owned rows are composite (`(tenant_id, project_id) → projects(tenant_id, id)`, same for assignees/creators/members), so a row can never point at another tenant's data even if application code forgets a check.

Other decisions:

| Topic | Decision |
| --- | --- |
| Access token | JWT, 15 min, kept in memory / Zustand |
| Refresh token | JWT, 7 days, `httpOnly` `SameSite=Strict` cookie. **Stored hashed in `refresh_tokens`**, rotated on every refresh, revoked on logout and when a user is removed. A token rotated <10 s ago still yields an access token, so two tabs refreshing at once aren't logged out. |
| Refresh re-checks the DB | Removed users can't refresh; role changes apply at the next refresh (≤15 min; access tokens themselves aren't re-checked per request) |
| Passwords | bcrypt, 12 rounds, ≤72 chars (bcrypt's limit); login takes the same time whether or not the account exists |
| Rate limiting | Per client IP, 15 min window: login (failed attempts only) and signup limited to `AUTH_RATE_LIMIT_MAX` (default **10** in production, 100 otherwise); refresh has its own bucket of 100. `TRUST_PROXY=1` behind nginx, which overwrites `X-Forwarded-For`. |
| Validation | Zod on frontend and backend, including query strings and ids (bad input is a 400, never a 500). `limit` ≤ 100. |
| PATCH | Absent key = unchanged, `null` = clear (assignee, due date, description, priority) |
| Search | Server-side `ILIKE` on title + description, `%`/`_` escaped, trigram GIN indexes |
| Pagination | Offset (`page` / `limit`) – fits a page-numbered task UI |
| Soft deletes | `deleted_at` everywhere; removed users are re-activated if re-invited |
| Errors | Central error handler; stack traces/messages hidden in production |
| Authorization | Admins: everything. Members: create tasks/projects, edit tasks, edit projects they created or belong to, delete tasks they created or are assigned to. Only admins manage users, project deletion and project membership. |

Full schema and index rationale: [SCHEMA.md](SCHEMA.md), [ER_DIAGRAM.md](ER_DIAGRAM.md).

## API

Auth (rate limited): `POST /auth/signup` · `POST /auth/login` · `POST /auth/refresh` · `POST /auth/logout`

Users: `GET /users` · `POST /users/invite` (admin) · `PATCH /users/:id/role` (admin) · `DELETE /users/:id` (admin)

Projects: `GET /projects` · `GET /projects/:id` · `POST /projects` · `PATCH /projects/:id` · `DELETE /projects/:id` (admin) · `POST /projects/:id/members` (admin) · `DELETE /projects/:id/members/:userId` (admin)

Tasks: `GET /tasks?search=&status=&assignee=&projectId=&page=&limit=` · `GET /tasks/:id` · `POST /tasks` · `PATCH /tasks/:id` · `DELETE /tasks/:id`

`GET /health` – liveness + DB check.

## Configuration

| Variable | Where | Purpose |
| --- | --- | --- |
| `POSTGRES_PASSWORD` | root `.env` | Postgres superuser password (Docker) |
| `DATABASE_URL` | `backend/.env` | Owner connection – migrations only |
| `APP_DB_PASSWORD`, `APP_DATABASE_URL` | both | Restricted `taskhub_app` role the API runs as |
| `JWT_SECRET`, `REFRESH_TOKEN_SECRET` | both | Must be different, ≥ 32 random bytes recommended |
| `AUTH_RATE_LIMIT_MAX` | optional | Login/signup attempts per IP per 15 min |
| `TRUST_PROXY` | optional | Reverse-proxy hops in front of the API (compose sets `1`) |
| `CORS_ORIGINS` | optional | Comma-separated allowed origins (dev only; Docker is same-origin) |
| `COOKIE_SECURE` | optional | Defaults to `true` in production |

`.env` files are git-ignored; commit only the `.env.example` files. Missing required variables stop the server at startup with a clear message.

## Roadmap

- Cursor-based pagination option
- Email notifications on task assignment
- Per-request re-validation of access tokens (currently ≤15 min of staleness after a demotion/removal)
