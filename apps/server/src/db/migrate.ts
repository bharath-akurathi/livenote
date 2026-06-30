import 'dotenv/config';
import { runMigrations, pool } from './index.js';

async function main() {
  await runMigrations();
  await pool.end();
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
