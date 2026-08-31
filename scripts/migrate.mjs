/** The migration runner.
 *
 *  Reads migrations/*.sql in filename order, applies the ones that have not
 *  been applied, and records each in schema_migrations. Forward only: a file
 *  that has already run is never re-run and never edited in place.
 *
 *  This runs at BUILD time on Vercel, where DATABASE_URL is present, because
 *  a serverless request handler is the wrong place for DDL and the previous
 *  build proved it: no deployment could say what its database looked like.
 *
 *  It never fails the build. A deployment that cannot reach the database
 *  should still go green and say so through GET /api/sources, rather than
 *  leaving nothing deployed at all. The exit code is always 0 and the reason
 *  is always printed.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIR = join(ROOT, 'migrations');

const url = process.env.DATABASE_URL;
if (!url) {
  console.log('[migrate] DATABASE_URL is not set. Skipping, and the app will render from the example account.');
  process.exit(0);
}

let Pool;
try {
  ({ Pool } = await import('pg'));
} catch (err) {
  console.log('[migrate] pg is not installed here. Skipping.', String(err));
  process.exit(0);
}

const pool = new Pool({
  connectionString: url,
  max: 1,
  connectionTimeoutMillis: 15_000,
  ssl: url.includes('localhost') ? undefined : { rejectUnauthorized: false },
});

try {
  await pool.query(`
    create table if not exists schema_migrations (
      name       text primary key,
      applied_at timestamptz not null default now()
    )`);

  const applied = new Set(
    (await pool.query('select name from schema_migrations')).rows.map((r) => r.name),
  );

  const files = readdirSync(DIR).filter((f) => f.endsWith('.sql')).sort();
  let ran = 0;

  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = readFileSync(join(DIR, file), 'utf8');
    const client = await pool.connect();
    try {
      await client.query('begin');
      await client.query(sql);
      await client.query('insert into schema_migrations (name) values ($1)', [file]);
      await client.query('commit');
      ran += 1;
      console.log(`[migrate] applied ${file}`);
    } catch (err) {
      await client.query('rollback').catch(() => {});
      // Loud, and still not fatal: a red deployment helps nobody at 4am.
      console.error(`[migrate] FAILED on ${file}. Nothing from that file was applied.`);
      console.error(`[migrate] ${err && err.message ? err.message : String(err)}`);
      break;
    } finally {
      client.release();
    }
  }

  console.log(`[migrate] ${ran} applied, ${files.length - ran} already present.`);
} catch (err) {
  console.error('[migrate] could not reach the database:', err && err.message ? err.message : String(err));
  console.error('[migrate] the deployment continues; GET /api/sources reports what it can reach.');
} finally {
  await pool.end().catch(() => {});
}

process.exit(0);
