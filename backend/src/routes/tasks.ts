import { Router, Request, Response } from 'express';
import pool from '../db';
import authenticate from '../middleware/authenticate';
import { createTaskSchema, updateTaskSchema } from '../validators/task.validator';

const router = Router();

router.use(authenticate);

// ─────────────────────────────────────────
// GET /tasks
// Supports: filtering, pagination, search
// ─────────────────────────────────────────
router.get('/', async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.user!;

    const { status, assignee, projectId, search, page = '1', limit = '10' } = req.query;

    const conditions: string[] = ['t.tenant_id = $1', 't.deleted_at IS NULL'];
    const values: any[] = [tenantId];
    let paramCount = 1;

    if (status) {
      paramCount++;
      conditions.push(`t.status = $${paramCount}`);
      values.push(status);
    }

    if (assignee) {
      paramCount++;
      conditions.push(`t.assigned_to = $${paramCount}`);
      values.push(assignee);
    }

    if (projectId) {
      paramCount++;
      conditions.push(`t.project_id = $${paramCount}`);
      values.push(projectId);
    }

    if (search) {
      paramCount++;
      conditions.push(`(t.title ILIKE $${paramCount} OR t.description ILIKE $${paramCount})`);
      values.push(`%${search}%`);
    }

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const offset = (pageNum - 1) * limitNum;

    const whereClause = conditions.join(' AND ');

    // Get total count
    const countResult = await pool.query(
      `SELECT COUNT(*) FROM tasks t WHERE ${whereClause}`,
      values
    );

    const total = parseInt(countResult.rows[0].count);

    paramCount++;
    values.push(limitNum);
    paramCount++;
    values.push(offset);

    // Get tasks with all related info
    const result = await pool.query(
      `SELECT t.*,
              p.name as project_name,
              ten.slug as tenant_slug,
              u.email as assigned_to_email,
              cb.email as created_by_email
       FROM tasks t
       LEFT JOIN projects p ON t.project_id = p.id
       LEFT JOIN tenants ten ON t.tenant_id = ten.id
       LEFT JOIN users u ON t.assigned_to = u.id
       LEFT JOIN users cb ON t.created_by = cb.id
       WHERE ${whereClause}
       ORDER BY t.created_at DESC
       LIMIT $${paramCount - 1} OFFSET $${paramCount}`,
      values
    );

    return res.json({
      tasks: result.rows,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    });

  } catch (error) {
    console.error('Get tasks error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ─────────────────────────────────────────
// GET /tasks/:id
// ─────────────────────────────────────────
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.user!;
    const { id } = req.params;

    const result = await pool.query(
      `SELECT t.*,
              p.name as project_name,
              ten.slug as tenant_slug,
              u.email as assigned_to_email,
              cb.email as created_by_email
       FROM tasks t
       LEFT JOIN projects p ON t.project_id = p.id
       LEFT JOIN tenants ten ON t.tenant_id = ten.id
       LEFT JOIN users u ON t.assigned_to = u.id
       LEFT JOIN users cb ON t.created_by = cb.id
       WHERE t.id = $1
       AND t.tenant_id = $2
       AND t.deleted_at IS NULL`,
      [id, tenantId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Task not found'
      });
    }

    return res.json({ task: result.rows[0] });

  } catch (error) {
    console.error('Get task error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ─────────────────────────────────────────
// POST /tasks
// ─────────────────────────────────────────
router.post('/', async (req: Request, res: Response) => {
  try {
    const { tenantId, userId } = req.user!;

    const result = createTaskSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: result.error.issues
      });
    }

    const { title, description, status, priority, projectId, assignedTo, dueDate } = result.data;

    // Verify project belongs to tenant
    const project = await pool.query(
      'SELECT id FROM projects WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL',
      [projectId, tenantId]
    );

    if (project.rows.length === 0) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Project not found'
      });
    }

    const task = await pool.query(
      `INSERT INTO tasks
       (title, description, status, priority, project_id, tenant_id, assigned_to, due_date, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [title, description, status, priority, projectId, tenantId, assignedTo, dueDate, userId]
    );

    return res.status(201).json({
      message: 'Task created successfully',
      task: task.rows[0]
    });

  } catch (error) {
    console.error('Create task error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ─────────────────────────────────────────
// PATCH /tasks/:id
// ─────────────────────────────────────────
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.user!;
    const { id } = req.params;

    const result = updateTaskSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: result.error.issues
      });
    }

    // Check task exists and belongs to tenant
    const existing = await pool.query(
      'SELECT id FROM tasks WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL',
      [id, tenantId]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Task not found'
      });
    }

    const { title, description, status, priority, assignedTo, dueDate } = result.data;

    const task = await pool.query(
      `UPDATE tasks
       SET title = COALESCE($1, title),
           description = COALESCE($2, description),
           status = COALESCE($3, status),
           priority = COALESCE($4, priority),
           assigned_to = COALESCE($5, assigned_to),
           due_date = COALESCE($6, due_date),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $7 AND tenant_id = $8
       RETURNING *`,
      [title, description, status, priority, assignedTo, dueDate, id, tenantId]
    );

    return res.json({
      message: 'Task updated successfully',
      task: task.rows[0]
    });

  } catch (error) {
    console.error('Update task error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ─────────────────────────────────────────
// DELETE /tasks/:id
// ─────────────────────────────────────────
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.user!;
    const { id } = req.params;

    const existing = await pool.query(
      'SELECT id FROM tasks WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL',
      [id, tenantId]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Task not found'
      });
    }

    // Soft delete
    await pool.query(
      'UPDATE tasks SET deleted_at = CURRENT_TIMESTAMP WHERE id = $1 AND tenant_id = $2',
      [id, tenantId]
    );

    return res.json({ message: 'Task deleted successfully' });

  } catch (error) {
    console.error('Delete task error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;