import { Router, Request, Response } from 'express';
import { withTenant } from '../db';
import authenticate from '../middleware/authenticate';
import authorize from '../middleware/authorize';
import { asyncHandler, forbidden, notFound, parse } from '../errors';
import { idParams, idSchema } from '../validators/common';
import {
  addMemberSchema,
  createProjectSchema,
  updateProjectSchema,
} from '../validators/project.validator';

const router = Router();

router.use(authenticate);

// GET /projects
router.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const { tenantId } = req.user!;

    const projects = await withTenant(tenantId, async (db) => {
      const result = await db.query(
        `SELECT p.*,
                u.email AS created_by_email,
                COUNT(mu.id)::int AS member_count
           FROM projects p
           LEFT JOIN users u ON p.created_by = u.id
           LEFT JOIN project_members pm ON p.id = pm.project_id
           LEFT JOIN users mu ON pm.user_id = mu.id AND mu.deleted_at IS NULL
          WHERE p.tenant_id = $1
            AND p.deleted_at IS NULL
          GROUP BY p.id, u.email
          ORDER BY p.created_at DESC`,
        [tenantId]
      );
      return result.rows;
    });

    return res.json({ projects });
  })
);

// GET /projects/:id
router.get(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const { tenantId } = req.user!;
    const { id } = parse(idParams, req.params);

    const found = await withTenant(tenantId, async (db) => {
      const project = await db.query(
        `SELECT p.*, u.email AS created_by_email
           FROM projects p
           LEFT JOIN users u ON p.created_by = u.id
          WHERE p.id = $1 AND p.tenant_id = $2 AND p.deleted_at IS NULL`,
        [id, tenantId]
      );
      if (project.rows.length === 0) return null;

      const members = await db.query(
        `SELECT u.id, u.email, u.first_name, u.last_name, u.role
           FROM project_members pm
           JOIN users u ON pm.user_id = u.id
          WHERE pm.project_id = $1 AND pm.tenant_id = $2 AND u.deleted_at IS NULL`,
        [id, tenantId]
      );
      return { project: project.rows[0], members: members.rows };
    });

    if (!found) throw notFound('Project not found');
    return res.json(found);
  })
);

// POST /projects
router.post(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const { tenantId, userId } = req.user!;
    const { name, description } = parse(createProjectSchema, req.body);

    // Project + creator membership succeed or fail together.
    const project = await withTenant(tenantId, async (db) => {
      const created = await db.query(
        `INSERT INTO projects (name, description, tenant_id, created_by)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [name, description, tenantId, userId]
      );
      await db.query(
        `INSERT INTO project_members (project_id, user_id, tenant_id)
         VALUES ($1, $2, $3)`,
        [created.rows[0].id, userId, tenantId]
      );
      return created.rows[0];
    });

    return res.status(201).json({ message: 'Project created successfully', project });
  })
);

// PATCH /projects/:id — admins, the creator, or project members
router.patch(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const { tenantId, userId, role } = req.user!;
    const { id } = parse(idParams, req.params);
    const changes = parse(updateProjectSchema, req.body);

    const project = await withTenant(tenantId, async (db) => {
      const existing = await db.query(
        `SELECT p.id, p.created_by,
                EXISTS (SELECT 1 FROM project_members pm
                         WHERE pm.project_id = p.id AND pm.user_id = $3) AS is_member
           FROM projects p
          WHERE p.id = $1 AND p.tenant_id = $2 AND p.deleted_at IS NULL`,
        [id, tenantId, userId]
      );
      const current = existing.rows[0];
      if (!current) throw notFound('Project not found');

      if (role !== 'admin' && current.created_by !== userId && !current.is_member) {
        throw forbidden('Only project members can edit this project');
      }

      // description: null clears it, undefined leaves it alone
      const updated = await db.query(
        `UPDATE projects
            SET name = COALESCE($1, name),
                description = CASE WHEN $2::boolean THEN $3 ELSE description END,
                updated_at = CURRENT_TIMESTAMP
          WHERE id = $4 AND tenant_id = $5
          RETURNING *`,
        [
          changes.name ?? null,
          changes.description !== undefined,
          changes.description ?? null,
          id,
          tenantId,
        ]
      );
      return updated.rows[0];
    });

    return res.json({ message: 'Project updated successfully', project });
  })
);

// DELETE /projects/:id (admin only, soft delete)
router.delete(
  '/:id',
  authorize('admin'),
  asyncHandler(async (req: Request, res: Response) => {
    const { tenantId } = req.user!;
    const { id } = parse(idParams, req.params);

    const deleted = await withTenant(tenantId, async (db) => {
      const result = await db.query(
        `UPDATE projects SET deleted_at = CURRENT_TIMESTAMP
          WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
        [id, tenantId]
      );
      return result.rowCount;
    });

    if (!deleted) throw notFound('Project not found');
    return res.json({ message: 'Project deleted successfully' });
  })
);

// POST /projects/:id/members (admin only)
router.post(
  '/:id/members',
  authorize('admin'),
  asyncHandler(async (req: Request, res: Response) => {
    const { tenantId } = req.user!;
    const { id } = parse(idParams, req.params);
    const { userId } = parse(addMemberSchema, req.body);

    await withTenant(tenantId, async (db) => {
      const project = await db.query(
        'SELECT id FROM projects WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL',
        [id, tenantId]
      );
      if (project.rows.length === 0) throw notFound('Project not found');

      const user = await db.query(
        'SELECT id FROM users WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL',
        [userId, tenantId]
      );
      if (user.rows.length === 0) throw notFound('User not found');

      await db.query(
        `INSERT INTO project_members (project_id, user_id, tenant_id)
         VALUES ($1, $2, $3)
         ON CONFLICT (project_id, user_id) DO NOTHING`,
        [id, userId, tenantId]
      );
    });

    return res.status(201).json({ message: 'Member added successfully' });
  })
);

// DELETE /projects/:id/members/:userId (admin only)
router.delete(
  '/:id/members/:userId',
  authorize('admin'),
  asyncHandler(async (req: Request, res: Response) => {
    const { tenantId } = req.user!;
    const { id, userId } = parse(idParams.extend({ userId: idSchema }), req.params);

    const removed = await withTenant(tenantId, async (db) => {
      const result = await db.query(
        'DELETE FROM project_members WHERE project_id = $1 AND user_id = $2 AND tenant_id = $3',
        [id, userId, tenantId]
      );
      return result.rowCount;
    });

    if (!removed) throw notFound('Membership not found');
    return res.json({ message: 'Member removed successfully' });
  })
);

export default router;
