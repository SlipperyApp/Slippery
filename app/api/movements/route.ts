import { hasDatabase, transaction } from '@/lib/server/db';
import { currentAccount } from '@/lib/server/auth';
import { fail, limitOr429, ok, readJson, str } from '@/lib/server/respond';
import { parseMoneyMinor } from '@/lib/format';
import { ALL_BOOKMAKERS } from '@/lib/data/reference';
import { ensureBalance } from '@/lib/server/balances';
import { openBalanceId } from '@/lib/data/session';

export const runtime = 'nodejs';

/** Record money in or money out.
 *
 *  IT WRITES TO ITS OWN TABLE AND TOUCHES NOTHING ELSE. There is no bet to
 *  fold, no settlement event to append and no bet_state to recompute, which
 *  is the point of the separation: a deposit must never be able to reach a
 *  figure derived from bets. If this route ever grows a line that updates one,
 *  that is the defect.
 *
 *  The amount is parsed through parseMoneyMinor, the same reader the slip and
 *  the manual entry use, so "1,234.50" and "£1234.5" mean the same thing here
 *  as they do everywhere else and a three decimal amount is refused rather
 *  than rounded into somebody's balance. */
export async function POST(req: Request) {
  const limited = limitOr429(req, 'movements', 40, 300);
  if (limited) return limited;

  const body = await readJson(req);

  const kind = str(body.kind);
  if (kind !== 'deposit' && kind !== 'withdrawal') {
    return fail(400, 'bad_kind', 'A movement is a deposit or a withdrawal. Nothing was written.');
  }

  /*  The direction is the kind, never the sign. A minus in the box is a
   *  question about what somebody meant, so it is refused rather than read as
   *  a withdrawal typed into a deposit. */
  const parsed = parseMoneyMinor(str(body.amount));
  if (!parsed || parsed.minor <= 0) {
    return fail(400, 'bad_amount',
      'That is not an amount. Type it the way it appears on your statement, with no minus in front. Nothing was written.');
  }

  const bookmakerId = str(body.bookmaker);
  if (bookmakerId && !ALL_BOOKMAKERS.some((b) => b.id === bookmakerId)) {
    return fail(400, 'bad_bookmaker', 'That is not a bookmaker on your list. Nothing was written.');
  }

  const occurredAt = str(body.occurredAt);
  const at = occurredAt && Number.isFinite(Date.parse(occurredAt))
    ? new Date(occurredAt).toISOString()
    : new Date().toISOString();

  if (!hasDatabase()) {
    return fail(503, 'no_store',
      'This deployment has no database, so nothing was written. Everything you typed is still on screen.');
  }
  const account = await currentAccount();
  if (!account) {
    return fail(401, 'no_session',
      'You are looking at the example account, so nothing was written. Start your own and this writes to it.');
  }

  /*  The currency is THE BALANCE'S, never one supplied by the caller and no
   *  longer the account's. Pounds and euros are never summed, and money paid
   *  into the euro account is not money in the sterling one: filing it
   *  against the wrong balance would be a wrong figure on two screens at
   *  once. The balance also decides which books the money lands in, and it
   *  is the one the person has open rather than one the request named.
   *
   *  Both statements run in one transaction because the balance may have to
   *  be created first: money_movements.balance_id is not null, and an account
   *  that signed up after migration 0011 had no balance at all, so a deposit
   *  on a new account failed on the constraint. */
  const open = await openBalanceId();
  const id = `mv_${crypto.randomUUID()}`;

  const bal = await transaction(async (client) => {
    const b = await ensureBalance(client, account.id, open);
    await client.query(
      `insert into money_movements (id, account_id, balance_id, kind, amount_pence, currency, bookmaker_id, occurred_at, note)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [id, account.id, b?.id ?? null, kind, parsed.minor, b?.currency ?? 'GBP', bookmakerId || null, at, str(body.note) || null],
    );
    return b;
  }).catch(() => null);

  if (!bal) {
    return fail(500, 'write_failed',
      'That failed and nothing was saved. The movement and the balance it belongs to are written together.');
  }

  return ok({
    id, kind, amountMinor: parsed.minor, currency: bal.currency,
    balanceId: bal.id, balanceName: bal.name, occurredAt: at,
    message: `Recorded in ${bal.name}.`,
  });
}
