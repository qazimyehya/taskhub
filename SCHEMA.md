cat > SCHEMA.md << 'EOF'
# TaskHub Database Schema Design

## Overview

TaskHub uses a **shared schema, shared tables** multi-tenancy model in PostgreSQL. Every table has a `tenant_id` foreign key column, with data isolation enforced at both the application and database layers.

---

## 1. Isolation Strategy: Shared Schema, Shared Tables

### Why This Approach?

We chose **Option 1** over the alternatives for these reasons:

**vs. Schema-per-tenant (Option 2):**
- ✅ Simpler migrations (one schema to manage)
- ✅ Easier cross-tenant reporting if needed
- ✅ Less operational overhead
- ❌ Requires discipline in application code (every query must filter by tenant_id)

**vs. Database-per-tenant (Option 3):**
- ✅ Much simpler (single database connection string)
- ✅ No connection pooling complexity
- ✅ Easier backup/restore (one DB for all tenants)
- ❌ Less isolation than separate DBs, but isolation via RLS is solid

### Trade-offs

| Aspect | Our Choice | Impact |
|--------|-----------|--------|
| **Query Complexity** | Medium | Every query must include `WHERE tenant_id = ?` |
| **Blast Radius** | Medium | Bug affects all tenants if filtering forgotten |
| **Per-Tenant Backup** | Easy | Single database, can filter by tenant_id |
| **Noisy Neighbor Risk** | Medium | One tenant's heavy queries can slow others |
| **Migration Overhead** | Low | Add column to existing tables, no new schemas |
| **Scalability** | High | Can shard by tenant_id later if needed |

---

## 2. Database Schema

### Entity Relationship Diagram

---

## 3. Table Definitions

### Tenants Table
```sql
CREATE TABLE tenants (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) UNIQUE NOT NULL,
  plan VARCHAR(50),                    -- 'free', 'pro', 'enterprise'
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP                 -- soft delete
);
```
**Purpose:** Represent each organization/company using TaskHub

**Key Field:** `slug` — unique identifier for URLs/subdomains

---

### Users Table
```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) NOT NULL,         -- Can repeat across tenants
  password_hash VARCHAR(255) NOT NULL, -- bcrypt hashed
  first_name VARCHAR(255),
  last_name VARCHAR(255),
  tenant_id INTEGER NOT NULL REFERENCES tenants(id),
  role VARCHAR(50) DEFAULT 'member',   -- 'admin' or 'member'
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP
);

-- Unique constraint: email per tenant (not globally unique)
ALTER TABLE users ADD CONSTRAINT users_email_tenant_unique 
  UNIQUE(email, tenant_id);
```

**Purpose:** Users who login to TaskHub

**Key Design:**
- Email can exist in multiple tenants (e.g., alice@company.com in both Company A and Company B)
- Unique constraint is `(email, tenant_id)` combo, not email alone
- Role scoped to tenant (alice is admin in Company A, member in Company B)

---

### Projects Table
```sql
CREATE TABLE projects (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id),
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP
);
```

**Purpose:** Group tasks into projects

**Key Field:** `tenant_id` — every project belongs to exactly one tenant

---

### Tasks Table
```sql
CREATE TABLE tasks (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  status VARCHAR(50) DEFAULT 'todo',   -- 'todo', 'in_progress', 'done'
  priority VARCHAR(50),                -- 'low', 'medium', 'high'
  project_id INTEGER NOT NULL REFERENCES projects(id),
  tenant_id INTEGER NOT NULL REFERENCES tenants(id),
  assigned_to INTEGER REFERENCES users(id),
  due_date DATE,
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP
);
```

**Purpose:** Individual to-do items

**Key Fields:**
- `tenant_id` — Redundant but critical for query performance
- `status` — Always one of: 'todo', 'in_progress', 'done'
- `assigned_to` — Can be NULL (unassigned)
- `deleted_at` — Soft delete for audit trail

---

## 4. Indexing Strategy

### Indexes Created

