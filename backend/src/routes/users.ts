import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { withTenant } from '../db';
import authenticate from '../middleware/authenticate';
import authorize from '../middleware/authorize';
import { asyncHandler, badRequest, conflict, notFound, parse } from '../errors';
import { idParams } from '../validators/common';
import { inviteSchema, updateRoleSchema } from '../validators/user.validator';

const router = Router();

router.use(authenticate);

// GET /users — list active users in the tenant
router.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const { tenantId } = req.user!;

    const users = await withTenant(tenantId, async (db) => {
      const result = await db.query(
        `SELECT id, email, first_name, last_name, role, created_at
           FROM users
          WHERE tenant_id = $1 AND deleted_at IS NULL
          ORDER BY created_at ASC`,
        [tenantId]
      );
      return result.rows;
    });

    return res.json({ users });
  })
);

// POST /users/invite — admin adds a member
router.post(
  '/invite',
  authorize('admin'),
  asyncHandler(async (req: Request, res: Response) => {
    const { tenantId } = req.user!;
    const { email, password, firstName, lastName, role } = parse(inviteSchema, req.body);

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await withTenant(tenantId, async (db) => {
      const existing = await db.query(
        'SELECT id, deleted_at FROM users WHERE email = $1 AND tenant_id = $2',
        [email, tenantId]
      );
      const current = existing.rows[0];

      if (current && !current.deleted_at) {
        throw conflict('User with this email already exists in your organization');
      }

      // (email, tenant) is unique even for removed users, so re-inviting someone
      // who was removed re-activates their row instead of failing on the constraint.
      const result = current
        ? await db.query(
            `UPDATE users
                SET password_hash = $1, first_name = $2, last_name = $3, role = $4,
                    deleted_at = NULL, updated_at = CURRENT_TIMESTAMP
              WHERE id = $5 AND tenant_id = $6
              RETURNING id, email, first_name, last_name, role, created_at`,
            [passwordHash, firstName, lastName, role, current.id, tenantId]
          )
        : await db.query(
            `INSERT INTO users (email, password_hash, first_name, last_name, tenant_id, role)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING id, email, first_name, last_name, role, created_at`,
            [email, passwordHash, firstName, lastName, tenantId, role]
          );
      return result.rows[0];
    });

    return res.status(201).json({ message: 'User invited successfully', user });
  })
);

// PATCH /users/:id/role — admin changes a role
router.patch(
  '/:id/role',
  authorize('admin'),
  asyncHandler(async (req: Request, res: Response) => {
    const { tenantId, userId } = req.user!;
    const { id } = parse(idParams, req.params);
    const { role } = parse(updateRoleSchema, req.body);

    // Also guarantees a tenant can never end up without an admin: the acting
    // admin can't demote or remove themselves.
    if (id === userId) throw badRequest("You can't change your own role");

    const user = await withTenant(tenantId, async (db) => {
      const result = await db.query(
        `UPDATE users SET role = $1, updated_at = CURRENT_TIMESTAMP
          WHERE id = $2 AND tenant_id = $3 AND deleted_at IS NULL
          RETURNING id, email, role`,
        [role, id, tenantId]
      );
      return result.rows[0];
    });

    if (!user) throw notFound('User not found');
    return res.json({ message: 'Role updated successfully', user });
  })
);

// DELETE /users/:id — admin removes a member (soft delete + session revocation)
router.delete(
  '/:id',
  authorize('admin'),
  asyncHandler(async (req: Request, res: Response) => {
    const { tenantId, userId } = req.user!;
    const { id } = parse(idParams, req.params);

    if (id === userId) throw badRequest("You can't remove yourself");

    await withTenant(tenantId, async (db) => {
      const result = await db.query(
        `UPDATE users SET deleted_at = CURRENT_TIMESTAMP
          WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
        [id, tenantId]
      );
      if (!result.rowCount) throw notFound('User not found');

      // Kill their sessions so they can't refresh back in
      await db.query(
        `UPDATE refresh_tokens SET revoked_at = NOW()
          WHERE user_id = $1 AND tenant_id = $2 AND revoked_at IS NULL`,
        [id, tenantId]
      );
    });

    return res.json({ message: 'User removed successfully' });
  })
);

export default router;
