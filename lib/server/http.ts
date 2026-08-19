import { NextResponse } from 'next/server';

/* One shape for every answer this API gives, so the client never has to
   guess whether a failure arrived as a string, an object or an empty 500. */
export const ok = (body: unknown = {}, init?: ResponseInit) =>
  NextResponse.json({ ok: true, ...(body as object) }, init);

export const fail = (status: number, error: string, extra: object = {}) =>
  NextResponse.json({ ok: false, error, ...extra }, { status });

export const unauthorised = () => fail(401, 'Sign in first.');

export const tooMany = (seconds: number) =>
  NextResponse.json(
    { ok: false, error: 'Too many attempts.', retryAfterSeconds: seconds },
    { status: 429, headers: { 'retry-after': String(seconds) } },
  );

export const noDatabase = () =>
  fail(503, 'The ledger is not reachable right now. Nothing has been lost, try again shortly.');

export async function readJson<T = Record<string, unknown>>(req: Request): Promise<T> {
  try { return (await req.json()) as T; } catch { return {} as T; }
}
