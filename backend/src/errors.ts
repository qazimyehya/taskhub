import { NextFunction, Request, RequestHandler, Response } from 'express';
import { ZodType } from 'zod';
import { config } from './config';

export class HttpError extends Error {
  constructor(
    public status: number,
    public error: string,
    message?: string,
    public details?: unknown
  ) {
    super(message ?? error);
  }
}

export const badRequest = (message: string) => new HttpError(400, 'Bad request', message);
export const unauthorized = (message = 'Invalid credentials') =>
  new HttpError(401, 'Unauthorized', message);
export const forbidden = (message = 'You do not have permission to perform this action') =>
  new HttpError(403, 'Forbidden', message);
export const notFound = (message: string) => new HttpError(404, 'Not found', message);
export const conflict = (message: string) => new HttpError(409, 'Conflict', message);

// Parse + validate, throwing a 400 with the Zod issues on failure.
export const parse = <T>(schema: ZodType<T>, data: unknown): T => {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new HttpError(400, 'Validation failed', 'Validation failed', result.error.issues);
  }
  return result.data;
};

// Express 4 doesn't catch rejected promises from async handlers.
export const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler =>
  (req, res, next) => {
    fn(req, res, next).catch(next);
  };

// Postgres error codes that are the client's fault rather than ours.
const PG_CLIENT_ERRORS: Record<string, [number, string, string]> = {
  '22P02': [400, 'Bad request', 'Malformed value in request'],
  '22003': [400, 'Bad request', 'Numeric value out of range'],
  '23503': [400, 'Bad request', 'Referenced record does not exist in your organization'],
  '23505': [409, 'Conflict', 'Resource already exists'],
};

export const errorHandler = (err: any, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof HttpError) {
    return res.status(err.status).json({
      error: err.error,
      message: err.message,
      ...(err.details ? { details: err.details } : {}),
    });
  }

  // Malformed JSON body etc. (body-parser sets err.status)
  if (err?.status && err.status >= 400 && err.status < 500 && err.expose) {
    return res.status(err.status).json({ error: 'Bad request', message: err.message });
  }

  const pgMapping = err?.code && PG_CLIENT_ERRORS[err.code];
  if (pgMapping) {
    const [status, error, message] = pgMapping;
    return res.status(status).json({ error, message });
  }

  console.error('Unhandled error:', err);
  return res.status(500).json({
    error: 'Internal server error',
    message: config.isProd ? 'Something went wrong' : err?.message,
  });
};
