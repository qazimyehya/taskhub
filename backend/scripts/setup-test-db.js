// Creates the throw-away test database (if missing) and migrates it, so the
// test suite never touches the development database.
//   Reads DATABASE_URL / APP_DB_PASSWORD from .env.test
require('dotenv').config({ path: '.env.test', quiet: true });
const { Client } = require('pg');
const { execSync } = require('child_process');

async function main() {
  const { DATABASE_URL } = process.env;
  if (!DATABASE_URL) throw new Error('Create backend/.env.test first (see .env.test.example)');

  const target = new URL(DATABASE_URL);
  const dbName = target.pathname.slice(1);
  if (!dbName.endsWith('_test')) {
    throw new Error(`Refusing to set up "${dbName}": test database names must end in _test`);
  }

  const admin = new URL(DATABASE_URL);
  admin.pathname = '/postgres';
  const client = new Client({ connectionString: admin.toString() });
  await client.connect();
  try {
    const exists = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [dbName]);
    if (exists.rowCount === 0) {
      await client.query(`CREATE DATABASE "${dbName}"`);
      console.log(`✓ created database ${dbName}`);
    }
  } finally {
    await client.end();
  }

  const env = { ...process.env };
  execSync('npx prisma migrate deploy', { stdio: 'inherit', env });
  execSync('node scripts/setup-app-role.js', { stdio: 'inherit', env });
}

main().catch((err) => {
  console.error('❌', err.message);
  process.exit(1);
});
