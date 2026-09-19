import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import {
  createTenant,
  findTenantIdBySlug,
  setTenant,
  withTenant,
  withTransaction,
} from '../db';
import { asyncHandler, conflict, parse, unauthorized } from '../errors';
import { loginSchema, signupSchema } from '../validators/auth.validator';
import { JwtPayload, Role } from '../types';
import {
  REFRESH_COOKIE,
  clearRefreshCookie,
  createRefreshToken,
  hashToken,
  setRefreshCookie,
  signAccessToken,
  verifyRefreshToken,
} from '../utils/tokens';

const router = Router();

const BCRYPT_ROUNDS = 12;

// If a refresh token was rotated moments ago, a second request carrying the old
// token is almost certainly a parallel tab racing the first one (they share a
// cookie jar). Give those a fresh access token instead of logging the user out.
const REFRESH_GRACE_MS = 10_000;

// Compared against when the account doesn't exist so that "unknown email" and
// "wrong password" take the same time (prevents user enumeration by timing).
const DUMMY_HASH = bcrypt.hashSync('taskhub-timing-equaliser', BCRYPT_ROUNDS);

const publicUser = (user: { id: number; email: string; role: Role }, tenantId: number) => ({
  id: user.id,
  email: user.email,
  role: user.role,
  tenantId,
});

// ─────────────────────────────────────────
// POST /auth/signup
// ─────────────────────────────────────────
router.post(
  '/signup',
  asyncHandler(async (req: Request, res: Response) => {
    const { email, password, firstName, lastName, tenantName, tenantSlug } = parse(
      signupSchema,
      req.body
    );

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    let session;
    try {
      session = await withTransaction(async (db) => {
        // Unique slug is enforced by the DB (no check-then-insert race).
        const tenantId = await createTenant(db, tenantName, tenantSlug);
        await setTenant(db, tenantId);

        // First user of a tenant is its admin
        const userResult = await db.query(
          `INSERT INTO users (email, password_hash, first_name, last_name, tenant_id, role)
           VALUES ($1, $2, $3, $4, $5, 'admin')
           RETURNING id, email, role`,
          [email, passwordHash, firstName, lastName, tenantId]
        );
        const user = userResult.rows[0];

        const payload: JwtPayload = { userId: user.id, tenantId, role: user.role };
        return { user, tenantId, payload, refreshToken: await createRefreshToken(db, payload) };
      });
    } catch (err: any) {
      if (err?.code === '23505') {
        throw conflict('Organization slug already exists');
      }
      throw err;
    }

    setRefreshCookie(res, session.refreshToken);

    return res.status(201).json({
      message: 'Account created successfully',
      accessToken: signAccessToken(session.payload),
      user: publicUser(session.user, session.tenantId),
    });
  })
);

// ─────────────────────────────────────────
// POST /auth/login
// ─────────────────────────────────────────
router.post(
  '/login',
  asyncHandler(async (req: Request, res: Response) => {
    const { email, password, tenantSlug } = parse(loginSchema, req.body);

    const tenantId = await findTenantIdBySlug(tenantSlug);

    const user = tenantId
      ? await withTenant(tenantId, async (db) => {
          const result = await db.query(
            `SELECT id, email, password_hash, role
               FROM users
              WHERE email = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
            [email, tenantId]
          );
          return result.rows[0];
        })
      : undefined;

    const passwordMatch = await bcrypt.compare(password, user?.password_hash ?? DUMMY_HASH);
    if (!user || !passwordMatch) {
      throw unauthorized('Invalid credentials');
    }

    const payload: JwtPayload = { userId: user.id, tenantId: tenantId!, role: user.role };
    const refreshToken = await withTenant(tenantId!, (db) => createRefreshToken(db, payload));

    setRefreshCookie(res, refreshToken);

    return res.json({
      message: 'Login successful',
      accessToken: signAccessToken(payload),
      user: publicUser(user, tenantId!),
    });
  })
);

// ─────────────────────────────────────────
// POST /auth/refresh
// Rotates the refresh token. The user is re-read from the DB so removed users
// can't refresh and role changes take effect.
// ─────────────────────────────────────────
router.post(
  '/refresh',
  asyncHandler(async (req: Request, res: Response) => {
    const rawToken = req.cookies?.[REFRESH_COOKIE];
    if (!rawToken) {
      throw unauthorized('No refresh token provided');
    }

    let claims: JwtPayload;
    try {
      claims = verifyRefreshToken(rawToken);
    } catch {
      clearRefreshCookie(res);
      throw unauthorized('Invalid or expired refresh token');
    }

    const outcome = await withTenant(claims.tenantId, async (db) => {
      const tokenResult = await db.query(
        `SELECT id, user_id, revoked_at,
                (expires_at < NOW()) AS expired,
                (rotated_at IS NOT NULL AND rotated_at > NOW() - make_interval(secs => $2)) AS in_grace
           FROM refresh_tokens
          WHERE token_hash = $1 AND tenant_id = $3
            FOR UPDATE`,
        [hashToken(rawToken), REFRESH_GRACE_MS / 1000, claims.tenantId]
      );
      const stored = tokenResult.rows[0];

      // expiry is compared in SQL: the column is timestamp-without-tz, so Node's clock/TZ must not be involved
      if (!stored || stored.expired) {
        return null;
      }
      if (stored.revoked_at && !stored.in_grace) {
        return null;
      }

      const userResult = await db.query(
        `SELECT u.id, u.email, u.role
           FROM users u
           JOIN tenants t ON t.id = u.tenant_id
          WHERE u.id = $1 AND u.tenant_id = $2
            AND u.deleted_at IS NULL AND t.deleted_at IS NULL`,
        [stored.user_id, claims.tenantId]
      );
      const user = userResult.rows[0];
      if (!user) {
        return null;
      }

      const payload: JwtPayload = {
        userId: user.id,
        tenantId: claims.tenantId,
        role: user.role, // fresh from the DB, not from the old token
      };

      if (stored.revoked_at) {
        // Racing tab: the winner already rotated the cookie, don't rotate again.
        return { payload, user, refreshToken: null };
      }

      await db.query('UPDATE refresh_tokens SET revoked_at = NOW(), rotated_at = NOW() WHERE id = $1', [stored.id]);
      return { payload, user, refreshToken: await createRefreshToken(db, payload) };
    });

    if (!outcome) {
      clearRefreshCookie(res);
      throw unauthorized('Invalid or expired refresh token');
    }

    if (outcome.refreshToken) {
      setRefreshCookie(res, outcome.refreshToken);
    }

    return res.json({
      accessToken: signAccessToken(outcome.payload),
      user: publicUser(outcome.user, outcome.payload.tenantId),
    });
  })
);

// ─────────────────────────────────────────
// POST /auth/logout
// Revokes the refresh token server-side (not just the cookie).
// ─────────────────────────────────────────
router.post(
  '/logout',
  asyncHandler(async (req: Request, res: Response) => {
    const rawToken = req.cookies?.[REFRESH_COOKIE];

    if (rawToken) {
      try {
        const claims = verifyRefreshToken(rawToken);
        await withTenant(claims.tenantId, (db) =>
          db.query(
            `UPDATE refresh_tokens SET revoked_at = NOW()
              WHERE token_hash = $1 AND tenant_id = $2 AND revoked_at IS NULL`,
            [hashToken(rawToken), claims.tenantId]
          )
        );
      } catch {
        // Expired/invalid token: nothing to revoke, still clear the cookie.
      }
    }

    clearRefreshCookie(res);
    return res.json({ message: 'Logged out successfully' });
  })
);

export default router;
