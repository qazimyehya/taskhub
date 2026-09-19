import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { Response } from 'express';
import { config } from '../config';
import { Db } from '../db';
import { JwtPayload, Role } from '../types';

const ALGORITHM = 'HS256';

export const REFRESH_COOKIE = 'refreshToken';

const cookieOptions = {
  httpOnly: true,
  secure: config.cookieSecure,
  sameSite: 'strict' as const,
};

export const hashToken = (token: string): string =>
  crypto.createHash('sha256').update(token).digest('hex');

const claims = (user: { userId: number; tenantId: number; role: Role }): JwtPayload => ({
  userId: user.userId,
  tenantId: user.tenantId,
  role: user.role,
});

export const signAccessToken = (user: JwtPayload): string =>
  jwt.sign(claims(user), config.jwtSecret, {
    algorithm: ALGORITHM,
    expiresIn: config.accessTokenTtl as jwt.SignOptions['expiresIn'],
  });

export const verifyAccessToken = (token: string): JwtPayload =>
  jwt.verify(token, config.jwtSecret, { algorithms: [ALGORITHM] }) as JwtPayload;

export const verifyRefreshToken = (token: string): JwtPayload =>
  jwt.verify(token, config.refreshTokenSecret, { algorithms: [ALGORITHM] }) as JwtPayload;

// Creates a refresh token, stores its hash server-side (so it can be rotated
// and revoked) and returns the raw token for the cookie.
export async function createRefreshToken(db: Db, user: JwtPayload): Promise<string> {
  const token = jwt.sign(
    { ...claims(user), jti: crypto.randomUUID() },
    config.refreshTokenSecret,
    { algorithm: ALGORITHM, expiresIn: config.refreshTokenTtlSeconds }
  );

  await db.query(
    `INSERT INTO refresh_tokens (token_hash, user_id, tenant_id, expires_at)
     VALUES ($1, $2, $3, NOW() + make_interval(secs => $4))`,
    [hashToken(token), user.userId, user.tenantId, config.refreshTokenTtlSeconds]
  );

  return token;
}

export const setRefreshCookie = (res: Response, token: string): void => {
  res.cookie(REFRESH_COOKIE, token, {
    ...cookieOptions,
    maxAge: config.refreshTokenTtlSeconds * 1000,
  });
};

export const clearRefreshCookie = (res: Response): void => {
  res.clearCookie(REFRESH_COOKIE, cookieOptions);
};