Declared in `backend/prisma/schema.prisma` (so Prisma migrations never drop them) and created by the
`tenant_integrity_indexes_refresh_tokens` migration:

| Index | Columns | Why |
|-------|---------|-----|
| `users_tenant_id_idx`, `users_email_idx` | `tenant_id` / `email` | user lookups by tenant / email |
| `projects_tenant_id_idx` | `tenant_id` | project lists |
| `project_members_tenant_id_idx`, `project_members_user_id_idx` | | membership lookups |
| `tasks_tenant_id_idx`, `tasks_project_id_idx`, `tasks_assigned_to_idx` | single column | FK lookups / "my tasks" |
| `tasks_tenant_id_project_id_idx` | `(tenant_id, project_id)` | tasks of a project inside a tenant |
| `tasks_tenant_id_status_idx` | `(tenant_id, status)` | status filter |
| `tasks_tenant_id_created_at_idx` | `(tenant_id, created_at DESC)` | default list ordering + pagination |
| `idx_tasks_title_trgm`, `idx_tasks_description_trgm` | GIN `gin_trgm_ops` (`pg_trgm`) | `ILIKE '%term%'` search without a seq scan |

Also created: `UNIQUE (tenant_id, id)` on `users` and `projects`, the targets of the composite foreign keys in section 5.

---

---

## 5. Data Isolation: Preventing Leaks

### How We Prevent One Tenant Seeing Another's Data

#### 1. Application-Layer Filtering (ENFORCED)
Every query includes `WHERE tenant_id = ?`:

```javascript
// ✅ SAFE: Filters by tenant_id
const tasks = await pool.query(
  'SELECT * FROM tasks WHERE tenant_id = $1 AND project_id = $2',
  [userTenantId, projectId]
);

// ❌ UNSAFE: Missing tenant_id filter
const tasks = await pool.query('SELECT * FROM tasks WHERE project_id = $1', [projectId]);
```

#### 2. Token Extraction (ENFORCED)
`tenant_id` comes from JWT token, never from request body:

```javascript
// ✅ SAFE: tenant_id from token
const userTenantId = req.user.tenantId; // From JWT

// ❌ UNSAFE: tenant_id from request
const userTenantId = req.body.tenant_id; // User could spoof!
```

#### 3. Row-Level Security (ENFORCED)
Every tenant table has `ENABLE` + `FORCE ROW LEVEL SECURITY` with a policy of the form:

```sql
CREATE POLICY tasks_tenant_isolation ON tasks
  USING      (tenant_id = app_current_tenant())
  WITH CHECK (tenant_id = app_current_tenant());
```

`app_current_tenant()` reads `app.tenant_id` (NULL when unset, so "no tenant" means "no rows").
For the policies to bind, three things must all be true — each is guarded:

1. **The API connects as `taskhub_app`**, a role that owns nothing and cannot bypass RLS. (Superusers and
   table owners bypass RLS, which is what the original setup did wrong.) `server.ts` refuses to start if
   the connected role is a superuser or has `BYPASSRLS`.
2. **The tenant is set per transaction**: `withTenant()` in `src/db.ts` runs
   `BEGIN; SELECT set_config('app.tenant_id', $1, true); …; COMMIT`. `is_local = true` means it can never
   leak to the next request that reuses the pooled connection.
3. **Pre-login lookups use two `SECURITY DEFINER` functions** (`app_find_tenant_id`, `app_create_tenant`)
   instead of a wide-open policy on `tenants`.

`backend/src/tests/rls.test.ts` queries Postgres *as the API role with no `WHERE tenant_id`* and asserts
it only sees its own rows, can't write another tenant's, and can't create tenants directly.

#### 4. Tenant-scoped Foreign Keys (ENFORCED)
Plain FKs only prove the referenced row *exists*, not that it's in the same tenant. So every reference to a
tenant-owned row is composite:

