import Link from 'next/link';
import { BetRow } from '@/components/app/BetRow';
import { Icon } from '@/components/Icon';
import { CheckResults } from './CheckResults';
import { money, pct } from '@/lib/format';
import type { Currency } from '@/lib/domain/types';
import type { DemoBet } from '@/lib/data/demo';
import type { Attention } from '@/lib/data/attention';
import { DEFAULT_TZ, type TimeZone } from '@/lib/format';

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
 *  THE SPLIT IS THE POINT, and it is a three way one. A bet whose event has
 *  not started, a bet playing right now, and a bet that finished hours ago
 *  and did not grade are three different facts: the first needs a Saturday,
 *  the second needs a football match, the third needs YOU. Listing them
 *  together as "open" buries the third in the other two, which is exactly how
 *  a bet goes unsettled for a week, and calling the first one Running is the
 *  page claiming something is happening when nothing is. */
export function RunningNow({
  att, today, currency, balancePence, tz = DEFAULT_TZ,
}: {
  att: Attention;
  today: DemoBet[];
  currency: Currency;
  balancePence: number;
  tz?: TimeZone;
}) {
  const open = att.openCount;
  if (open === 0 && today.length === 0) return null;

  const profitIfAll = att.toReturnPence - att.openStakePence;
  const shownRows = Math.min(att.waiting.length, 4) + Math.min(att.running.length, 4) + Math.min(att.resting.length, 4);
  const shareOfBalance = balancePence > 0 ? (att.openStakePence / balancePence) * 100 : 0;

  return (
    <section className="card runnow" aria-labelledby="runnow-t" style={{ marginBottom: 'var(--gap-block)' }}>
      <header className="card__head">
        <h2 className="card__title" id="runnow-t">Open bets</h2>
        <p className="card__note">Ignores the scope</p>
      </header>

      {open > 0 ? (
        /*  THE EXPOSURE BESIDE THE POSITIONS, ONCE THERE IS ROOM FOR BOTH.
            At 1920 this card is 1620 pixels wide and every open bet in it
            was a name against the left edge with its return against the
            right, thirteen hundred pixels away, which is the chat log shape
            the table below this card stopped using. A wide screen holds two
            things at once: what is at risk on the left, what it is riding on
            on the right, and no row wider than a row wants to be. Under
            1000 it is one column and the figures stay above the list, which
            is right on a phone. See .runnow__body. */
        <div className="runnow__body">
          {/*  AT RISK, before any individual bet. The three numbers somebody
               wants from a set of open positions are how much is on them,
               what that is as a share of the roll, and what comes back if
               they all land. Reading them off a list of bets is arithmetic
               the page should have done. */}
          <div className="risk">
            <div className="risk__fig">
              <p className="label">At risk</p>
              <p className="fig fig--m tnum">{money(att.openStakePence, currency)}</p>
              <p className="small dim">{pct(shareOfBalance)} of the balance</p>
            </div>
            <div className="risk__fig">
              {/*  "If they all land", not "Returns if every one lands": at
                   twenty five characters of tracked uppercase the label was
                   longer than the sentence under the figure, and the figure
                   is a return whatever the label calls it. */}
              <p className="label">If they all land</p>
              <p className="fig fig--m tnum">{money(att.toReturnPence, currency)}</p>
              <p className="small dim">{money(profitIfAll, currency, { sign: true })} profit</p>
            </div>
          </div>

          <div className="runnow__lists">
          {/*  Each group is one block, because from 1000 the three of them
               are three columns across the card rather than three stacks
               down the left of it. See .runnow__lists. */}
          {att.waiting.length > 0 ? (
            <div className="runnow__grp">
              {/*  Waiting first, because it is the half that needs a person.
                   Running is the half that needs a football match. */}
              <p className="label runnow__h">
                <Icon name="alert" size={14} className="runnow__hi" />
                Waiting on a result · {att.waiting.length}
              </p>
              <p className="small dim runnow__note">
                The event finished and the score has not settled these yet. Slippery asks
                rather than grading one wrong. Open one and record what happened, or have it
                look again.
              </p>
              {/*  The sweep had no caller. The product created this state,
                   named it, badged it and routed people to it, and the
                   destination offered nothing that could clear it. */}
              <CheckResults />
              <ul>
                {att.waiting.slice(0, 4).map((b) => <BetRow key={b.id} bet={b} currency={currency} tz={tz} />)}
              </ul>
            </div>
          ) : null}

          {att.running.length > 0 ? (
            <div className="runnow__grp">
              <p className="label runnow__h">Running · {att.running.length}</p>
              <ul>
                {att.running.slice(0, 4).map((b) => <BetRow key={b.id} bet={b} currency={currency} tz={tz} />)}
              </ul>
            </div>
          ) : null}

          {/*  Resting last, because it is the half of the exposure that is
               not a question about today. Money is committed to it and
               nothing is happening to it yet, which is a different fact from
               money on a match in the eightieth minute. */}
          {att.resting.length > 0 ? (
            <div className="runnow__grp">
              <p className="label runnow__h">Not started yet · {att.resting.length}</p>
              <ul>
                {att.resting.slice(0, 4).map((b) => <BetRow key={b.id} bet={b} currency={currency} tz={tz} />)}
              </ul>
            </div>
          ) : null}

          {/*  What is left over, counted rather than guessed at: the sum of
               what each list actually printed, so the sentence cannot promise
               a number the rows above it do not add up to. */}
          {open > shownRows ? (
            <p className="small dim runnow__more">
              and {open - shownRows} more, in the rows below.
            </p>
          ) : null}
          </div>
        </div>
      ) : (
        <p className="small dim">
          Nothing open. <Link href="/app/import">Forward a slip</Link> and it lands here.
        </p>
      )}

      {today.length > 0 ? (
        <>
          <p className="label runnow__h">Settled today · {today.length}</p>
          <ul>
            {today.slice(0, 4).map((b) => <BetRow key={b.id} bet={b} currency={currency} tz={tz} settling />)}
          </ul>
        </>
      ) : null}
    </section>
  );
}
