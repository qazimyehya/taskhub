import dotenv from 'dotenv';
import path from 'path';

// Tests must never run against the development database.
dotenv.config({ path: path.resolve(__dirname, '../../.env.test'), quiet: true });

const dbNameOf = (name: string): string => {
  const url = process.env[name];
  if (!url) {
    throw new Error(
      `${name} is not set. Copy backend/.env.test.example to backend/.env.test, ` +
        'then run `npm run test:db:setup`.'
    );
  }
  return new URL(url).pathname.slice(1);
};

for (const name of ['DATABASE_URL', 'APP_DATABASE_URL']) {
  const db = dbNameOf(name);
  if (!db.endsWith('_test')) {
    throw new Error(`Refusing to run tests: ${name} points at "${db}", not a *_test database.`);
  }
}

process.env.NODE_ENV = 'test';
process.env.AUTH_RATE_LIMIT_MAX = '1000';
process.env.JWT_SECRET ||= 'test-access-secret';
process.env.REFRESH_TOKEN_SECRET ||= 'test-refresh-secret';
