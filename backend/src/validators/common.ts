import { z } from 'zod';

// Postgres `integer` max — anything larger would blow up as a 500.
const INT4_MAX = 2147483647;

// Numeric id from a URL param / query string ("12" -> 12, "abc" -> validation error).
export const idSchema = z.coerce.number().int().positive().max(INT4_MAX);

export const idParams = z.object({ id: idSchema });

// Numeric id from a JSON body (must already be a number).
export const bodyIdSchema = z.number().int().positive().max(INT4_MAX);
