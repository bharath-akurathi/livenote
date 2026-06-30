import pg from 'pg';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import 'dotenv/config';

const { Pool } = pg;

const isSupabase = process.env.DATABASE_URL?.includes('supabase');

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
  ...(isSupabase && { ssl: { rejectUnauthorized: false } }),
});


pool.on('error', (err) => {
  console.error('Unexpected DB pool error', err);
});

/** Run parameterized query, return rows */
export async function query<T extends pg.QueryResultRow = pg.QueryResultRow>(
  sql: string,
  values?: unknown[]
): Promise<T[]> {
  const client = await pool.connect();
  try {
    const res = await client.query<T>(sql, values);
    return res.rows;
  } catch (err) {
    console.error('Error executing query', sql, err);
    throw err;
  } finally {
    client.release();
  }
}

/** Run a query and return only the first row (or null) */
export async function queryOne<T extends pg.QueryResultRow = pg.QueryResultRow>(
  sql: string,
  values?: unknown[]
): Promise<T | null> {
  const rows = await query<T>(sql, values);
  return rows[0] ?? null;
}

/** Run the init SQL migration */
export async function runMigrations(): Promise<void> {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const sql = readFileSync(join(__dirname, 'migrations', '001_init.sql'), 'utf-8');
  await pool.query(sql);
  console.log('✅ Migrations applied');
}
