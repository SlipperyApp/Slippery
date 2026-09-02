import Link from 'next/link';
import { SETTLE_GRACE_MS } from '@/lib/data/attention';
import { Icon } from '@/components/Icon';
import { effectiveOdds } from '@/lib/domain/fold';
import { betTags, legLine } from '@/lib/domain/working';
import { formatOdds, type OddsFormat } from '@/lib/odds';
import { dateTime, money, shortDate, timeOfDay, units as fmtUnits, DEFAULT_TZ, type TimeZone } from '@/lib/format';
import { bookmakerName } from '@/lib/data/reference';
import type { DemoBet } from '@/lib/data/demo';
import type { Currency, Outcome } from '@/lib/domain/types';

const OUTCOME_LABEL: Record<Outcome, string> = {
  won: 'Won',
  lost: 'Lost',
  placed: 'Placed',
  'cash-profit': 'Cashed out, ahead',
  'cash-loss': 'Cashed out, behind',
  'cash-flat': 'Cashed out, flat',
  void: 'Void',
};

/*  An open bet is not one state, it is THREE, and the pill has to agree with
 *  the heading it sits under. Listed under "Waiting on a result" a bet that
 *  says RUNNING contradicts the line above it, and the reader has to decide
 *  which of the two the page means. The split is the one in
 *  lib/data/attention.ts, computed the same way from the same constant, so
 *  the pill, the heading and the sidebar count can never disagree.
 *
 *  RESTING IS THE ONE THAT WAS MISSING. A slip forwarded on Thursday for a
 *  Saturday lunchtime kick off said RUNNING for two days, with a pulsing dot
 *  beside it, on a page whose whole claim is that it tells you what is
 *  actually happening. Nothing was running. The match had not begun.
 *
 *  The dot only pulses on a bet that is genuinely in play. A pulse on a bet
 *  that finished four hours ago, or on one whose event is the day after
 *  tomorrow, is the page insisting something is happening when nothing is. */
export function OutcomePill({ bet, now = new Date() }: { bet: DemoBet; now?: Date }) {
  if (bet.state.status === 'open') {
    const at = new Date(bet.eventAt).getTime();
    if (at > now.getTime()) {
      return (
        <span className="pill">
          <span className="dot" style={{ background: 'var(--ink-3)' }} />
          Resting
        </span>
      );
    }
    const live = at > now.getTime() - SETTLE_GRACE_MS;
    return live ? (
      <span className="pill">
        <span className="dot live-dot" style={{ background: 'var(--accent)' }} />
        Running
      </span>
    ) : (
      <span className="pill pill--warn">
        <span className="dot" style={{ background: 'var(--warn)' }} />
        Waiting
      </span>
    );
  }
  const o = bet.state.outcome;
  if (!o) return <span className="pill">Part settled</span>;
  /*  Placed takes the plain pill and neither colour. Its money lands either
   *  side of zero depending on the place terms, and the figure on the right
   *  of the row already carries the profit green or the loss red for it. A
   *  green pill on a place that cost £4 would be the row arguing with
   *  itself. */
  const cls = o === 'won' || o === 'cash-profit' ? 'pill pill--pos'
    : o === 'lost' || o === 'cash-loss' ? 'pill pill--neg' : 'pill';
  return <span className={cls}>{OUTCOME_LABEL[o]}</span>;
}

