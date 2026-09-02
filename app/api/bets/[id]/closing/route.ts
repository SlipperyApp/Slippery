import { hasDatabase, query } from '@/lib/server/db';
import { currentAccount } from '@/lib/server/auth';
import { fail, limitOr429, ok, readJson, str } from '@/lib/server/respond';
import { isPrice } from '@/lib/domain/closing';

export const runtime = 'nodejs';

/** Record the closing price on a bet, or clear it.
 *
 *  IT IS NOT A SETTLEMENT EVENT AND IT DOES NOT GO NEAR THE FOLD. A closing
 *  price moves no money: it changes no stake, no return, no profit and no
 *  outcome, so there is nothing for lib/domain/fold.ts to recompute and
 *  nothing for it to write. Appending it to settlement_events would put a row
 *  in an append only ledger of money movements that moved no money, and
 *  bet_state would be recomputed for a column it does not read.
 *
 *  It is a column on the bet, written here, and this is the only route that
 *  writes it.
 *
 *  A CLEAR IS A NULL, NOT A ZERO. Sending nothing sets the column back to
 *  null, which means nobody has recorded a closing price, and every figure
 *  downstream leaves that bet out rather than counting it as level. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const limited = limitOr429(req, 'closing', 60, 300);
  if (limited) return limited;

  const { id } = await ctx.params;
  const body = await readJson(req);
  const raw = str(body.closingOdds).trim();

  /*  An empty box clears it. Anything else has to be a price somebody could
      have taken: a 0 divides into the price taken and puts an infinity on
      the dashboard, and "evens" typed as 1 is the same division. */
  let closing: number | null = null;
  if (raw !== '') {
    const n = Number(raw);
    if (!isPrice(n)) {
      return fail(400, 'bad_price',
        'A closing price is a decimal price above 1.00, the way the market settled. Leave it empty if you do not know it: a guessed one is worse than none. Nothing was written.');
    }
    /*  Four places, matching the odds column beside it. Comparing a price
        stored to four places with one stored to two makes an identical pair
        differ, and the difference gets printed as beating the market. */
    closing = Number(n.toFixed(4));
  }

  if (!hasDatabase()) {
    return fail(503, 'no_store',
      'This deployment has no database, so nothing was written. The figure on screen is what would have been stored.');
  }
  const account = await currentAccount();
  if (!account) {
    return fail(401, 'no_session',
      'You are looking at the example account, so nothing was written. Start your own and this writes to it.');
  }

  const rows = await query<{ id: string }>(
    'update bets set closing_odds = $1, updated_at = now() where id = $2 and account_id = $3 returning id',
    [closing, id, account.id],
  ).catch(() => [] as { id: string }[]);

  if (!rows.length) return fail(404, 'not_found', 'That bet is not in your ledger.');
  return ok({ id, closingOdds: closing });
}
