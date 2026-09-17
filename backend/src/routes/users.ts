import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import pool from '../db';
import authenticate from '../middleware/authenticate';
import authorize from '../middleware/authorize';
import { z } from 'zod';

const router = Router();

router.use(authenticate);

// ─────────────────────────────────────────
// GET /users — List all users in tenant
// ─────────────────────────────────────────
router.get('/', async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.user!;

    const result = await pool.query(
      `SELECT id, email, first_name, last_name, role, created_at
       FROM users
       WHERE tenant_id = $1
       AND deleted_at IS NULL
       ORDER BY created_at ASC`,
      [tenantId]
    );

    return res.json({ users: result.rows });

  } catch (error) {
    console.error('Get users error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ─────────────────────────────────────────
// POST /users/invite — Admin invites member
// ─────────────────────────────────────────
const inviteSchema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  role: z.enum(['admin', 'member']).default('member'),
});

router.post('/invite', authorize('admin'), async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.user!;

    // Validate input
    const result = inviteSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: result.error.issues
      });
    }

    const { email, password, firstName, lastName, role } = result.data;

    // Check if user already exists in this tenant
    const existing = await pool.query(
      'SELECT id FROM users WHERE email = $1 AND tenant_id = $2 AND deleted_at IS NULL',
      [email, tenantId]
    );

    if (existing.rows.length > 0) {
      return res.status(409).json({
        error: 'Conflict',
        message: 'User with this email already exists in your organization'
      });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);

    // Create user in same tenant
    const userResult = await pool.query(
      `INSERT INTO users (email, password_hash, first_name, last_name, tenant_id, role)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, email, first_name, last_name, role, created_at`,
      [email, passwordHash, firstName, lastName, tenantId, role]
    );

    return res.status(201).json({
      message: 'User invited successfully',
      user: userResult.rows[0]
    });

  } catch (error) {
    console.error('Invite user error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ─────────────────────────────────────────
// PATCH /users/:id/role — Admin changes role
// ─────────────────────────────────────────
router.patch('/:id/role', authorize('admin'), async (req: Request, res: Response) => {
  try {
    const { tenantId, userId } = req.user!;
    const { id } = req.params;
    const { role } = req.body;

    // Can't change your own role
    if (parseInt(id) === userId) {
      return res.status(400).json({
        error: 'Bad request',
        message: "You can't change your own role"
      });
    }

    // Validate role
    if (!['admin', 'member'].includes(role)) {
      return res.status(400).json({
        error: 'Validation failed',
        message: 'Role must be admin or member'
      });
    }

    // Check user belongs to same tenant
    const existing = await pool.query(
      'SELECT id FROM users WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL',
      [id, tenantId]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({
        error: 'Not found',
        message: 'User not found'
      });
    }

    // Update role
    const updated = await pool.query(
      `UPDATE users SET role = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2 AND tenant_id = $3
       RETURNING id, email, role`,
      [role, id, tenantId]
    );

    return res.json({
      message: 'Role updated successfully',
      user: updated.rows[0]
    });

  } catch (error) {
    console.error('Update role error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ─────────────────────────────────────────
// DELETE /users/:id — Admin removes member
// ─────────────────────────────────────────
router.delete('/:id', authorize('admin'), async (req: Request, res: Response) => {
  try {
    const { tenantId, userId } = req.user!;
    const { id } = req.params;

    // Can't delete yourself
    if (parseInt(id) === userId) {
      return res.status(400).json({
        error: 'Bad request',
        message: "You can't remove yourself"
      });
    }

    // Check user belongs to same tenant
    const existing = await pool.query(
      'SELECT id FROM users WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL',
      [id, tenantId]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({
        error: 'Not found',
        message: 'User not found'
      });
    }

    // Soft delete
    await pool.query(
      'UPDATE users SET deleted_at = CURRENT_TIMESTAMP WHERE id = $1 AND tenant_id = $2',
      [id, tenantId]
    );

    return res.json({ message: 'User removed successfully' });

  } catch (error) {
    console.error('Delete user error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;