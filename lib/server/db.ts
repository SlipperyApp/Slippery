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

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[] = [],
): Promise<T[]> {
  const res = await getPool().query<T>(text, params);
  return res.rows;
}

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
