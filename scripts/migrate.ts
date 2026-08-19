/* Forward-only migrations, applied from files that are checked in.
 *
 * The old app ran its DDL from inside request handlers, which meant there was
 * no history to point at, no way to know what a given deployment's database
 * actually looked like, and a schema change shipped by whichever request
 * happened to arrive first. This reads `drizzle/*.sql` in order and records
 * what it applied.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';

neonConfig.webSocketConstructor = ws as never;

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL is not set. Nothing to migrate against.');
  process.exit(1);
}

const dir = join(process.cwd(), 'drizzle');
const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();

const pool = new Pool({ connectionString: url });

await pool.query(`
  CREATE TABLE IF NOT EXISTS schema_migrations (
    name text PRIMARY KEY,
    applied_at timestamptz NOT NULL DEFAULT now()
  )`);

const { rows } = await pool.query<{ name: string }>('SELECT name FROM schema_migrations');
const done = new Set(rows.map((r) => r.name));

for (const file of files) {
  if (done.has(file)) { console.log('skip  ', file); continue; }
  const sql = readFileSync(join(dir, file), 'utf8');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    /* drizzle-kit separates statements with its own breakpoint marker; a
       plain split on semicolons would cut a function body in half. */
    for (const stmt of sql.split('--> statement-breakpoint')) {
      const trimmed = stmt.trim();
      if (trimmed) await client.query(trimmed);
    }
    await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
    await client.query('COMMIT');
    console.log('applied', file);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('failed ', file, err);
    process.exit(1);
  } finally {
    client.release();
  }
}

await pool.end();
console.log('migrations up to date');
