import { hasDatabase, query } from '@/lib/server/db';
import { currentAccount } from '@/lib/server/auth';
import { fail, limitOr429, ok, readJson, str } from '@/lib/server/respond';

export const runtime = 'nodejs';

const ODDS = new Set(['decimal', 'fractional', 'american']);
const PROFIT = new Set(['currency', 'units', 'both']);

/** Settings that genuinely change what is displayed. A preference nothing
 *  reads is a dead control with a switch on it. */
export async function POST(req: Request) {
  const limited = limitOr429(req, 'settings', 60, 300);
  if (limited) return limited;

  const body = await readJson(req);
  if (!hasDatabase()) {
    return fail(503, 'no_store', 'This deployment has no database, so the change applies on this page only.');
  }
  const account = await currentAccount();
  if (!account) {
    return fail(401, 'no_session', 'You are looking at the example account, so the change applies on this page only.');
  }

  const sets: string[] = [];
  const args: unknown[] = [];
  const push = (col: string, v: unknown) => { args.push(v); sets.push(`${col} = $${args.length}`); };

  const unit = Number(body.unitPence);
  if (Number.isFinite(unit) && unit >= 10) push('unit_pence', Math.round(unit));

  const currency = str(body.currency).toUpperCase();
  if (currency === 'GBP' || currency === 'EUR') push('currency', currency);

  const oddsFormat = str(body.oddsFormat);
  if (ODDS.has(oddsFormat)) push('odds_format', oddsFormat);

  const showProfitIn = str(body.showProfitIn);
  if (PROFIT.has(showProfitIn)) push('show_profit_in', showProfitIn);

  if (body.weekStart === 0 || body.weekStart === 1) push('week_start', body.weekStart);
  if (typeof body.calendarDates === 'boolean') push('calendar_dates', body.calendarDates);
  if (typeof body.break === 'boolean') {
    push('break_until', body.break ? new Date(Date.now() + 30 * 86400000).toISOString() : null);
  }

  const bankroll = Number(body.bankrollStartPence);
  if (Number.isFinite(bankroll) && bankroll >= 0) push('bankroll_start_pence', Math.round(bankroll));

  if (body.purgeImages === true) {
    await query(
      `update slip_images set deleted_at = now(), storage_key = ''
        where account_id = $1 and deleted_at is null`,
      [account.id],
    ).catch(() => null);
  }

  if (body.reset === true) {
    // Deletes bets, keeps the account. Offered with an export first, and it
    // needs the word typed out on the way in.
    await query('delete from bets where account_id = $1', [account.id]).catch(() => null);
    await query('delete from pl_entries where account_id = $1', [account.id]).catch(() => null);
  }

  if (body.deleteAccount === true) {
    await query('delete from accounts where id = $1', [account.id]).catch(() => null);
    return ok({ deleted: true });
  }

  if (sets.length) {
    args.push(account.id);
    await query(`update accounts set ${sets.join(', ')}, updated_at = now() where id = $${args.length}`, args);
  }

  return ok({ changed: sets.length });
}
