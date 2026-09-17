// User roles
export type Role = 'admin' | 'member';

// JWT payload structure
export interface JwtPayload {
  userId: number;
  tenantId: number;
  role: Role;
}

// Extend Express Request to include user
declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}