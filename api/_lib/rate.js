/* Rate limiting, in Postgres.
 *
 * Deliberately not Redis: the database is already a hard dependency, and one
 * more managed service for a counter is not worth the operational surface.
 * Accuracy is a fixed window, which is enough to stop credential stuffing and
 * verification-code brute force.
 */
import { db, configured } from './db.js';

/**
 * @returns {Promise<{allowed:boolean, retryAfter:number}>}
 */
export async function limit(bucket, max, windowSeconds) {
  if (!configured()) return { allowed: true, retryAfter: 0 };
  const sql = db();
  const rows = await sql`
    INSERT INTO rate_limits (bucket, hits, window_start)
    VALUES (${bucket}, 1, now())
    ON CONFLICT (bucket) DO UPDATE SET
      hits = CASE
        WHEN rate_limits.window_start < now() - ${windowSeconds + ' seconds'}::interval
        THEN 1 ELSE rate_limits.hits + 1 END,
      window_start = CASE
        WHEN rate_limits.window_start < now() - ${windowSeconds + ' seconds'}::interval
        THEN now() ELSE rate_limits.window_start END
    RETURNING hits, EXTRACT(EPOCH FROM (window_start + ${windowSeconds + ' seconds'}::interval - now())) AS retry_after`;
  const row = rows[0];
  return {
    allowed: row.hits <= max,
    retryAfter: Math.max(1, Math.ceil(Number(row.retry_after) || windowSeconds))
  };
}

/** Apply a limit and write the 429 if it is exceeded. Returns true to continue. */
export async function guard(res, bucket, max, windowSeconds) {
  const { allowed, retryAfter } = await limit(bucket, max, windowSeconds);
  if (allowed) return true;
  res.statusCode = 429;
  res.setHeader('retry-after', String(retryAfter));
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.end(JSON.stringify({ error: 'Too many attempts. Try again in a moment.' }));
  return false;
}
