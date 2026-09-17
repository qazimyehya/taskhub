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

```sql
CREATE INDEX idx_users_tenant_id ON users(tenant_id);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_projects_tenant_id ON projects(tenant_id);
CREATE INDEX idx_tasks_tenant_id ON tasks(tenant_id);
CREATE INDEX idx_tasks_project_id ON tasks(project_id);
CREATE INDEX idx_tasks_assigned_to ON tasks(assigned_to);
```

### Why Each Index?

| Index | Columns | Query Pattern | Why Needed |
|-------|---------|---------------|-----------|
| `idx_users_tenant_id` | `tenant_id` | Login queries filtered by tenant | **CRITICAL** — every user lookup |
| `idx_users_email` | `email` | Find user by email (cross-tenant) | Needed for login flow |
| `idx_projects_tenant_id` | `tenant_id` | List projects for a tenant | **CRITICAL** — frequently accessed |
| `idx_tasks_tenant_id` | `tenant_id` | Verify task belongs to tenant | **CRITICAL** — data isolation check |
| `idx_tasks_project_id` | `project_id` | List tasks in a project | **CRITICAL** — main UI query |
| `idx_tasks_assigned_to` | `assigned_to` | Find tasks assigned to user | For "my tasks" view |

### Composite Index Consideration

**Not created yet, but could add:**
```sql
CREATE INDEX idx_tasks_tenant_project ON tasks(tenant_id, project_id);
```
**Use case:** When listing tasks for a specific project in a specific tenant (join optimization)

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

#### 3. Row-Level Security Policies (OPTIONAL, Not Yet Implemented)
PostgreSQL RLS would enforce at database level:

```sql
-- Proposed (not yet implemented)
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY task_isolation ON tasks
  USING (tenant_id = current_setting('app.current_tenant_id')::int);
```

#### 4. Foreign Key Constraints (ENFORCED)
Database ensures referential integrity:

```sql
-- If a task references a project, that project must exist
-- If that project is in tenant A, task must also be in tenant A
-- (enforced by FK relationship)
```

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
| **Database** | ✅ Partial | Foreign keys enforce referential integrity |
| **Application** | ✅ Complete | Every query filters by tenant_id from JWT |
| **RLS Policies** | ❌ Not Yet | Can add later for belt-and-suspenders |
| **Soft Deletes** | ✅ Complete | Audit trail preserved, no hard deletes |
| **JWT Tokens** | ✅ Complete | tenant_id extracted from token, not request |

---

## Conclusion

This design balances **simplicity** (shared schema) with **security** (tenant_id on every table) and **auditability** (soft deletes). The main risk is developer discipline — forgetting a `WHERE tenant_id = ?` filter would leak data — but this is mitigated by:

1. Code review practices
2. Unit tests that verify isolation
3. Optional RLS policies (database-level safety net)

---

**Last Updated:** September 17, 2026
**Status:** Phase 2 Complete ✅
