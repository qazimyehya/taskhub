import { z } from 'zod';
import { bodyIdSchema } from './common';

export const createProjectSchema = z.object({
  name: z.string().trim().min(1, 'Project name is required').max(255),
  description: z.string().max(10000).optional(),
});

export const updateProjectSchema = z.object({
  name: z.string().trim().min(1, 'Project name is required').max(255).optional(),
  description: z.string().max(10000).nullable().optional(),
});

export const addMemberSchema = z.object({
  userId: bodyIdSchema,
});

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
