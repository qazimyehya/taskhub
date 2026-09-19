import { Request, Response, NextFunction } from 'express';
import { Role } from '../types';
import { forbidden, unauthorized } from '../errors';

// Role-based access control middleware
const authorize = (...roles: Role[]) => {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(unauthorized('Not authenticated'));
    }

    if (!roles.includes(req.user.role)) {
      return next(forbidden());
    }

    next();
  };
};

export default authorize;
