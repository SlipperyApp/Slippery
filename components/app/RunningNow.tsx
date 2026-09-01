import Link from 'next/link';
import { BetRow } from '@/components/app/BetRow';
import { Icon } from '@/components/Icon';
import { money, pct } from '@/lib/format';
import type { Currency } from '@/lib/domain/types';
import type { DemoBet } from '@/lib/data/demo';
import type { Attention } from '@/lib/data/attention';

/** Open positions, and what settled today, at the top of the ledger.
 *
 *  THIS WAS ON THE DASHBOARD, as a module beside the calendar, and it did
 *  not belong there. Everything else on that page describes the account:
 *  net, win rate, a month of daily totals, a curve, a breakdown by
 *  bookmaker. This names particular bets, at their prices, with their
 *  bookmakers and their kick off times, and every question it raises is
 *  answered on a different page. The dashboard is for statistics at a
 *  glance; a bet has a ledger.
 *
 *  IT IGNORES THE SCOPE, and says so. Filtering open positions by "this
 *  month" would hide a bet that is running right now because it was placed
 *  in August, which is not a filter anybody means.
 *
 *  THE SPLIT IS THE POINT. Bets still playing and bets that finished hours
 *  ago and did not grade are two different problems: the first needs a
 *  football match, the second needs you. Listing them together as "open"
 *  buries the second in the first, which is exactly how a bet goes
 *  unsettled for a week. */
export function RunningNow({
  att, today, currency, bankrollPence,
}: {
  att: Attention;
  today: DemoBet[];
  currency: Currency;
  bankrollPence: number;
}) {
  const open = att.running.length + att.waiting.length;
  if (open === 0 && today.length === 0) return null;

  const profitIfAll = att.toReturnPence - att.openStakePence;
  const shareOfRoll = bankrollPence > 0 ? (att.openStakePence / bankrollPence) * 100 : 0;

  return (
    <section className="card runnow" aria-labelledby="runnow-t" style={{ marginBottom: 'var(--gap-block)' }}>
      <header className="card__head">
        <h2 className="card__title" id="runnow-t">Open bets</h2>
        <p className="card__note">Ignores the scope</p>
      </header>

      {open > 0 ? (
        <>
          {/*  AT RISK, before any individual bet. The three numbers somebody
               wants from a set of open positions are how much is on them,
               what that is as a share of the roll, and what comes back if
               they all land. Reading them off a list of bets is arithmetic
               the page should have done. */}
          <div className="risk">
            <div className="risk__fig">
              <p className="label">At risk</p>
              <p className="fig fig--m tnum">{money(att.openStakePence, currency)}</p>
              <p className="small dim">{pct(shareOfRoll)} of the bankroll</p>
            </div>
            <div className="risk__fig">
              <p className="label">Returns if every one lands</p>
              <p className="fig fig--m tnum">{money(att.toReturnPence, currency)}</p>
              <p className="small dim">{money(profitIfAll, currency, { sign: true })} profit</p>
            </div>
          </div>

          {att.waiting.length > 0 ? (
            <>
              {/*  Waiting first, because it is the half that needs a person.
                   Running is the half that needs a football match. */}
              <p className="label runnow__h">
                <Icon name="alert" size={14} className="runnow__hi" />
                Waiting on a result · {att.waiting.length}
              </p>
              <p className="small dim runnow__note">
                The event finished and the score has not settled these yet. Slippery asks
                rather than grading one wrong.
              </p>
              <ul>
                {att.waiting.slice(0, 4).map((b) => <BetRow key={b.id} bet={b} currency={currency} />)}
              </ul>
            </>
          ) : null}

          {att.running.length > 0 ? (
            <>
              <p className="label runnow__h">Running · {att.running.length}</p>
              <ul>
                {att.running.slice(0, 5).map((b) => <BetRow key={b.id} bet={b} currency={currency} />)}
              </ul>
            </>
          ) : null}

          {open > 9 ? (
            <p className="small dim" style={{ marginTop: 'var(--s2)' }}>
              and {open - Math.min(open, 9)} more, in the rows below.
            </p>
          ) : null}
        </>
      ) : (
        <p className="small dim">
          Nothing open. <Link href="/app/import">Forward a slip</Link> and it lands here.
        </p>
      )}

      {today.length > 0 ? (
        <>
          <p className="label runnow__h">Settled today · {today.length}</p>
          <ul>
            {today.slice(0, 4).map((b) => <BetRow key={b.id} bet={b} currency={currency} settling />)}
          </ul>
        </>
      ) : null}
    </section>
  );
}
