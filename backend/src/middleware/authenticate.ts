import { Request, Response, NextFunction } from 'express';
import { unauthorized } from '../errors';
import { verifyAccessToken } from '../utils/tokens';

// Verifies the access token and exposes the claims as req.user.
// Tenant scoping is applied per query via withTenant(req.user.tenantId, ...).
const authenticate = (req: Request, _res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(unauthorized('No token provided'));
  }

  try {
    req.user = verifyAccessToken(authHeader.split(' ')[1]);
  } catch {
    return next(unauthorized('Invalid or expired token'));
  }

  next();
};

export default authenticate;
