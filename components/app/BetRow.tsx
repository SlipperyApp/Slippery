import Link from 'next/link';
import { SETTLE_GRACE_MS } from '@/lib/data/attention';
import { Icon } from '@/components/Icon';
import { effectiveOdds } from '@/lib/domain/fold';
import { formatOdds, type OddsFormat } from '@/lib/odds';
import { dateTime, money, shortDate, timeOfDay, units as fmtUnits } from '@/lib/format';
import { bookmakerName } from '@/lib/data/reference';
import type { DemoBet } from '@/lib/data/demo';
import type { Currency, Outcome } from '@/lib/domain/types';

const OUTCOME_LABEL: Record<Outcome, string> = {
  won: 'Won',
  lost: 'Lost',
  'cash-profit': 'Cashed out, ahead',
  'cash-loss': 'Cashed out, behind',
  'cash-flat': 'Cashed out, flat',
  void: 'Void',
};

/*  An open bet is not one state, it is two, and the pill has to agree with
 *  the heading it sits under. Listed under "Waiting on a result" a bet that
 *  says RUNNING contradicts the line above it, and the reader has to decide
 *  which of the two the page means. The split is the one in
 *  lib/data/attention.ts, computed the same way from the same constant, so
 *  the pill, the heading and the sidebar count can never disagree.
 *
 *  The dot only pulses on a bet that is genuinely in play. A pulse on a bet
 *  that finished four hours ago is the page insisting something is
 *  happening when nothing is. */
export function OutcomePill({ bet, now = new Date() }: { bet: DemoBet; now?: Date }) {
  if (bet.state.status === 'open') {
    const live = new Date(bet.eventAt).getTime() > now.getTime() - SETTLE_GRACE_MS;
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
  const cls = o === 'won' || o === 'cash-profit' ? 'pill pill--pos'
    : o === 'lost' || o === 'cash-loss' ? 'pill pill--neg' : 'pill';
  return <span className={cls}>{OUTCOME_LABEL[o]}</span>;
}

export function BetRow({
  bet, currency = 'GBP', oddsFormat = 'decimal', showUnits = false, settling = false,
}: {
  bet: DemoBet;
  currency?: Currency;
  oddsFormat?: OddsFormat;
  showUnits?: boolean;
  settling?: boolean;
}) {
  const s = bet.state;
  const open = s.status === 'open';
  const tone = s.realisedPlPence > 0 ? 'pos' : s.realisedPlPence < 0 ? 'neg' : '';
  const legs = bet.legs.length;
  const tags = [
    bet.isFreeBet ? 'Free bet' : null,
    bet.isBoosted ? 'Boosted' : null,
    bet.side === 'lay' ? 'Lay' : null,
    bet.slipBacked ? null : 'Typed in',
  ].filter(Boolean) as string[];

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
          {legs > 1 ? bet.legs.map((l) => l.selection).join(' / ') : `${bet.eventName} · ${bet.marketRaw}`}
        </p>
        {/*  The modifiers used to be four more pills on the row above. Five
             coloured boxes on every row of a thirty row list is the noisiest
             thing on the page, and none of them is the thing you scan for.
             They are facts, so they sit on the line of facts. */}
        <p className="brow__sub mono" style={{ marginTop: 2 }}>
          {money(bet.side === 'lay' ? (bet.liabilityPence ?? 0) : bet.stakePence, currency)} at{' '}
          {formatOdds(effectiveOdds(bet), oddsFormat)} · {bookmakerName(bet.bookmakerId)}
          {tags.map((t) => <span key={t}> · {t}</span>)} · {shortDate(bet.eventAt)}{' '}
          {timeOfDay(bet.eventAt)}
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

export function BetLine({ bet, currency = 'GBP' }: { bet: DemoBet; currency?: Currency }) {
  const s = bet.state;
  return (
    <li className="brow">
      <div style={{ minWidth: 0 }}>
        <p className="brow__title" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {bet.legs.length > 1 ? `${bet.legs.length} fold` : bet.selection}
        </p>
        <p className="brow__sub">{dateTime(bet.eventAt)}</p>
      </div>
      <span className={`fig fig--s tnum ${s.realisedPlPence > 0 ? 'pos' : s.realisedPlPence < 0 ? 'neg' : ''}`}>
        {s.status === 'open' ? '–' : money(s.realisedPlPence, currency, { sign: true })}
      </span>
    </li>
  );
}

export function EmptyState({
  title, action, href, ghost,
}: {
  title: string;
  action: string;
  href: string;
  ghost: React.ReactNode;
}) {
  return (
    <div className="empty grow" style={{ minHeight: 180 }}>
      <div className="empty__ghost" aria-hidden="true">{ghost}</div>
      <div className="empty__over">
        <p className="card__title">{title}</p>
        <Link href={href} className="btn btn--primary btn--sm">
          <Icon name="plus" size={16} />
          {action}
        </Link>
      </div>
    </div>
  );
}