```sql
tasks (tenant_id, project_id)  → projects (tenant_id, id)
tasks (tenant_id, assigned_to) → users    (tenant_id, id)
tasks (tenant_id, created_by)  → users    (tenant_id, id)
project_members (tenant_id, project_id | user_id), projects (tenant_id, created_by), refresh_tokens (tenant_id, user_id)
```

A task in tenant A can therefore never point at a project or user of tenant B, even if application code
forgets to check (nullable columns use `MATCH SIMPLE`, so unassigned tasks are unaffected).

---

## 6. Soft Deletes (Audit Trail)

All core tables have `deleted_at` timestamp:

```javascript
// ✅ Soft delete: record stays in DB
UPDATE tasks SET deleted_at = NOW() WHERE id = 1;

// ✅ Query doesn't return deleted records
SELECT * FROM tasks WHERE tenant_id = 1 AND deleted_at IS NULL;

// ✅ Audit: can see deletion history
SELECT * FROM tasks WHERE tenant_id = 1 AND deleted_at IS NOT NULL;

// ❌ NEVER hard delete (data loss, audit trail lost)
DELETE FROM tasks WHERE id = 1;
```

---

## 7. Design Decisions

### Decision 1: Redundant tenant_id in Tasks
**Decision:** Include `tenant_id` in tasks table even though it could be derived via project

**Rationale:**
- ✅ Query performance (don't need to JOIN projects to filter)
- ✅ Data validation (can check task.tenant_id matches project.tenant_id)
- ✅ Prevents bugs (if project is deleted, task still has tenant context)

### Decision 2: Allow Same Email Across Tenants
**Decision:** Email unique per tenant, not globally

**Rationale:**
- ✅ Real-world scenario (alice@company.com works in 2 companies)
- ✅ No conflict (email unique by `(email, tenant_id)` composite)
- ✅ Simpler than managing cross-tenant users

### Decision 3: Soft Deletes Only
**Decision:** No hard deletes; use soft deletes with `deleted_at`

**Rationale:**
- ✅ Audit trail (know when/what was deleted)
- ✅ Recovery (can restore if needed)
- ✅ Compliance (some regulations require deletion history)
- ❌ Takes slightly more storage

---

## 8. Migration Strategy

All tables were created in single SQL script:

```bash
psql -U postgres -d taskhub_db < schema.sql
```

For future changes:
```bash
-- Add column to existing table
ALTER TABLE tasks ADD COLUMN archived BOOLEAN DEFAULT FALSE;

-- Create new index
CREATE INDEX idx_tasks_archived ON tasks(archived) WHERE deleted_at IS NULL;
```

---

## 9. Performance Considerations

### Current Setup
- ✅ Indexes on all tenant_id columns
- ✅ Indexes on foreign keys
- ✅ Can handle 1000s of tenants efficiently

### Future Optimization (if needed)
- Partitioning by `tenant_id` (for millions of records)
- Read replicas for reporting queries
- Caching layer (Redis)

---

## 10. Security Summary

| Layer | Status | How It Works |
|-------|--------|------------|
| **Database** | ✅ Complete | Composite tenant-scoped FKs + RLS (as a non-bypass role) |
| **Application** | ✅ Complete | Every query filters by tenant_id from JWT and runs inside `withTenant()` |
| **RLS Policies** | ✅ Enforced | `taskhub_app` role, per-transaction `app.tenant_id`, startup guard, tested |
| **Soft Deletes** | ✅ Complete | Audit trail preserved, no hard deletes |
| **JWT Tokens** | ✅ Complete | tenant_id extracted from token, not request |

---

## Conclusion

This design balances **simplicity** (shared schema) with **security** (tenant_id on every table) and **auditability** (soft deletes). The main risk is developer discipline — forgetting a `WHERE tenant_id = ?` filter would leak data — but this is mitigated by:

1. Code review practices
2. Unit tests that verify isolation
3. RLS policies + tenant-scoped foreign keys (database-level safety net, covered by `rls.test.ts`)

---

**Last Updated:** September 19, 2026
