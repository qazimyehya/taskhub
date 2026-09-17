import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import pool from '../db';
import { signupSchema, loginSchema } from '../validators/auth.validator';
import { JwtPayload } from '../types';

const router = Router();

// ─────────────────────────────────────────
// POST /auth/signup
// ─────────────────────────────────────────
router.post('/signup', async (req: Request, res: Response) => {
  try {
    // 1. Validate input
    const result = signupSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ 
        error: 'Validation failed',
        details: result.error.issues
      });
    }

    const { email, password, firstName, lastName, tenantName, tenantSlug } = result.data;

    // 2. Check if tenant slug already exists
    const existingTenant = await pool.query(
      'SELECT id FROM tenants WHERE slug = $1',
      [tenantSlug]
    );

    if (existingTenant.rows.length > 0) {
      return res.status(409).json({ 
        error: 'Conflict',
        message: 'Organization slug already exists' 
      });
    }

    // 3. Hash password
    const passwordHash = await bcrypt.hash(password, 12);

    // 4. Create tenant and user in a transaction
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Create tenant
      const tenantResult = await client.query(
        `INSERT INTO tenants (name, slug, plan) 
         VALUES ($1, $2, $3) 
         RETURNING id`,
        [tenantName, tenantSlug, 'free']
      );

      const tenantId = tenantResult.rows[0].id;

      // Create user (first user is admin)
      const userResult = await client.query(
        `INSERT INTO users 
         (email, password_hash, first_name, last_name, tenant_id, role)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, email, role`,
        [email, passwordHash, firstName, lastName, tenantId, 'admin']
      );

      const user = userResult.rows[0];

      await client.query('COMMIT');

      // 5. Create JWT access token
      const payload: JwtPayload = {
        userId: user.id,
        tenantId,
        role: user.role,
      };

      const accessToken = jwt.sign(
        payload,
        process.env.JWT_SECRET as string,
        { expiresIn: '15m' }
      );

      // 6. Create refresh token
      const refreshToken = jwt.sign(
        payload,
        process.env.REFRESH_TOKEN_SECRET as string,
        { expiresIn: '7d' }
      );

      // 7. Store refresh token in httpOnly cookie
      res.cookie('refreshToken', refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      });

      // 8. Return access token
      return res.status(201).json({
        message: 'Account created successfully',
        accessToken,
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          tenantId,
        },
      });

    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

  } catch (error) {
    console.error('Signup error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: process.env.NODE_ENV === 'production' 
        ? 'Something went wrong' 
        : (error as Error).message
    });
  }
});

// ─────────────────────────────────────────
// POST /auth/login
// ─────────────────────────────────────────
router.post('/login', async (req: Request, res: Response) => {
  try {
    // 1. Validate input
    const result = loginSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ 
        error: 'Validation failed',
        details: result.error.issues 
      });
    }

    const { email, password, tenantSlug } = result.data;

    // 2. Find tenant
    const tenantResult = await pool.query(
      'SELECT id FROM tenants WHERE slug = $1 AND deleted_at IS NULL',
      [tenantSlug]
    );

    if (tenantResult.rows.length === 0) {
      return res.status(401).json({ 
        error: 'Unauthorized',
        message: 'Invalid credentials' 
      });
    }

    const tenantId = tenantResult.rows[0].id;

    // 3. Find user in that tenant
    const userResult = await pool.query(
      `SELECT id, email, password_hash, role 
       FROM users 
       WHERE email = $1 
       AND tenant_id = $2 
       AND deleted_at IS NULL`,
      [email, tenantId]
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({ 
        error: 'Unauthorized',
        message: 'Invalid credentials' 
      });
    }

    const user = userResult.rows[0];

    // 4. Verify password
    const passwordMatch = await bcrypt.compare(password, user.password_hash);

    if (!passwordMatch) {
      return res.status(401).json({ 
        error: 'Unauthorized',
        message: 'Invalid credentials' 
      });
    }

    // 5. Create JWT payload
    const payload: JwtPayload = {
      userId: user.id,
      tenantId,
      role: user.role,
    };

    // 6. Create access token
    const accessToken = jwt.sign(
      payload,
      process.env.JWT_SECRET as string,
      { expiresIn: '15m' }
    );

    // 7. Create refresh token
    const refreshToken = jwt.sign(
      payload,
      process.env.REFRESH_TOKEN_SECRET as string,
      { expiresIn: '7d' }
    );

    // 8. Store refresh token in httpOnly cookie
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    // 9. Return access token
    return res.json({
      message: 'Login successful',
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        tenantId,
      },
    });

  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: process.env.NODE_ENV === 'production' 
        ? 'Something went wrong' 
        : (error as Error).message
    });
  }
});

// ─────────────────────────────────────────
// POST /auth/refresh
// ─────────────────────────────────────────
router.post('/refresh', async (req: Request, res: Response) => {
  try {
    // 1. Get refresh token from cookie
    const refreshToken = req.cookies?.refreshToken;

    if (!refreshToken) {
      return res.status(401).json({ 
        error: 'Unauthorized',
        message: 'No refresh token provided' 
      });
    }

    // 2. Verify refresh token
    const decoded = jwt.verify(
      refreshToken,
      process.env.REFRESH_TOKEN_SECRET as string
    ) as JwtPayload;

    // 3. Create new access token
    const payload: JwtPayload = {
      userId: decoded.userId,
      tenantId: decoded.tenantId,
      role: decoded.role,
    };

    const accessToken = jwt.sign(
      payload,
      process.env.JWT_SECRET as string,
      { expiresIn: '15m' }
    );

    return res.json({ accessToken });

  } catch (error) {
    return res.status(401).json({ 
      error: 'Unauthorized',
      message: 'Invalid or expired refresh token' 
    });
  }
});

// ─────────────────────────────────────────
// POST /auth/logout
// ─────────────────────────────────────────
router.post('/logout', (req: Request, res: Response) => {
  // Clear refresh token cookie
  res.clearCookie('refreshToken', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
  });

  return res.json({ message: 'Logged out successfully' });
});

export default router;