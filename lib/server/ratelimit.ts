import 'server-only';
import { sql } from 'drizzle-orm';
import { getDb, dbReady } from '@/lib/db';

export type Limit = { ok: true } | { ok: false; retryAfterSeconds: number };

/* Rate limiting with a number attached.
 *
 * The old app had no 429 branch at all on signup or login: the server's
 * refusal went into a toast with no countdown, so the only advice anybody got
 * was to try again, immediately, which is exactly what the limit is there to
 * stop. Every refusal here carries the seconds to wait, and the screen shows
 * them counting down. */
export async function rateLimit(key: string, max: number, windowSeconds: number): Promise<Limit> {
  if (!dbReady()) return { ok: true };
  const db = getDb();
  const rows = await db.execute(sql`
    INSERT INTO rate_limits (key, count, window_start)
    VALUES (${key}, 1, now())
    ON CONFLICT (key) DO UPDATE SET
      count = CASE
        WHEN rate_limits.window_start < now() - (${windowSeconds} || ' seconds')::interval THEN 1
        ELSE rate_limits.count + 1 END,
      window_start = CASE
        WHEN rate_limits.window_start < now() - (${windowSeconds} || ' seconds')::interval THEN now()
        ELSE rate_limits.window_start END
    RETURNING count, extract(epoch from (window_start + (${windowSeconds} || ' seconds')::interval - now())) AS remaining
  `);
  const row = (rows.rows?.[0] ?? {}) as { count?: number; remaining?: number };
  const count = Number(row.count ?? 1);
  if (count <= max) return { ok: true };
  return { ok: false, retryAfterSeconds: Math.max(1, Math.ceil(Number(row.remaining ?? windowSeconds))) };
}

export const LIMITS = {
  signup: { max: 5, window: 900 },
  login: { max: 10, window: 900 },
  verify: { max: 8, window: 900 },
  linkCode: { max: 12, window: 600 },
  extract: { max: 30, window: 3600 },
  /* Leaves the building and costs somebody else's inbox. */
  exportEmail: { max: 3, window: 3600 },
  telegram: { max: 40, window: 3600 },
};
