'use client';

import { useEffect, useRef, useState } from 'react';
import { Icon } from '@/components/Icon';
import { money, pl, plClass } from '@/lib/format';

/** A slip whose legs resolve one at a time and stop on the verdict.
 *
 *  Not a video and not a screenshot. The old build shipped 48 video elements,
 *  all with controls and none autoplaying. This is state driven, six
 *  outcomes, clickable dots to step through them, and it collapses to its
 *  final frame under prefers-reduced-motion. */

type LegResult = 'won' | 'lost' | 'void';
type Outcome = {
  key: string;
  label: string;
  /** What the legs do, in order. */
  legs: LegResult[];
  verdict: string;
  /** Realised profit or loss in pence against a £25.00 stake. */
  plMinor: number;
  returnedMinor: number;
  note: string;
  tone: 'pos' | 'neg' | 'flat';
};

const STAKE = 2500;

const OUTCOMES: Outcome[] = [
  {
    key: 'won', label: 'Won',
    legs: ['won', 'won', 'won'],
    verdict: 'Won', plMinor: 21375, returnedMinor: 23875,
    note: 'Three from three at 9.55. Settled 22 seconds after the last final whistle.',
    tone: 'pos',
  },
  {
    key: 'lost', label: 'Lost',
    legs: ['won', 'won', 'lost'],
    verdict: 'Lost', plMinor: -2500, returnedMinor: 0,
    note: 'Two up, one down. The record keeps the two that landed, which is the point of capturing at placement.',
    tone: 'neg',
  },
  {
    key: 'void', label: 'Void leg',
    legs: ['won', 'void', 'won'],
    verdict: 'Won, one leg void', plMinor: 5975, returnedMinor: 8475,
    note: 'Postponed fixture drops out and the price recalculates from 9.55 to 3.39. Nothing is guessed.',
    tone: 'pos',
  },
  {
    key: 'cash-profit', label: 'Cashed out ahead',
    legs: ['won', 'won', 'void'],
    verdict: 'Cash out, in profit', plMinor: 8600, returnedMinor: 11100,
    note: 'You pulled it at 2-0 with the third leg still running. Cash out is never detected from a feed: it is always your action.',
    tone: 'pos',
  },
  {
    key: 'cash-loss', label: 'Cashed out behind',
    legs: ['won', 'lost', 'void'],
    verdict: 'Cash out, at a loss', plMinor: -1580, returnedMinor: 920,
    note: 'Taken late for £9.20 off a £25.00 stake. It still counts, and it still shows.',
    tone: 'neg',
  },
  {
    key: 'cash-flat', label: 'Cashed out flat',
    legs: ['won', 'void', 'void'],
    verdict: 'Cash out, flat', plMinor: 0, returnedMinor: 2500,
    note: 'Stake back, nothing in it. A flat result is a result, not a gap in the record.',
    tone: 'flat',
  },
];

const LEGS = [
  { team: 'Arsenal to win', fixture: 'Arsenal v Brentford', odds: '1.53' },
  { team: 'Over 2.5 goals', fixture: 'Napoli v Roma', odds: '1.95' },
  { team: 'Alcaraz 2-0', fixture: 'Alcaraz v Rune', odds: '3.20' },
];

export function SettleDemo() {
  const [pick, setPick] = useState(0);
  const [step, setStep] = useState(3);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const outcome = OUTCOMES[pick];

  useEffect(() => {
    const reduce =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    timers.current.forEach(clearTimeout);
    timers.current = [];
    if (reduce) { setStep(3); return; }
    setStep(0);
    for (let i = 1; i <= 3; i++) {
      timers.current.push(setTimeout(() => setStep(i), 520 * i));
    }
    return () => { timers.current.forEach(clearTimeout); };
  }, [pick]);

  const settled = step >= 3;

  return (
    <figure className="card slipcard" style={{ margin: 0, gap: 'var(--s3)' }} aria-live="polite">
      <div className="spread">
        <div className="row" style={{ gap: 'var(--s2)' }}>
          <span className="pill pill--accent">Treble</span>
          <span className="pill">bet365</span>
        </div>
        <span className="small dim mono">£25.00 &middot; 9.55</span>
      </div>

      <ul style={{ marginTop: 'var(--s3)' }}>
        {LEGS.map((leg, i) => {
          const state = i < step ? outcome.legs[i] : 'open';
          return (
            <li key={leg.team} className="brow" style={{ gridTemplateColumns: '20px minmax(0,1fr) auto' }}>
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
                <span className="brow__title" style={{ display: 'block' }}>{leg.team}</span>
                <span className="brow__sub">{leg.fixture}</span>
              </span>
              <span className="small mono dim">{leg.odds}</span>
            </li>
          );
        })}
      </ul>

      <div
        className={settled ? 'is-settling' : undefined}
        style={{
          marginTop: 'var(--s3)', paddingTop: 'var(--s4)', borderTop: '1px solid var(--line)',
        }}
      >
        <div className="spread">
          <div>
            <p className="label">{settled ? outcome.verdict : 'Running'}</p>
            <p className={`fig fig--m ${settled ? plClass(outcome.plMinor) : 'dim'}`}>
              {settled ? pl(outcome.plMinor) : '+£0.00'}
            </p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <p className="label">Returned</p>
            <p className="fig fig--s tnum">{money(settled ? outcome.returnedMinor : 0)}</p>
          </div>
        </div>
        <p className="small muted" style={{ marginTop: 'var(--s3)', minHeight: '2.9em' }}>
          {settled ? outcome.note : 'Legs grade one at a time. Nothing is written until every leg has a result.'}
        </p>
      </div>

      <figcaption style={{ marginTop: 'var(--s4)' }}>
        <p className="label" style={{ marginBottom: 'var(--s2)' }}>Step through the six outcomes</p>
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
