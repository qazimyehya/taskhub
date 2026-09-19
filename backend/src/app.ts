import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import pool from './db';
import { config } from './config';
import { errorHandler } from './errors';
import authRoutes from './routes/auth';
import projectRoutes from './routes/projects';
import taskRoutes from './routes/tasks';
import userRoutes from './routes/users';

const limiterMessage = {
  error: 'Too many requests',
  message: 'Too many attempts. Please try again after 15 minutes.',
};

export function createApp() {
  const app = express();

  app.disable('x-powered-by');

  // Behind nginx every request arrives from the proxy's IP. Trust exactly the
  // configured number of hops so req.ip (and therefore the rate limiter) sees
  // the real client.
  if (config.trustProxy > 0) {
    app.set('trust proxy', config.trustProxy);
  }

  // Brute-force protection for credential endpoints only (per client IP).
  // Failed logins count; successful ones don't lock legitimate users out.
  const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: config.authRateLimitMax,
    skipSuccessfulRequests: true,
    message: limiterMessage,
    standardHeaders: true,
    legacyHeaders: false,
  });
  const signupLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: config.authRateLimitMax,
    message: limiterMessage,
    standardHeaders: true,
    legacyHeaders: false,
  });
  // Silent refresh runs in the background; give it its own, larger bucket so it
  // can't be starved by (or starve) login attempts.
  const refreshLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 100,
    message: limiterMessage,
    standardHeaders: true,
    legacyHeaders: false,
  });

  app.use(cors({ origin: config.corsOrigins, credentials: true }));
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());

  app.use('/auth/login', loginLimiter);
  app.use('/auth/signup', signupLimiter);
  app.use('/auth/refresh', refreshLimiter);

  app.use('/auth', authRoutes);
  app.use('/users', userRoutes);
  app.use('/projects', projectRoutes);
  app.use('/tasks', taskRoutes);

  app.get('/', (_req, res) => {
    res.json({ message: 'TaskHub Backend is running!' });
  });

  app.get('/health', async (_req, res) => {
    try {
      await pool.query('SELECT 1');
      res.json({ status: 'ok' });
    } catch {
      res.status(503).json({ status: 'unavailable' });
    }
  });

  app.use((_req, res) => {
    res.status(404).json({ error: 'Not found', message: 'Route not found' });
  });
  app.use(errorHandler);

  return app;
}
