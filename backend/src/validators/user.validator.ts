import { z } from 'zod';

export const inviteSchema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(8, 'Password must be at least 8 characters').max(72),
  firstName: z.string().trim().min(1, 'First name is required'),
  lastName: z.string().trim().min(1, 'Last name is required'),
  role: z.enum(['admin', 'member']).default('member'),
});

export const updateRoleSchema = z.object({
  role: z.enum(['admin', 'member'], { message: 'Role must be admin or member' }),
});
