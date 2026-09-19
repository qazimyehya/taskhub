// Sets the password of the restricted `taskhub_app` role (created by the
// enforce_rls_app_role migration). Runs as the owner/superuser (DATABASE_URL)
// so the password never lives in a migration file.
//
//   APP_DB_PASSWORD must match the password inside APP_DATABASE_URL.
require('dotenv').config({ quiet: true });
const { Client } = require('pg');

async function main() {
  const { DATABASE_URL, APP_DB_PASSWORD } = process.env;
  if (!DATABASE_URL || !APP_DB_PASSWORD) {
    throw new Error('DATABASE_URL and APP_DB_PASSWORD must both be set');
  }

  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();
  try {
    await client.query(
      `ALTER ROLE taskhub_app WITH LOGIN PASSWORD ${client.escapeLiteral(APP_DB_PASSWORD)}`
    );
    console.log('✓ taskhub_app role password set');
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('❌ setup-app-role failed:', err.message);
  process.exit(1);
});
