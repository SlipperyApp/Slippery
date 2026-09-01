import Link from 'next/link';
import { BetRow } from '@/components/app/BetRow';
import { Icon } from '@/components/Icon';
import { money } from '@/lib/format';
import type { Currency } from '@/lib/domain/types';
import type { DemoBet } from '@/lib/data/demo';

/** Open positions, and what settled today, at the top of the ledger.
 *
 *  THIS WAS ON THE DASHBOARD, as a module beside the calendar, and it did
 *  not belong there. Everything else on that page describes the account:
 *  net, win rate, a month of daily totals, a curve, a breakdown by
 *  bookmaker. This names two particular bets, at their prices, with their
 *  bookmakers and their kick off times, and every question it raises is
 *  answered on a different page. The dashboard is for statistics at a
 *  glance; a bet has a ledger.
 *
 *  It goes ABOVE the rows rather than into them. The rows are sorted by
 *  event time and a running bet is only findable in them by knowing which
 *  one it is; the point of this strip is that you do not have to.
 *
 *  IT IGNORES THE SCOPE, and says so. Filtering open positions by "this
 *  month" would hide a bet that is running right now because it was placed
 *  in August, which is not a filter anybody means. */
export function RunningNow({
  running, today, openStakePence, currency,
}: {
  running: DemoBet[];
  today: DemoBet[];
  openStakePence: number;
  currency: Currency;
}) {
  if (running.length === 0 && today.length === 0) return null;

  return (
    <section className="card runnow" aria-labelledby="runnow-t" style={{ marginBottom: 'var(--s4)' }}>
      <header className="card__head">
        <h2 className="card__title" id="runnow-t">Running now</h2>
        <p className="card__note">Ignores the scope</p>
      </header>

      {running.length > 0 ? (
        <>
          <p className="label" style={{ marginBottom: 'var(--s1)' }}>
            {running.length} open · {money(openStakePence, currency)} exposure
          </p>
          <ul>
            {running.slice(0, 6).map((b) => <BetRow key={b.id} bet={b} currency={currency} />)}
          </ul>
          {running.length > 6 ? (
            <p className="small dim" style={{ marginTop: 'var(--s2)' }}>
              and {running.length - 6} more, in the rows below.
            </p>
          ) : null}
        </>
      ) : (
        <p className="small dim">
          Nothing running. <Link href="/app/import">Forward a slip</Link> and it lands here.
        </p>
      )}

      {today.length > 0 ? (
        <>
          <p className="label" style={{ marginTop: 'var(--s4)', marginBottom: 'var(--s1)' }}>Settled today</p>
          <ul>
            {today.slice(0, 4).map((b) => <BetRow key={b.id} bet={b} currency={currency} settling />)}
          </ul>
        </>
      ) : null}

      <p className="card__foot small dim">
        <Icon name="clock" size={14} style={{ verticalAlign: '-2px', marginRight: 'var(--s1h)' }} />
        Ninety minute scores only. Anything uncertain asks you rather than grading it wrong.
      </p>
    </section>
  );
}
