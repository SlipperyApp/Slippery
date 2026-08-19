import { NextRequest } from 'next/server';
import { eq, and } from 'drizzle-orm';
import { getDb, schema, dbReady } from '@/lib/db';
import { viewer } from '@/lib/server/session';
import { ok, fail, unauthorised, noDatabase, readJson } from '@/lib/server/http';
import { appendEvent, cashOutPortion } from '@/lib/server/bets';
import { EVENT_TYPES } from '@/lib/db/recompute';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

/* Settling by hand, and cashing out.
 *
 * SETTLEMENT WRITES HAPPEN ON THE SERVER ONLY. The browser asks and re-reads;
 * it never grades a bet itself, or there would be two graders and eventually
 * two answers.
 *
 * CASH OUT IS ALWAYS A USER ACTION. It cannot be detected from a results
 * feed, so nothing automatic may ever write one. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!dbReady()) return noDatabase();
  const account = await viewer();
  if (!account) return unauthorised();

  const { id } = await params;
  const body = await readJson<any>(req);
  const type = String(body.type || '');
  if (!EVENT_TYPES.includes(type as never)) return fail(400, 'That is not an outcome this ledger records.');
  if (type === 'placed') return fail(400, 'A bet is placed once, when it is logged.');

  const db = getDb();
  const rows = await db
    .select({ bet: schema.bets, state: schema.betState })
    .from(schema.bets)
    .leftJoin(schema.betState, eq(schema.betState.betId, schema.bets.id))
    .where(and(eq(schema.bets.id, id), eq(schema.bets.accountId, account.id)))
    .limit(1);
  const found = rows[0];
  if (!found) return fail(404, 'No such bet.');

  const remaining = found.state?.remainingStakePence ?? found.bet.stakePence;
  if (remaining <= 0 && !['rule4', 'commission', 'promo_refund', 'manual_correction'].includes(type)) {
    return fail(409, 'That bet is already settled. Correct it from its change history instead.');
  }

  let event: any = { type, enteredBy: 'user', afterResultKnown: Boolean(body.afterResultKnown), note: body.note ?? null };

  if (type === 'cash_out_partial') {
    const eighths = Number(body.fractionEighths);
    if (!Number.isInteger(eighths) || eighths < 1 || eighths > 8) {
      return fail(400, 'Cash out is in eighths of what is still running, from one to eight.');
    }
    const { portionPence } = cashOutPortion(remaining, eighths);
    if (body.returnedPence == null) return fail(400, 'How much did the cash out return?');
    event = { ...event, fractionEighths: eighths, stakePortionPence: portionPence, returnedPence: Math.round(Number(body.returnedPence)) };
  } else if (type === 'cash_out_full') {
    if (body.returnedPence == null) return fail(400, 'How much did the cash out return?');
    event = { ...event, stakePortionPence: remaining, returnedPence: Math.round(Number(body.returnedPence)) };
  } else if (type === 'won') {
    event = { ...event, odds: body.odds ?? (found.bet.odds != null ? Number(found.bet.odds) : null), returnedPence: body.returnedPence != null ? Math.round(Number(body.returnedPence)) : null };
  } else if (['rule4', 'commission', 'promo_refund', 'manual_correction'].includes(type)) {
    event = { ...event, returnedPence: body.amountPence != null ? Math.round(Number(body.amountPence)) : null };
  }

  const state = await db.transaction((tx) => appendEvent(tx, id, event));
  return ok({ state });
}
