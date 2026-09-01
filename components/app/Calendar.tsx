'use client';

import { useEffect, useState } from 'react';
import { londonDay, londonParts, MONTH_LONG, money, cellFigure } from '@/lib/format';
import type { Currency } from '@/lib/domain/types';

/** The calendar. Always the month shown, so it ignores the scope bar and says
 *  so in its own header. Day boundaries are Europe/London, or a 23:00 bet
 *  lands on the wrong day.
 *
 *  FOUR CELL STATES, and the last two are the whole point:
 *    a past day WITH bets   filled, and the depth carries the size of the day
 *    a past day with NO bets  the date is struck through: you did not bet
 *    a day NOT YET HAPPENED   recessed, and never struck through
 *    padding from another month  empty, aria-hidden
 *
 *  "You did not bet" and "it has not happened yet" are different facts, and a
 *  line through tomorrow is a lie.
 *
 *  THE RAMP. Laying the semantic colour over the cell at an opacity that
 *  tracks the size of the day sweeps the cell through mid luminance: across
 *  all eight themes --ink fails 4.5:1 above alpha 0.24, --bg does not reach
 *  4.5:1 until alpha 0.60, and NOTHING is readable between the two. The build
 *  before this one jumped that dead band with two fixed tiers, and 112 and 148
 *  landed in different tiers and read as different worlds, which costs the
 *  fill the only thing it is for.
 *
 *  So chroma varies instead of lightness. The semantic colour is mixed 45%
 *  into --bg first, giving a dark saturated anchor, and THAT is faded in over
 *  the cell. Lightness barely moves, so one text colour is readable at every
 *  step of a continuous ramp. tests/calendar-ramp.test.ts measures every step
 *  in every theme, and guards against the naive version coming back. */

export type CalShow = 'date' | 'amount' | 'both' | 'none';

const SHOW_COOKIE = 'slip_cal';
const SHOW_OPTIONS: { id: CalShow; label: string }[] = [
  { id: 'both', label: 'Both' },
  { id: 'date', label: 'Date' },
  { id: 'amount', label: 'Amount' },
  { id: 'none', label: 'Neither' },
];

/** The ramp floor, so the smallest winning day still looks different from a
 *  day with no bets at all. */
const FLOOR = 0.14;

function readCookie(): CalShow | null {
  if (typeof document === 'undefined') return null;
  const m = document.cookie.match(new RegExp(`(?:^|; )${SHOW_COOKIE}=([^;]*)`));
  const v = m ? decodeURIComponent(m[1]) : '';
  return SHOW_OPTIONS.some((o) => o.id === v) ? (v as CalShow) : null;
}

export function MonthCalendar({
  days, now, weekStart = 1, show: initialShow = 'both', currency = 'GBP',
}: {
  days: { day: string; netPence: number; count: number }[];
  now: Date;
  weekStart?: 0 | 1;
  show?: CalShow;
  currency?: Currency;
}) {
  const [show, setShow] = useState<CalShow>(initialShow);

  // A cookie, the way the theme does it. There is no localStorage here.
  useEffect(() => {
    const saved = readCookie();
    if (saved) setShow(saved);
  }, []);

  const choose = (next: CalShow) => {
    setShow(next);
    document.cookie = `${SHOW_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
  };

  const p = londonParts(now);
  const today = londonDay(now);
  const first = new Date(Date.UTC(p.year, p.month - 1, 1));
  const daysInMonth = new Date(Date.UTC(p.year, p.month, 0)).getUTCDate();
  const lead = (first.getUTCDay() - weekStart + 7) % 7;

  const byDay = new Map(days.map((d) => [d.day, d]));

  // The peak is the month's OWN biggest day, so a quiet month uses the full
  // range instead of being washed out by a loud one three months ago.
  const peak = Math.max(1, ...days.map((d) => Math.abs(d.netPence)));

  const DOW = weekStart === 1
    ? ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
    : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const showDate = show === 'date' || show === 'both';
  const showValue = show === 'amount' || show === 'both';
  const stack = show === 'both';

  const cells: React.ReactNode[] = [];

  for (let i = 0; i < lead; i++) {
    cells.push(<div key={`lead${i}`} className="cal__cell cal__cell--out" aria-hidden="true" />);
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const key = `${p.year}-${String(p.month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const rec = byDay.get(key);
    const future = key > today;
    const bet = !future && Boolean(rec);
    const net = bet ? rec!.netPence : 0;

    // A continuous ramp from the floor to full strength. No tiers.
    const alpha = bet && net !== 0 ? FLOOR + (Math.abs(net) / peak) * (1 - FLOOR) : 0;
    const anchor = net >= 0 ? 'var(--cal-pos)' : 'var(--cal-neg)';

    const month = MONTH_LONG[p.month - 1];
    const sentence = future
      ? `${d} ${month}, not yet`
      : bet
        ? `${d} ${month}, ${money(net, currency, { sign: true })} from ${rec!.count} bet${rec!.count === 1 ? '' : 's'}`
        : `${d} ${month}, no bets`;

    cells.push(
      <div
        key={key}
        className={[
          'cal__cell',
          future ? 'cal__cell--future' : '',
          !future && !bet ? 'cal__cell--blank' : '',
          key === today ? 'cal__cell--today' : '',
          stack ? 'cal__cell--stack' : '',
        ].filter(Boolean).join(' ')}
        title={sentence}
      >
        {alpha > 0 ? (
          <span
            className="cal__fill"
            aria-hidden="true"
            style={{ background: `color-mix(in srgb, ${anchor} ${(alpha * 100).toFixed(1)}%, transparent)` }}
          />
        ) : null}

        {showDate ? (
          <span
            className={`cal__n${!future && !bet ? ' cal__n--none' : ''}`}
            aria-hidden="true"
          >
            {d}
          </span>
        ) : null}

        {showValue && bet ? (
          <span className={`cal__v${net === 0 ? ' cal__v--flat' : ''}`} aria-hidden="true">
            {cellFigure(net, currency)}
          </span>
        ) : null}

        {/* The strikethrough is never the only signal. */}
        <span className="sr-only">{sentence}</span>
      </div>,
    );
  }

  // Six rows always, 42 cells. Some months need five and some six, and a grid
  // that changes height between months moves every module in its row with it.
  while (cells.length < 42) {
    cells.push(<div key={`tail${cells.length}`} className="cal__cell cal__cell--out" aria-hidden="true" />);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: '1 1 auto', minHeight: 0 }}>
      <div className="cal__ctl">
        <div className="seg seg--xs" role="group" aria-label="What each day shows">
          {SHOW_OPTIONS.map((o) => (
            <button
              key={o.id}
              type="button"
              className="seg__btn"
              aria-pressed={show === o.id}
              onClick={() => choose(o.id)}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      <div className="cal" role="group" aria-label={`${MONTH_LONG[p.month - 1]} ${p.year}, one cell a day`}>
        {DOW.map((l) => (
          <div key={l} className="cal__dow" aria-hidden="true">{l.slice(0, 1)}</div>
        ))}
        {cells}
      </div>

      {/* The ramp is the only thing on the page whose meaning is not written
          down anywhere, so one line says it. */}
      <p className="cal__key">
        <span className="cal__keyswatch cal__keyswatch--neg" aria-hidden="true" />
        <span className="cal__keyswatch cal__keyswatch--pos" aria-hidden="true" />
        Deeper is a bigger day. A struck out date is a day you did not bet.
      </p>
    </div>
  );
}
