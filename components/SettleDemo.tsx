'use client';

import { useEffect, useRef, useState } from 'react';
import { Icon } from '@/components/Icon';
import { money, pl, plClass, spell } from '@/lib/format';
import { CountUp } from '@/components/app/CountUp';

/** Six settlement outcomes, one bet each, resolving a leg at a time.
 *
 *  Not a video and not a screenshot. The old build shipped 48 video elements,
 *  all with controls and none autoplaying. This is state driven, clickable
 *  dots to step through them, and it collapses to its final frame under
 *  prefers-reduced-motion.
 *
 *  A BET PER OUTCOME, NOT ONE BET SIX WAYS. Every outcome used to run through
 *  the same £25.00 treble, so a void was a treble with a leg out and a cash
 *  out was a treble somebody pulled, and none of the six looked like a bet
 *  anybody in the UK or Ireland places. Six bets now: an each way at
 *  Cheltenham, a bet365 acca, a Champions League single, a horse at
 *  Fairyhouse, a Saturday treble and a postponed League of Ireland fixture.
 *
 *  A LEG CAN END OPEN. On a cash out the bet is settled and the market never
 *  graded, so the row it was on stays on the clock. Drawing it as void would
 *  be the product claiming a stake came back that did not. */

type LegResult = 'won' | 'lost' | 'void' | 'open';
type Outcome = {
  key: string;
  label: string;
  /** The slip itself: what was placed, where, and at what. */
  type: string;
  bookmaker: string;
  stakeMinor: number;
  price: string;
  legs: { selection: string; fixture: string; odds: string; result: LegResult }[];
  verdict: string;
  /** Realised profit or loss in pence, against this bet's own stake. */
  plMinor: number;
  returnedMinor: number;
  note: string;
};

const OUTCOMES: Outcome[] = [
  {
    key: 'won', label: 'Won',
    type: 'Each way', bookmaker: 'William Hill', stakeMinor: 2000, price: '5.00',
    legs: [
      { selection: 'Win part', fixture: 'Winter Hymn, 15:30 Cheltenham', odds: '5.00', result: 'won' },
      { selection: 'Place part', fixture: 'A fifth the odds, four places', odds: '1.80', result: 'won' },
    ],
    verdict: 'Won, both parts', plMinor: 4800, returnedMinor: 6800,
    note: 'An each way is two bets on one line, £10.00 a part, and the parts settle on their own.',
  },
  {
    key: 'lost', label: 'Lost',
    type: 'Four fold', bookmaker: 'bet365', stakeMinor: 1000, price: '14.62',
    legs: [
      { selection: 'Arsenal to win', fixture: 'Arsenal v Brentford', odds: '1.53', result: 'won' },
      { selection: 'Over 2.5 goals', fixture: 'Napoli v Roma', odds: '1.95', result: 'won' },
      { selection: 'Celtic to win', fixture: 'Celtic v Hibernian', odds: '1.40', result: 'won' },
      { selection: 'Leeds to win', fixture: 'Leeds v Everton', odds: '3.50', result: 'lost' },
    ],
    verdict: 'Lost', plMinor: -1000, returnedMinor: 0,
    note: 'Three landed and the fourth did not. The record keeps all four, which is the point of capturing at placement.',
  },
  {
    key: 'cash-profit', label: 'Cashed out ahead',
    type: 'Single', bookmaker: 'Paddy Power', stakeMinor: 2500, price: '2.10',
    legs: [
      { selection: 'Over 2.5 goals', fixture: 'Inter v Arsenal, Champions League', odds: '2.10', result: 'open' },
    ],
    verdict: 'Cash out, in profit', plMinor: 1360, returnedMinor: 3860,
    note: 'Pulled at 2-0 in the 54th minute. A cash out cannot be read off a results feed, so it is always your action.',
  },
  {
    key: 'cash-loss', label: 'Cashed out behind',
    type: 'Single', bookmaker: 'BoyleSports', stakeMinor: 2000, price: '5.50',
    legs: [
      { selection: 'Ardglass Lad', fixture: '15:40 Fairyhouse, win only', odds: '5.50', result: 'open' },
    ],
    verdict: 'Cash out, at a loss', plMinor: -860, returnedMinor: 1140,
    note: 'Taken the morning of the race for £11.40 of a £20.00 stake. It still counts and it still shows.',
  },
  {
    key: 'cash-flat', label: 'Cashed out flat',
    type: 'Treble', bookmaker: 'Sky Bet', stakeMinor: 1500, price: '6.20',
    legs: [
      { selection: 'Brighton to win', fixture: 'Brighton v Fulham', odds: '1.80', result: 'won' },
      { selection: 'Both teams to score', fixture: 'Villa v Newcastle', odds: '1.72', result: 'open' },
      { selection: 'Over 2.5 goals', fixture: 'Bayern v Leipzig', odds: '2.00', result: 'open' },
    ],
    verdict: 'Cash out, flat', plMinor: 0, returnedMinor: 1500,
    note: 'Pulled for the stake exactly, one leg in. A flat result is a result, not a gap in the record.',
  },
  {
    key: 'void', label: 'Void',
    type: 'Single', bookmaker: 'Coral', stakeMinor: 2000, price: '2.40',
    legs: [
      { selection: 'Shelbourne to win', fixture: 'Shelbourne v Bohemians', odds: '2.40', result: 'void' },
    ],
    verdict: 'Void', plMinor: 0, returnedMinor: 2000,
    note: 'The fixture was postponed, so the stake comes back and the profit is zero.',
  },
];

