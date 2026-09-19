import { config } from './config';
import { assertRoleEnforcesRls, closePool } from './db';
import { createApp } from './app';

async function main() {
  // Fail fast if the DB role would silently bypass Row Level Security.
  await assertRoleEnforcesRls();

  const app = createApp();
  const server = app.listen(config.port, () => {
    console.log(`✓ Server running on http://localhost:${config.port}`);
  });

  const shutdown = () => {
    server.close(() => {
      closePool().finally(() => process.exit(0));
    });
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch((err) => {
  console.error('❌ Failed to start:', err.message);
  process.exit(1);
});
