import 'server-only';

/* The database client.
 *
 * `server-only` at the top is not decoration: it makes importing this from a
 * client component a build error rather than a leaked connection string.
 *
 * The WebSocket driver rather than the HTTP one, deliberately. `bet_state` is
 * recomputed in the same transaction as every settlement event, and the HTTP
 * driver has no interactive transaction to put them in. A derived table
 * written outside the transaction that produced the event it derives from is
 * the exact failure this model exists to prevent.
 */
import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from 'ws';
import * as schema from './schema';

neonConfig.webSocketConstructor = ws;

const url = process.env.DATABASE_URL;

/* A build must not need a database, and a preview deployment without one must
   say so rather than crash. Every route that touches data asks first. */
export const dbReady = () => Boolean(url);

let pool: Pool | null = null;
let cached: ReturnType<typeof drizzle<typeof schema>> | null = null;

export function getDb() {
  if (!url) throw new Error('DATABASE_URL is not set');
  if (!cached) {
    pool = new Pool({ connectionString: url });
    cached = drizzle(pool, { schema });
  }
  return cached;
}

export type Db = ReturnType<typeof getDb>;
export { schema };
