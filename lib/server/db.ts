/** The database.
 *
 *  `pg` over a pooled connection, with checked in SQL migrations applied
 *  forward only. No DDL ever runs from inside a request handler: the old app
 *  did that, so no deployment could say what its database looked like.
 *
 *  Without DATABASE_URL every call here refuses rather than throwing an
 *  unhandled error, and the product renders from the example account. */

import { Pool, type PoolClient, type QueryResultRow } from 'pg';
import { read } from './env';

let pool: Pool | null = null;

export function hasDatabase(): boolean {
  return Boolean(read('DATABASE_URL'));
}

function getPool(): Pool {
  if (!pool) {
    const connectionString = read('DATABASE_URL');
    if (!connectionString) throw new Error('DATABASE_URL is not set');
    pool = new Pool({
      connectionString,
      max: 3,
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 8_000,
      ssl: connectionString.includes('localhost') ? undefined : { rejectUnauthorized: false },
    });
  }
  return pool;
}

/** The smallest thing a server module needs: something that runs a statement.
 *
 *  A PoolClient satisfies it, `pooled` below satisfies it, and so does a fake,
 *  which is how the rules that matter get tested as rules rather than as
 *  queries. It lives here rather than in each module so that a function
 *  written for a transaction can be handed the pool without a second type
 *  saying the same thing in a different file. */
export type Runner = {
  query<R = Record<string, unknown>>(text: string, params?: unknown[]): Promise<{ rows: R[] }>;
};

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[] = [],
): Promise<T[]> {
  const res = await getPool().query<T>(text, params);
  return res.rows;
}

/** The pool shaped like a client, for the reads that do not need one.
 *
 *  A server module that takes a client so it can be used inside a transaction
 *  should not force a `begin` and a `commit` onto a single select. A
 *  PoolClient and this both satisfy the small `{ query }` type those modules
 *  take. */
export const pooled = {
  async query<R>(text: string, params: unknown[] = []): Promise<{ rows: R[] }> {
    return { rows: (await query(text, params)) as R[] };
  },
};

/** Every write that touches settlement_events runs inside one of these, with
 *  the bet_state recompute in the same transaction. */
export async function transaction<T>(fn: (c: PoolClient) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query('begin');
    const out = await fn(client);
    await client.query('commit');
    return out;
  } catch (err) {
    try { await client.query('rollback'); } catch { /* the connection is going away anyway */ }
    throw err;
  } finally {
    client.release();
  }
}

/** True when the database is reachable. Used by /api/sources, which reports
 *  what a running deployment can actually do rather than what it was
 *  configured to do. */
export async function pingDatabase(): Promise<boolean> {
  if (!hasDatabase()) return false;
  try {
    await query('select 1');
    return true;
  } catch {
    return false;
  }
}

/** Which checked in migrations this database has actually had applied.
 *  Reported by /api/sources, because "configured" and "migrated" are two
 *  different things and only one of them makes a write work. */
export async function schemaReady(): Promise<{ ready: boolean; applied: string[]; reason?: string }> {
  if (!hasDatabase()) return { ready: false, applied: [], reason: 'DATABASE_URL is not set' };
  try {
    const rows = await query<{ name: string }>('select name from schema_migrations order by name');
    return { ready: rows.length > 0, applied: rows.map((r) => r.name) };
  } catch (err) {
    return { ready: false, applied: [], reason: err instanceof Error ? err.message : 'unreadable' };
  }
}
