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

/* The public shape of an account. Kept beside the response helpers rather
   than exported from a route file: a route module may only export handlers
   and config, so anything else living there is a build error. */
export function publicUser(a: {
  id: string; email: string; displayName: string | null; handle: string | null;
  unitPence: number | null; currency: string; weekStart: number;
  oddsFormat: string; showProfitIn: string; calendarDates: boolean;
  theme: string; plan: string | null; planState: string | null;
  targetPence: number | null; bankrollStartPence: number | null;
  cardOrder: unknown; cardsAbove: unknown; linkCode: string | null;
}) {
  return {
    id: a.id, email: a.email, displayName: a.displayName, handle: a.handle,
    unitPence: a.unitPence, currency: a.currency, weekStart: a.weekStart,
    oddsFormat: a.oddsFormat, showProfitIn: a.showProfitIn,
    calendarDates: a.calendarDates, theme: a.theme,
    plan: a.plan, planState: a.planState,
    targetPence: a.targetPence, bankrollStartPence: a.bankrollStartPence,
    cardOrder: a.cardOrder, cardsAbove: a.cardsAbove,
    /* The link code is the person's own, and the bot needs them to be able
       to read it. It is single use and expires. */
    linkCode: a.linkCode,
  };
}
