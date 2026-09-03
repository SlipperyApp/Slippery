import { hasDatabase, query } from '@/lib/server/db';
import { currentAccount } from '@/lib/server/auth';
import { fail, limitOr429, ok, readJson, str } from '@/lib/server/respond';
import { isKnownTimeZone } from '@/lib/format';
import { NOTIFICATIONS, SHARING_SWITCHES, isSwitch } from '@/lib/data/settings';

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

  /*  A zone the runtime cannot resolve throws inside Intl on every date on
      the page, so it is refused here rather than stored and discovered by a
      calendar that will not render. */
  const timeZone = str(body.timeZone);
  if (timeZone && isKnownTimeZone(timeZone)) push('time_zone', timeZone);

  if (typeof body.calendarDates === 'boolean') push('calendar_dates', body.calendarDates);
  /*  There was a `break` branch here writing break_until. The control it
      served is gone on the owner's instruction, so the branch is gone with
      it: a route that still accepts a field no screen can send is a way to
      put an account into a state nothing can show or clear. The column stays
      in the schema, because migrations here are forward only and dropping a
      column is not the same as removing a control. See DECISIONS.md. */

  const startBalance = Number(body.balanceStartPence);
  if (Number.isFinite(startBalance) && startBalance >= 0) push('balance_start_pence', Math.round(startBalance));

  /*  THE SWITCHES THAT SAVED NOTHING.
   *
   *  The seven notification toggles posted no request at all and the four
   *  sharing ones posted { sharing, on } to a route that read neither field
   *  and answered changed: 0. Both panes are about who can see you and what
   *  is sent to you, which is the worst place in a product for a control that
   *  only relabels itself.
   *
   *  The id is checked against the list it belongs to before it is written,
   *  so a client cannot put an arbitrary key into the column, and jsonb_set
   *  merges rather than replacing, so two switches thrown at once cannot
   *  clobber each other. */
  const notification = str(body.notification);
  if (notification && isSwitch(NOTIFICATIONS, notification) && typeof body.on === 'boolean') {
    /*  Billing notices are locked on: an account that cannot be told its card
        failed is an account that goes read only without warning. The switch
        is disabled in the pane and refused here too, because a disabled
        attribute is a promise to a mouse and not to a request. */
    const locked = NOTIFICATIONS.find((n) => n.id === notification)?.locked;
    if (!locked) {
      await query(
        `update accounts set notifications = jsonb_set(coalesce(notifications, '{}'::jsonb), $2, $3::jsonb, true),
                             updated_at = now()
          where id = $1`,
        [account.id, `{${notification}}`, JSON.stringify(body.on)],
      );
      return ok({ changed: 1, notification, on: body.on });
    }
    return fail(400, 'locked', 'Billing notices stay on. An account cannot be allowed to go read only without warning.');
  }

  const sharingId = str(body.sharing);
  if (sharingId && isSwitch(SHARING_SWITCHES, sharingId) && typeof body.on === 'boolean') {
    await query(
      `update accounts set sharing = jsonb_set(coalesce(sharing, '{}'::jsonb), $2, $3::jsonb, true),
                           updated_at = now()
        where id = $1`,
      [account.id, `{${sharingId}}`, JSON.stringify(body.on)],
    );
    return ok({ changed: 1, sharing: sharingId, on: body.on });
  }

  if (body.purgeImages === true) {
    /*  The bytes as well as the flag. This cleared a storage_key and left the
        image in place, which was harmless only for as long as no image was
        ever stored. */
    await query(
      `update slip_images set deleted_at = now(), storage_key = '', data = null
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