export function SettleDemo() {
  const [pick, setPick] = useState(0);
  const [step, setStep] = useState(OUTCOMES[0].legs.length);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const outcome = OUTCOMES[pick];

  const count = outcome.legs.length;

  useEffect(() => {
    const reduce =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    timers.current.forEach(clearTimeout);
    timers.current = [];
    if (reduce) { setStep(count); return; }
    setStep(0);
    for (let i = 1; i <= count; i++) {
      timers.current.push(setTimeout(() => setStep(i), 520 * i));
    }
    return () => { timers.current.forEach(clearTimeout); };
  }, [pick, count]);

  const settled = step >= count;

  return (
    <figure className="card slipcard" style={{ margin: 0, gap: 'var(--s3)' }} aria-live="polite">
      <div className="spread">
        <div className="row" style={{ gap: 'var(--s2)' }}>
          <span className="pill pill--accent">{outcome.type}</span>
          <span className="pill">{outcome.bookmaker}</span>
        </div>
        <span className="small dim mono">{money(outcome.stakeMinor)} &middot; {outcome.price}</span>
      </div>

      <ul style={{ marginTop: 'var(--s3)' }}>
        {outcome.legs.map((leg, i) => {
          const state = i < step ? leg.result : 'open';
          return (
            <li key={leg.selection} className="brow" style={{ gridTemplateColumns: '20px minmax(0,1fr) auto' }}>
              <span
                className={state === 'won' ? 'pos' : state === 'lost' ? 'neg' : 'dim'}
                style={{ display: 'grid', placeItems: 'center' }}
              >
                {state === 'open' ? (
                  <Icon name="clock" size={16} />
                ) : state === 'won' ? (
                  <Icon name="check" size={16} strokeWidth={2.2} />
                ) : state === 'lost' ? (
                  <Icon name="close" size={16} strokeWidth={2.2} />
                ) : (
                  <Icon name="minus" size={16} strokeWidth={2.2} />
                )}
              </span>
              <span className={i < step ? 'is-settling' : undefined} style={{ minWidth: 0 }}>
                <span className="brow__title">{leg.selection}</span>
                <span className="brow__sub">{leg.fixture}</span>
              </span>
              <span className="small mono dim">{leg.odds}</span>
            </li>
          );
        })}
      </ul>

      <div
        className={`${settled ? 'is-settling' : 'pending'}`}
        style={{
          marginTop: 'var(--s3)', paddingTop: 'var(--s4)', borderTop: '1px solid var(--line)',
        }}
      >
        <div className="spread">
          <div>
            <p className="label">{settled ? outcome.verdict : 'Running'}</p>
            <p className={`fig fig--m ${settled ? plClass(outcome.plMinor) : 'dim'}`}>
              {settled
                ? <CountUp key={outcome.key} to={outcome.plMinor} render={(v) => pl(v)} />
                : '+£0.00'}
            </p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <p className="label">Returned</p>
            <p className="fig fig--s tnum">{money(settled ? outcome.returnedMinor : 0)}</p>
          </div>
        </div>
        <p className="small muted" style={{ marginTop: 'var(--s3)', minHeight: '2.9em' }}>
          {settled ? outcome.note : 'Nothing is written until the bet has a result.'}
        </p>
      </div>

      <figcaption style={{ marginTop: 'var(--s4)' }}>
        <p className="label" style={{ marginBottom: 'var(--s2)' }}>
          Step through the {spell(OUTCOMES.length, { cap: false })} outcomes
        </p>
        <div className="row row--wrap" style={{ gap: 'var(--s1)' }}>
          {OUTCOMES.map((o, i) => (
            <button
              key={o.key}
              type="button"
              className="seg__btn"
              aria-pressed={i === pick}
              onClick={() => setPick(i)}
            >
              {o.label}
            </button>
          ))}
        </div>
      </figcaption>
    </figure>
  );
}
