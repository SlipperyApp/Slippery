/** A small in-memory rate limiter.
 *
 *  Per instance, so it is a speed bump rather than a guarantee, and it is
 *  honest about that. Its real job is that every limited route has a REAL
 *  429 branch with a countdown, which the previous build did not: it put the
 *  raw rate limit string in a toast with no number in it. */

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

function clientKey(req: Request, scope: string): string {
  const h = req.headers;
  const ip = h.get('x-forwarded-for')?.split(',')[0]?.trim()
    || h.get('x-real-ip')
    || 'unknown';
  return `${scope}:${ip}`;
}

export type Limit = { ok: boolean; remaining: number; retryAfter: number };

export function rateLimit(req: Request, scope: string, max: number, windowSeconds: number): Limit {
  const key = clientKey(req, scope);
  const now = Date.now();
  const cur = buckets.get(key);

  if (!cur || cur.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowSeconds * 1000 });
    return { ok: true, remaining: max - 1, retryAfter: 0 };
  }
  cur.count += 1;
  if (cur.count > max) {
    return { ok: false, remaining: 0, retryAfter: Math.max(1, Math.ceil((cur.resetAt - now) / 1000)) };
  }
  return { ok: true, remaining: max - cur.count, retryAfter: 0 };
}

/** Keeps the map from growing without bound in a long lived instance. */
export function sweepBuckets(now = Date.now()) {
  for (const [k, v] of buckets) if (v.resetAt <= now) buckets.delete(k);
}
