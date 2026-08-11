/* Postgres via the Neon serverless driver.
 *
 * Neon over HTTP rather than a TCP pool: serverless functions are created and
 * destroyed per request, and a connection pool in that shape exhausts the
 * database's connection limit under any real traffic.
 *
 * UNIQUENESS IS THE DATABASE'S JOB. Email and display name are UNIQUE
 * constraints, and signup catches the violation. A "is this taken?" SELECT
 * before an INSERT is a race by construction: two requests can both read
 * "free" and both insert. The constraint is the only thing that actually
 * holds, so the code is written to expect it to fire.
 */
import { neon } from '@neondatabase/serverless';

let _sql = null;

export function configured() {
  return Boolean(process.env.DATABASE_URL);
}

export function db() {
  if (!configured()) {
    const err = new Error('No database is connected yet.');
    err.statusCode = 503;
    throw err;
  }
  if (!_sql) _sql = neon(process.env.DATABASE_URL);
  return _sql;
}

/* Idempotent schema. Runs on demand and is cheap after the first call, so
   there is no separate migration step to forget before a deploy. */
let _ready = false;
export async function ensureSchema() {
  if (_ready) return;
  const sql = db();

  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      email          text NOT NULL,
      email_lower    text NOT NULL,
      display_name   text NOT NULL,
      name_lower     text NOT NULL,
      password_hash  text NOT NULL,
      email_verified boolean NOT NULL DEFAULT false,
      age_confirmed  boolean NOT NULL DEFAULT false,
      telegram_id    bigint,
      link_code      text,
      unit_pence     integer NOT NULL DEFAULT 10000,
      created_at     timestamptz NOT NULL DEFAULT now(),
      deleted_at     timestamptz
    )`;

  /* The three constraints the product depends on. Partial indexes so a
     deleted account frees its email and name for reuse. */
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS users_email_key
            ON users (email_lower) WHERE deleted_at IS NULL`;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS users_name_key
            ON users (name_lower) WHERE deleted_at IS NULL`;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS users_telegram_key
            ON users (telegram_id) WHERE telegram_id IS NOT NULL AND deleted_at IS NULL`;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS users_link_code_key
            ON users (link_code) WHERE link_code IS NOT NULL`;

  await sql`
    CREATE TABLE IF NOT EXISTS verification_codes (
      id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      code_hash  text NOT NULL,
      expires_at timestamptz NOT NULL,
      attempts   integer NOT NULL DEFAULT 0,
      consumed   boolean NOT NULL DEFAULT false,
      created_at timestamptz NOT NULL DEFAULT now()
    )`;
  await sql`CREATE INDEX IF NOT EXISTS verification_user_idx ON verification_codes (user_id)`;

  await sql`
    CREATE TABLE IF NOT EXISTS auth_sessions (
      id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash text NOT NULL UNIQUE,
      expires_at timestamptz NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    )`;
  await sql`CREATE INDEX IF NOT EXISTS auth_sessions_user_idx ON auth_sessions (user_id)`;

  await sql`
    CREATE TABLE IF NOT EXISTS rate_limits (
      bucket       text PRIMARY KEY,
      hits         integer NOT NULL DEFAULT 0,
      window_start timestamptz NOT NULL DEFAULT now()
    )`;

  await sql`
    CREATE TABLE IF NOT EXISTS bets (
      id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      event         text,
      selection     text,
      market        text,
      bookmaker     text,
      odds          numeric(10,4),
      stake_pence   integer NOT NULL,
      profit_pence  integer,
      outcome       text,
      status        text NOT NULL DEFAULT 'pending',
      fixture_id    text,
      placed_at     timestamptz NOT NULL DEFAULT now(),
      settled_at    timestamptz,
      settle_reason text,
      source        text NOT NULL DEFAULT 'upload'
    )`;
  await sql`CREATE INDEX IF NOT EXISTS bets_user_idx ON bets (user_id, placed_at DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS bets_pending_idx ON bets (status) WHERE status = 'pending'`;

  /* Slip images are the most sensitive thing stored, so the retention
     promise in the privacy policy is a column the cleanup job can act on
     rather than a sentence nobody enforces. */
  await sql`
    CREATE TABLE IF NOT EXISTS slips (
      id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      bet_id      uuid REFERENCES bets(id) ON DELETE SET NULL,
      image_url   text,
      sha256      text,
      created_at  timestamptz NOT NULL DEFAULT now(),
      purge_after timestamptz NOT NULL DEFAULT (now() + interval '90 days')
    )`;
  await sql`CREATE INDEX IF NOT EXISTS slips_purge_idx ON slips (purge_after)`;

  _ready = true;
}

/** Postgres unique-violation. */
export const UNIQUE_VIOLATION = '23505';
export function uniqueViolation(err) {
  return err && (err.code === UNIQUE_VIOLATION ||
    /duplicate key value violates unique constraint/i.test(err.message || ''));
}
export function violatedIndex(err) {
  const m = /unique constraint "([^"]+)"/i.exec(err && err.message || '');
  return m ? m[1] : '';
}
