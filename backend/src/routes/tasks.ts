import { Router, Request, Response } from 'express';
import { Db, withTenant } from '../db';
import authenticate from '../middleware/authenticate';
import { asyncHandler, badRequest, forbidden, notFound, parse } from '../errors';
import { idParams } from '../validators/common';
import {
  createTaskSchema,
  listTasksQuerySchema,
  updateTaskSchema,
} from '../validators/task.validator';

const router = Router();

router.use(authenticate);

// The DB foreign keys are tenant-scoped, so a foreign assignee is rejected
// there too; checking up front gives a clean 400 instead of a constraint error.
async function assertAssigneeInTenant(db: Db, assigneeId: number, tenantId: number) {
  const result = await db.query(
    'SELECT 1 FROM users WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL',
    [assigneeId, tenantId]
  );
  if (result.rows.length === 0) {
    throw badRequest('Assignee not found in your organization');
  }
}

// Shared SELECT for list + single. Joins are all tenant-constrained and tasks of
// deleted projects are hidden.
const TASK_SELECT = `
  SELECT t.*,
         p.name  AS project_name,
         ten.slug AS tenant_slug,
         u.email  AS assigned_to_email,
         cb.email AS created_by_email
    FROM tasks t
    JOIN projects p    ON t.project_id = p.id AND p.tenant_id = t.tenant_id AND p.deleted_at IS NULL
    LEFT JOIN tenants ten ON t.tenant_id = ten.id
    LEFT JOIN users u   ON t.assigned_to = u.id AND u.tenant_id = t.tenant_id
    LEFT JOIN users cb  ON t.created_by = cb.id AND cb.tenant_id = t.tenant_id`;

// ─────────────────────────────────────────
// GET /tasks — filter, search, paginate
// ─────────────────────────────────────────
router.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const { tenantId } = req.user!;
    const { status, assignee, projectId, search, page, limit } = parse(
      listTasksQuerySchema,
      req.query
    );

    const conditions: string[] = ['t.tenant_id = $1', 't.deleted_at IS NULL'];
    const values: unknown[] = [tenantId];
    const add = (sql: (n: number) => string, value: unknown) => {
      values.push(value);
      conditions.push(sql(values.length));
    };

    if (status) add((n) => `t.status = $${n}`, status);
    if (assignee) add((n) => `t.assigned_to = $${n}`, assignee);
    if (projectId) add((n) => `t.project_id = $${n}`, projectId);
    if (search) {
      // Escape LIKE wildcards so "50%" searches for the literal text
      const pattern = `%${search.replace(/[\\%_]/g, '\\$&')}%`;
      add((n) => `(t.title ILIKE $${n} OR t.description ILIKE $${n})`, pattern);
    }

    const whereClause = conditions.join(' AND ');
    const offset = (page - 1) * limit;

    const { total, tasks } = await withTenant(tenantId, async (db) => {
      const countResult = await db.query(
        `SELECT COUNT(*)::int AS count
           FROM tasks t
           JOIN projects p ON t.project_id = p.id AND p.tenant_id = t.tenant_id AND p.deleted_at IS NULL
          WHERE ${whereClause}`,
        values
      );

      const result = await db.query(
        `${TASK_SELECT}
          WHERE ${whereClause}
          ORDER BY t.created_at DESC, t.id DESC
          LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
        [...values, limit, offset]
      );

      return { total: countResult.rows[0].count as number, tasks: result.rows };
    });

    return res.json({
      tasks,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  })
);

// ─────────────────────────────────────────
// GET /tasks/:id
// ─────────────────────────────────────────
router.get(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const { tenantId } = req.user!;
    const { id } = parse(idParams, req.params);

    const task = await withTenant(tenantId, async (db) => {
      const result = await db.query(
        `${TASK_SELECT} WHERE t.id = $1 AND t.tenant_id = $2 AND t.deleted_at IS NULL`,
        [id, tenantId]
      );
      return result.rows[0];
    });

    if (!task) throw notFound('Task not found');
    return res.json({ task });
  })
);

// ─────────────────────────────────────────
// POST /tasks
// ─────────────────────────────────────────
router.post(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const { tenantId, userId } = req.user!;
    const { title, description, status, priority, projectId, assignedTo, dueDate } = parse(
      createTaskSchema,
      req.body
    );

    const task = await withTenant(tenantId, async (db) => {
      const project = await db.query(
        'SELECT id FROM projects WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL',
        [projectId, tenantId]
      );
      if (project.rows.length === 0) throw notFound('Project not found');

      if (assignedTo) await assertAssigneeInTenant(db, assignedTo, tenantId);

      const created = await db.query(
        `INSERT INTO tasks
           (title, description, status, priority, project_id, tenant_id, assigned_to, due_date, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING *`,
        [
          title,
          description ?? null,
          status,
          priority ?? null,
          projectId,
          tenantId,
          assignedTo ?? null,
          dueDate ?? null,
          userId,
        ]
      );
      return created.rows[0];
    });

    return res.status(201).json({ message: 'Task created successfully', task });
  })
);

// ─────────────────────────────────────────
// PATCH /tasks/:id
// Partial update: absent key = unchanged, null = clear the field.
// ─────────────────────────────────────────
const UPDATABLE_COLUMNS = {
  title: 'title',
  description: 'description',
  status: 'status',
  priority: 'priority',
  assignedTo: 'assigned_to',
  dueDate: 'due_date',
} as const;

router.patch(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const { tenantId } = req.user!;
    const { id } = parse(idParams, req.params);
    const changes = parse(updateTaskSchema, req.body);

    const sets: string[] = [];
    const values: unknown[] = [];
    for (const [key, column] of Object.entries(UPDATABLE_COLUMNS)) {
      const value = changes[key as keyof typeof changes];
      if (value !== undefined) {
        values.push(value);
        sets.push(`${column} = $${values.length}`);
      }
    }
    if (sets.length === 0) throw badRequest('No fields to update');

    const task = await withTenant(tenantId, async (db) => {
      if (changes.assignedTo) await assertAssigneeInTenant(db, changes.assignedTo, tenantId);

      values.push(id, tenantId);
      const updated = await db.query(
        `UPDATE tasks
            SET ${sets.join(', ')}, updated_at = CURRENT_TIMESTAMP
          WHERE id = $${values.length - 1} AND tenant_id = $${values.length} AND deleted_at IS NULL
          RETURNING *`,
        values
      );
      return updated.rows[0];
    });

    if (!task) throw notFound('Task not found');
    return res.json({ message: 'Task updated successfully', task });
  })
);

// ─────────────────────────────────────────
// DELETE /tasks/:id — soft delete (admin, creator or assignee)
// ─────────────────────────────────────────
router.delete(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const { tenantId, userId, role } = req.user!;
    const { id } = parse(idParams, req.params);

    await withTenant(tenantId, async (db) => {
      const existing = await db.query(
        'SELECT created_by, assigned_to FROM tasks WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL',
        [id, tenantId]
      );
      const task = existing.rows[0];
      if (!task) throw notFound('Task not found');

      if (role !== 'admin' && task.created_by !== userId && task.assigned_to !== userId) {
        throw forbidden('Only admins, the creator or the assignee can delete this task');
      }

      await db.query(
        'UPDATE tasks SET deleted_at = CURRENT_TIMESTAMP WHERE id = $1 AND tenant_id = $2',
        [id, tenantId]
      );
    });

    return res.json({ message: 'Task deleted successfully' });
  })
);

export default router;
