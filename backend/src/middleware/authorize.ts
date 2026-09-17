import { Request, Response, NextFunction } from 'express';
import { Role } from '../types';

// Role-based access control middleware
const authorize = (...roles: Role[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    // Check if user is authenticated
    if (!req.user) {
      return res.status(401).json({ 
        error: 'Unauthorized',
        message: 'Not authenticated' 
      });
    }

    // Check if user has required role
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ 
        error: 'Forbidden',
        message: 'You do not have permission to perform this action' 
      });
    }

    next();
  };
};

export default authorize;