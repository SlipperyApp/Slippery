import { NextResponse } from 'next/server';
import { rateLimit } from './ratelimit';

/** One shape for every route handler answer, so a client never has to guess
 *  what a failure looks like. */
export function ok(body: Record<string, unknown> = {}) {
  return NextResponse.json({ ok: true, ...body });
}

export function fail(status: number, error: string, message: string, extra: Record<string, unknown> = {}) {
  return NextResponse.json({ ok: false, error, message, ...extra }, { status });
}

/** Every limited route gets a REAL 429 with a countdown the client can show.
 *  The previous build put the raw rate limit string in a toast with no
 *  number in it. */
export function limitOr429(req: Request, scope: string, max: number, windowSeconds: number) {
  const l = rateLimit(req, scope, max, windowSeconds);
  if (l.ok) return null;
  return NextResponse.json(
    {
      ok: false,
      error: 'rate_limited',
      message: `Too many attempts. Try again in ${l.retryAfter} seconds.`,
      retryAfterSeconds: l.retryAfter,
    },
    { status: 429, headers: { 'retry-after': String(l.retryAfter) } },
  );
}

export async function readJson(req: Request): Promise<Record<string, unknown>> {
  try {
    const b = await req.json();
    return typeof b === 'object' && b ? (b as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');
export const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : Number.NaN);
export const bool = (v: unknown): boolean => v === true;
