import { hasDatabase, transaction } from '@/lib/server/db';
import { currentAccount } from '@/lib/server/auth';
import { fail, limitOr429, ok, readJson, str } from '@/lib/server/respond';
import { appendEvent } from '@/lib/server/bets';

export const runtime = 'nodejs';

const ALLOWED = new Set([
  'won', 'lost', 'void', 'placed', 'push', 'half_won', 'half_lost',
  'cash_out_partial', 'cash_out_full',
  'rule4', 'commission', 'promo_refund', 'manual_correction',
]);

/** The ONLY path that appends a settlement event.
 *
 *  The event and the bet_state recompute happen inside one transaction, so
 *  bet_state can never lag the ledger it folds and a failed request writes
 *  nothing at all. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const limited = limitOr429(req, 'events', 60, 300);
  if (limited) return limited;

  const { id } = await ctx.params;
  const body = await readJson(req);
  const type = str(body.type);

  if (!ALLOWED.has(type)) return fail(400, 'bad_type', 'That is not a settlement event this product knows about.');

  if (!hasDatabase()) {
    return fail(503, 'no_store', 'This deployment has no database, so nothing was written. The figures above were computed by the same fold that would have written them.');
  }
  const account = await currentAccount();
  if (!account) {
    return fail(401, 'no_session', 'You are looking at the example account, so nothing was written. The figures above are real: they come from the same fold your own ledger would use.');
  }

  try {
    const state = await transaction((client) => appendEvent(client, {
      accountId: account.id,
      betId: id,
      type: type as Parameters<typeof appendEvent>[1]['type'],
      fractionEighths: Number(body.fractionEighths) || null,
      returnedPence: Number.isFinite(Number(body.returnedPence)) ? Math.round(Number(body.returnedPence)) : null,
      deductionPence: Number.isFinite(Number(body.deductionPence)) ? Math.round(Number(body.deductionPence)) : null,
      commissionPct: Number.isFinite(Number(body.commissionPct)) ? Number(body.commissionPct) : null,
      enteredBy: 'you',
      note: str(body.note) || null,
    }));
    return ok({ state });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown';
    if (message === 'not_found') return fail(404, 'not_found', 'That bet is not in your ledger.');
    return fail(500, 'write_failed', 'That failed and nothing was saved: the event and the recompute are in one transaction.');
  }
}
