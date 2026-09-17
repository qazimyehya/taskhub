                     ┌─────────────────┐
                     │    TENANTS      │
                     ├─────────────────┤
                     │ id (PK)         │
                     │ name            │
                     │ slug (UNIQUE)   │
                     │ plan            │
                     │ created_at      │
                     │ updated_at      │
                     │ deleted_at      │
                     └────────┬────────┘
                              │
              ┌───────────────┼───────────────┐
              │               │               │
              │ (1:N)         │ (1:N)         │ (1:N)
              │               │               │
    ┌─────────▼──────┐ ┌─────▼──────────┐ ┌──┴────────────┐
    │     USERS      │ │   PROJECTS     │ │     TASKS     │
    ├────────────────┤ ├────────────────┤ ├───────────────┤
    │ id (PK)        │ │ id (PK)        │ │ id (PK)       │
    │ email          │ │ name           │ │ title         │
    │ password_hash  │ │ description    │ │ description   │
    │ first_name     │ │ tenant_id (FK) │ │ status        │
    │ last_name      │ │ created_by(FK) │ │ priority      │
    │ tenant_id (FK) │ │ created_at     │ │ project_id(FK)│
    │ role           │ │ updated_at     │ │ tenant_id (FK)│
    │ created_at     │ │ deleted_at     │ │ assigned_to   │
    │ updated_at     │ └────────────────┘ │ due_date      │
    │ deleted_at     │                    │ created_by(FK)│
    └────────┬───────┘                    │ created_at    │
             │                            │ updated_at    │
             │ (1:N)                      │ deleted_at    │
             │                            └───────────────┘
             └────────────────────────────────┤
                  (assigned_to, created_by)   │
                                              │
## Relationships Summary

| Relationship | Type | Description |
|---|---|---|
| Tenants → Users | 1:Many | One tenant has many users |
| Tenants → Projects | 1:Many | One tenant has many projects |
| Tenants → Tasks | 1:Many | One tenant has many tasks (via projects) |
| Users → Projects | 1:Many | One user can create many projects |
| Users → Tasks | 1:Many | One user can be assigned to many tasks |
| Projects → Tasks | 1:Many | One project contains many tasks |

## Key Design Points

- **tenant_id** appears in Users, Projects, and Tasks for data isolation
- **Foreign Keys** ensure referential integrity across tables
- **Soft Deletes** via `deleted_at` maintain audit trail
- **Unique Constraints** on (email, tenant_id) allow same email across tenants
- **Indexes** on tenant_id, email, project_id, and assigned_to for query performance

## Data Flow Example

---

**Last Updated:** September 17, 2026  
**Status:** Phase 2 Complete ✅
