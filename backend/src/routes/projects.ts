import { Router, Request, Response } from 'express';
import pool from '../db';
import authenticate from '../middleware/authenticate';
import authorize from '../middleware/authorize';
import { createProjectSchema, updateProjectSchema } from '../validators/project.validator';

const router = Router();

router.use(authenticate);

// GET /projects
router.get('/', async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.user!;

    const result = await pool.query(
      `SELECT p.*,
              u.email as created_by_email,
              COUNT(pm.user_id) as member_count
       FROM projects p
       LEFT JOIN users u ON p.created_by = u.id
       LEFT JOIN project_members pm ON p.id = pm.project_id
       WHERE p.tenant_id = $1
       AND p.deleted_at IS NULL
       GROUP BY p.id, u.email
       ORDER BY p.created_at DESC`,
      [tenantId]
    );

    return res.json({ projects: result.rows });

  } catch (error) {
    console.error('Get projects error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /projects/:id
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.user!;
    const { id } = req.params;

    const result = await pool.query(
      `SELECT p.*, u.email as created_by_email
       FROM projects p
       LEFT JOIN users u ON p.created_by = u.id
       WHERE p.id = $1
       AND p.tenant_id = $2
       AND p.deleted_at IS NULL`,
      [id, tenantId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Not found', message: 'Project not found' });
    }

    // Get project members
    const members = await pool.query(
      `SELECT u.id, u.email, u.first_name, u.last_name, u.role
       FROM project_members pm
       JOIN users u ON pm.user_id = u.id
       WHERE pm.project_id = $1
       AND pm.tenant_id = $2`,
      [id, tenantId]
    );

    return res.json({
      project: result.rows[0],
      members: members.rows,
    });

  } catch (error) {
    console.error('Get project error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /projects
router.post('/', async (req: Request, res: Response) => {
  try {
    const { tenantId, userId } = req.user!;

    const result = createProjectSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: result.error.issues
      });
    }

    const { name, description } = result.data;

    const project = await pool.query(
      `INSERT INTO projects (name, description, tenant_id, created_by)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [name, description, tenantId, userId]
    );

    // Auto-add creator as project member
    await pool.query(
      `INSERT INTO project_members (project_id, user_id, tenant_id)
       VALUES ($1, $2, $3)`,
      [project.rows[0].id, userId, tenantId]
    );

    return res.status(201).json({
      message: 'Project created successfully',
      project: project.rows[0]
    });

  } catch (error) {
    console.error('Create project error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /projects/:id
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.user!;
    const { id } = req.params;

    const result = updateProjectSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: result.error.issues
      });
    }

    const existing = await pool.query(
      'SELECT id FROM projects WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL',
      [id, tenantId]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Not found', message: 'Project not found' });
    }

    const { name, description } = result.data;

    const project = await pool.query(
      `UPDATE projects
       SET name = COALESCE($1, name),
           description = COALESCE($2, description),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $3 AND tenant_id = $4
       RETURNING *`,
      [name, description, id, tenantId]
    );

    return res.json({
      message: 'Project updated successfully',
      project: project.rows[0]
    });

  } catch (error) {
    console.error('Update project error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /projects/:id (admin only)
router.delete('/:id', authorize('admin'), async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.user!;
    const { id } = req.params;

    const existing = await pool.query(
      'SELECT id FROM projects WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL',
      [id, tenantId]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Not found', message: 'Project not found' });
    }

    await pool.query(
      'UPDATE projects SET deleted_at = CURRENT_TIMESTAMP WHERE id = $1 AND tenant_id = $2',
      [id, tenantId]
    );

    return res.json({ message: 'Project deleted successfully' });

  } catch (error) {
    console.error('Delete project error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /projects/:id/members — Add member to project (admin only)
router.post('/:id/members', authorize('admin'), async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.user!;
    const { id } = req.params;
    const { userId } = req.body;

    // Check project exists
    const project = await pool.query(
      'SELECT id FROM projects WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL',
      [id, tenantId]
    );

    if (project.rows.length === 0) {
      return res.status(404).json({ error: 'Not found', message: 'Project not found' });
    }

    // Check user belongs to same tenant
    const user = await pool.query(
      'SELECT id FROM users WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL',
      [userId, tenantId]
    );

    if (user.rows.length === 0) {
      return res.status(404).json({ error: 'Not found', message: 'User not found' });
    }

    // Add member
    await pool.query(
      `INSERT INTO project_members (project_id, user_id, tenant_id)
       VALUES ($1, $2, $3)
       ON CONFLICT (project_id, user_id) DO NOTHING`,
      [id, userId, tenantId]
    );

    return res.status(201).json({ message: 'Member added successfully' });

  } catch (error) {
    console.error('Add member error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /projects/:id/members/:userId — Remove member (admin only)
router.delete('/:id/members/:userId', authorize('admin'), async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.user!;
    const { id, userId } = req.params;

    await pool.query(
      'DELETE FROM project_members WHERE project_id = $1 AND user_id = $2 AND tenant_id = $3',
      [id, userId, tenantId]
    );

    return res.json({ message: 'Member removed successfully' });

  } catch (error) {
    console.error('Remove member error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;