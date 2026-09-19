import dotenv from 'dotenv';

dotenv.config({ quiet: true });

const required = (name: string): string => {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
};

const int = (name: string, fallback: number): number => {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (Number.isNaN(parsed)) {
    throw new Error(`Environment variable ${name} must be an integer, got "${raw}"`);
  }
  return parsed;
};

const nodeEnv = process.env.NODE_ENV || 'development';
const isProd = nodeEnv === 'production';

const jwtSecret = required('JWT_SECRET');
const refreshTokenSecret = required('REFRESH_TOKEN_SECRET');
if (jwtSecret === refreshTokenSecret) {
  throw new Error('JWT_SECRET and REFRESH_TOKEN_SECRET must be different values');
}

export const config = {
  nodeEnv,
  isProd,
  port: int('PORT', 3001),

  // The API connects as the restricted `taskhub_app` role so RLS is enforced.
  // DATABASE_URL (owner/superuser) is for migrations only and is not read here.
  appDatabaseUrl: required('APP_DATABASE_URL'),

  jwtSecret,
  refreshTokenSecret,
  accessTokenTtl: '15m',
  refreshTokenTtlSeconds: 7 * 24 * 60 * 60,

  corsOrigins: (
    process.env.CORS_ORIGINS ||
    'http://localhost,http://localhost:80,http://localhost:3000,http://localhost:5173'
  )
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),

  // Number of reverse-proxy hops in front of the API (nginx = 1). Leave at 0
  // when the API is exposed directly, otherwise clients could spoof their IP
  // via X-Forwarded-For and dodge the rate limiter.
  trustProxy: int('TRUST_PROXY', 0),

  // Attempts per 15 min per IP on login/signup.
  authRateLimitMax: int('AUTH_RATE_LIMIT_MAX', isProd ? 10 : 100),

  cookieSecure: process.env.COOKIE_SECURE
    ? process.env.COOKIE_SECURE === 'true'
    : isProd,
};
