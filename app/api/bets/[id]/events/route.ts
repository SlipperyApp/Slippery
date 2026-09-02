import { hasDatabase, transaction } from '@/lib/server/db';
import { currentAccount } from '@/lib/server/auth';
import { fail, limitOr429, ok, readJson, str } from '@/lib/server/respond';
import { appendEvent, appendResult } from '@/lib/server/bets';
import { once, validKey } from '@/lib/server/idempotency';
import type { EventType } from '@/lib/domain/types';

export const runtime = 'nodejs';

const ALLOWED = new Set<EventType>([
  'won', 'lost', 'void', 'placed', 'push', 'half_won', 'half_lost',
  'cash_out_partial', 'cash_out_full',
  'rule4', 'commission', 'promo_refund', 'manual_correction',
]);

/*  A RESULT, as opposed to an adjustment or a part pull.
 *
 *  These go through appendResult rather than appendEvent, because a winner on
 *  an exchange owes commission on its net winnings and appendResult is the
 *  one place that decides whether a charge is owed. Recording "won" by hand
 *  through this route used to append the result and nothing else, so a
 *  manually settled Betfair winner was reported one and a half to two per
 *  cent above what the exchange actually paid, exactly the defect the cron
 *  path was fixed for.
 *
 *  cash_out_partial is deliberately NOT here. Commission is charged once per
 *  bet, so charging it on the first of several pulls would leave the rest of
 *  the bet uncharged; it is charged when the bet reaches a result. */
const RESULTS = new Set<EventType>([
  'won', 'lost', 'void', 'placed', 'push', 'half_won', 'half_lost', 'cash_out_full',
]);

/** The ONLY path that appends a settlement event.
 *
 *  The event and the bet_state recompute happen inside one transaction, so
 *  bet_state can never lag the ledger it folds and a failed request writes
 *  nothing at all. The idempotency claim is in that transaction too: an
 *  append only ledger has no edit to undo a duplicate with, so a retried
 *  request must not be able to settle the same bet twice. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const limited = limitOr429(req, 'events', 60, 300);
  if (limited) return limited;

  const { id } = await ctx.params;
  const body = await readJson(req);
  const type = str(body.type) as EventType;

  if (!ALLOWED.has(type)) return fail(400, 'bad_type', 'That is not a settlement event this product knows about.');

  const key = validKey(body.idempotencyKey) ? body.idempotencyKey : null;

  if (!hasDatabase()) {
    return fail(503, 'no_store', 'This deployment has no database, so nothing was written. The figures above were computed by the same fold that would have written them.');
  }
  const account = await currentAccount();
  if (!account) {
    return fail(401, 'no_session', 'You are looking at the example account, so nothing was written. The figures above are real: they come from the same fold your own ledger would use.');
  }

  try {
    const append = RESULTS.has(type) ? appendResult : appendEvent;
    const out = await transaction((client) => once(client, account.id, 'settlement_event', key, () =>
      append(client, {
        accountId: account.id,
        betId: id,
        type,
        fractionEighths: Number(body.fractionEighths) || null,
        returnedPence: Number.isFinite(Number(body.returnedPence)) ? Math.round(Number(body.returnedPence)) : null,
        deductionPence: Number.isFinite(Number(body.deductionPence)) ? Math.round(Number(body.deductionPence)) : null,
        commissionPct: Number.isFinite(Number(body.commissionPct)) ? Number(body.commissionPct) : null,
        enteredBy: 'you',
        note: str(body.note) || null,
      })));
    return ok({ state: out.value, replayed: out.replayed });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown';
    if (message === 'not_found') return fail(404, 'not_found', 'That bet is not in your ledger.');
    if (message === 'key_reused') {
      return fail(409, 'key_reused', 'That write key already belongs to a different operation, so nothing was written.');
    }
    return fail(500, 'write_failed', 'That failed and nothing was saved: the event and the recompute are in one transaction.');
  }
}
