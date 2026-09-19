import { z } from 'zod';
import { bodyIdSchema, idSchema } from './common';

const statusSchema = z.enum(['todo', 'in_progress', 'done']);
const prioritySchema = z.enum(['low', 'medium', 'high']);

// Accepts ISO dates / datetimes. An empty string (cleared <input type="date">)
// is treated as "no due date".
const dueDateSchema = z
  .string()
  .trim()
  .refine((v) => v === '' || !Number.isNaN(Date.parse(v)), 'Invalid date')
  .transform((v) => (v === '' ? null : v));

export const createTaskSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(255),
  description: z.string().max(10000).optional(),
  status: statusSchema.default('todo'),
  priority: prioritySchema.optional(),
  projectId: bodyIdSchema,
  assignedTo: bodyIdSchema.nullable().optional(),
  dueDate: dueDateSchema.nullable().optional(),
});

// PATCH semantics: a key that is absent is left alone; `null` clears the
// field (description / priority / assignedTo / dueDate).
export const updateTaskSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(255).optional(),
  description: z.string().max(10000).nullable().optional(),
  status: statusSchema.optional(),
  priority: prioritySchema.nullable().optional(),
  assignedTo: bodyIdSchema.nullable().optional(),
  dueDate: dueDateSchema.nullable().optional(),
});

export const listTasksQuerySchema = z.object({
  status: statusSchema.optional(),
  assignee: idSchema.optional(),
  projectId: idSchema.optional(),
  search: z.string().trim().max(200).optional(),
  page: z.coerce.number().int().min(1).max(1_000_000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
});

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