export function BetRow({
  bet, currency = 'GBP', oddsFormat = 'decimal', showUnits = false, settling = false,
  tz = DEFAULT_TZ,
}: {
  bet: DemoBet;
  currency?: Currency;
  oddsFormat?: OddsFormat;
  showUnits?: boolean;
  settling?: boolean;
  /** The account's zone. The kick off time on this row has to read as the
   *  same day the calendar filed the bet under. */
  tz?: TimeZone;
}) {
  const s = bet.state;
  const open = s.status === 'open';
  const tone = s.realisedPlPence > 0 ? 'pos' : s.realisedPlPence < 0 ? 'neg' : '';
  const legs = bet.legs.length;
  /*  One list, shared with the export's tags column. It was written out here
      and again there, and two lists of the same facts drift: the export
      would have described a bet the row above it does not. */
  const tags = betTags(bet);

  return (
    <li className={`brow${settling ? ' is-settling' : ''}`} style={{ gridTemplateColumns: 'minmax(0,1fr) auto', alignItems: 'start' }}>
      <div style={{ minWidth: 0 }}>
        <div className="row" style={{ gap: 'var(--s2)', marginBottom: 3 }}>
          <OutcomePill bet={bet} />
        </div>
        <p className="brow__title" style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {legs > 1 ? `${legs} fold` : bet.selection}
        </p>
        <p className="brow__sub" style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {legs > 1 ? legLine(bet.legs) : `${bet.eventName} · ${bet.marketRaw}`}
        </p>
        {/*  The modifiers used to be four more pills on the row above. Five
             coloured boxes on every row of a thirty row list is the noisiest
             thing on the page, and none of them is the thing you scan for.
             They are facts, so they sit on the line of facts. */}
        <p className="brow__sub mono" style={{ marginTop: 2 }}>
          {money(bet.side === 'lay' ? (bet.liabilityPence ?? 0) : bet.stakePence, currency)} at{' '}
          {formatOdds(effectiveOdds(bet), oddsFormat)} · {bookmakerName(bet.bookmakerId)}
          {tags.map((t) => <span key={t}> · {t}</span>)} · {shortDate(bet.eventAt, new Date(), tz)}{' '}
          {timeOfDay(bet.eventAt, tz)}
        </p>
      </div>
      <div style={{ textAlign: 'right' }}>
        {open ? (
          <>
            <p className="fig fig--s dim tnum">
              {money(Math.round(bet.stakePence * effectiveOdds(bet)), currency)}
            </p>
            <p className="small dim">to return</p>
          </>
        ) : (
          <>
            <p className={`fig fig--s tnum ${tone}`}>
              {showUnits ? fmtUnits(s.units, { sign: true }) : money(s.realisedPlPence, currency, { sign: true })}
            </p>
            <p className="small dim tnum">{money(s.returnedPence, currency)} back</p>
          </>
        )}
      </div>
    </li>
  );
}

export function BetLine({ bet, currency = 'GBP', tz = DEFAULT_TZ }: { bet: DemoBet; currency?: Currency; tz?: TimeZone }) {
  const s = bet.state;
  return (
    <li className="brow">
      <div style={{ minWidth: 0 }}>
        <p className="brow__title" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {bet.legs.length > 1 ? `${bet.legs.length} fold` : bet.selection}
        </p>
        <p className="brow__sub">{dateTime(bet.eventAt, new Date(), tz)}</p>
      </div>
      <span className={`fig fig--s tnum ${s.realisedPlPence > 0 ? 'pos' : s.realisedPlPence < 0 ? 'neg' : ''}`}>
        {s.status === 'open' ? '–' : money(s.realisedPlPence, currency, { sign: true })}
      </span>
    </li>
  );
}

/*  An empty state with a SECOND action, because one of these had exactly
 *  the wrong single action: "A group takes about a minute to start" over a
 *  button that went to Discover. Somebody with no group cannot use
 *  discovery, and the sentence promised the thing the button did not do.
 *
 *  `note` exists for the other half of that defect. Every one of these draws
 *  a ghost of populated example rows behind the copy, and a zero state
 *  showing four people with figures beside a heading that says you have
 *  nobody is two halves of a screen disagreeing. The note says the rows are
 *  an example. */
export function EmptyState({
  title, action, href, ghost, secondary, note,
}: {
  title: string;
  action: string;
  href: string;
  ghost: React.ReactNode;
  secondary?: { label: string; href: string };
  note?: string;
}) {
  return (
    <div className="empty grow" style={{ minHeight: 180 }}>
      <div className="empty__ghost" aria-hidden="true">{ghost}</div>
      <div className="empty__over">
        <p className="card__title">{title}</p>
        <div className="row" style={{ gap: 'var(--s2)', flexWrap: 'wrap', justifyContent: 'center' }}>
          <Link href={href} className="btn btn--primary btn--sm">
            <Icon name="plus" size={16} />
            {action}
          </Link>
          {secondary ? (
            <Link href={secondary.href} className="btn btn--quiet btn--sm">{secondary.label}</Link>
          ) : null}
        </div>
        {note ? <p className="small dim empty__note">{note}</p> : null}
      </div>
    </div>
  );
}
