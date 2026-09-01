'use client';

import { useEffect, useMemo, useState } from 'react';
import { Icon } from '@/components/Icon';
import { ModuleMenu, MenuChoice } from '@/components/app/ModuleMenu';
import { londonDay, londonParts, MONTH_LONG, money, cellFigure } from '@/lib/format';
import type { Currency } from '@/lib/domain/types';

/** The calendar. Day boundaries are Europe/London, or a 23:00 bet lands on
 *  the wrong day.
 *
 *  FOUR CELL STATES, and the middle two are the whole point:
 *    a past day WITH bets       filled, and the depth carries the size of the day
 *    a past day with NO bets    the date is struck through: you did not bet
 *    a day NOT YET HAPPENED     recessed, and never struck through
 *    padding from another month empty, aria-hidden
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
 *  So chroma varies instead of lightness. The semantic colour is mixed 35%
 *  into --bg first, giving a dark saturated anchor, and THAT is faded in over
 *  the cell. Lightness barely moves, so one text colour is readable at every
 *  step of a continuous ramp. 35% and not more because the figure in a cell
 *  keeps its own semantic colour, so green on green is the binding constraint.
 *  tests/calendar-ramp.test.ts measures every step in every theme. */

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

export type CalDay = { day: string; netPence: number; count: number };

export function MonthCalendar({
  days, now, weekStart = 1, show: initialShow = 'both', currency = 'GBP',
}: {
  /** Every settled day the account has. The calendar picks the month itself. */
  days: CalDay[];
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

  const nowParts = londonParts(now);
  const today = londonDay(now);
  /** Months back from the current one. 0 is this month; the state is an
   *  offset rather than a date so "this month" survives a midnight tick. */
  const [back, setBack] = useState(0);

  const byDay = useMemo(() => new Map(days.map((d) => [d.day, d])), [days]);

  /** How far back there is anything to look at. One extra month past the
   *  earliest record, so the first month is not a wall. */
  const oldest = useMemo(() => {
    if (days.length === 0) return 0;
    const first = days.reduce((a, d) => (d.day < a ? d.day : a), days[0].day);
    const [y, m] = first.split('-').map(Number);
    return Math.max(0, (nowParts.year - y) * 12 + (nowParts.month - m));
  }, [days, nowParts.year, nowParts.month]);

  // The month on screen.
  const shownIdx = nowParts.year * 12 + (nowParts.month - 1) - back;
  const year = Math.floor(shownIdx / 12);
  const month = (shownIdx % 12) + 1;

  const first = new Date(Date.UTC(year, month - 1, 1));
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const lead = (first.getUTCDay() - weekStart + 7) % 7;

  // The peak is the shown month's OWN biggest day, so a quiet month uses the
  // full range instead of being washed out by a loud one three months ago.
  const prefix = `${year}-${String(month).padStart(2, '0')}-`;
  const inMonth = days.filter((d) => d.day.startsWith(prefix));
  const peak = Math.max(1, ...inMonth.map((d) => Math.abs(d.netPence)));
  const monthNet = inMonth.reduce((a, d) => a + d.netPence, 0);
  const monthBets = inMonth.reduce((a, d) => a + d.count, 0);

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
    const key = `${prefix}${String(d).padStart(2, '0')}`;
    const rec = byDay.get(key);
    const future = key > today;
    const bet = !future && Boolean(rec);
    const net = bet ? rec!.netPence : 0;

    // A continuous ramp from the floor to full strength. No tiers.
    const alpha = bet && net !== 0 ? FLOOR + (Math.abs(net) / peak) * (1 - FLOOR) : 0;
    const anchor = net >= 0 ? 'var(--cal-pos)' : 'var(--cal-neg)';

    const label = MONTH_LONG[month - 1];
    const sentence = future
      ? `${d} ${label}, not yet`
      : bet
        ? `${d} ${label}, ${money(net, currency, { sign: true })} from ${rec!.count} bet${rec!.count === 1 ? '' : 's'}`
        : `${d} ${label}, no bets`;

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

        {showValue && bet ? (
          <span
            className={`cal__v ${net > 0 ? 'pos' : net < 0 ? 'neg' : 'cal__v--flat'}`}
            aria-hidden="true"
          >
            {cellFigure(net, currency)}
          </span>
        ) : null}

        {showDate ? <span className="cal__n" aria-hidden="true">{d}</span> : null}

        {/* The slash is never the only signal: the sentence below says it too. */}
        <span className="sr-only">{sentence}</span>
      </div>,
    );
  }

  /*  Exactly the rows this month needs, five or six.
   *
   *  It used to render 42 cells always, so that a five row month could not
   *  change the module's height and shove every module beside it. The module
   *  has a fixed height now, so that cannot happen either way, and the always
   *  six version left an empty row of dead space at the bottom of five months
   *  out of seven. The rows stretch to fill instead. */
  const rows = Math.ceil((lead + daysInMonth) / 7);
  while (cells.length < rows * 7) {
    cells.push(<div key={`tail${cells.length}`} className="cal__cell cal__cell--out" aria-hidden="true" />);
  }

  const title = `${MONTH_LONG[month - 1]} ${year}`;

  return (
    <div className="calwrap">
      <div className="cal__ctl">
        <div className="cal__nav">
          <button
            type="button"
            className="icobtn"
            onClick={() => setBack((b) => b + 1)}
            disabled={back >= oldest}
            aria-label="Previous month"
          >
            <Icon name="chevronLeft" />
          </button>
          <p className="cal__month" aria-live="polite">{title}</p>
          <button
            type="button"
            className="icobtn"
            onClick={() => setBack((b) => Math.max(0, b - 1))}
            disabled={back === 0}
            aria-label="Next month"
          >
            <Icon name="chevronRight" />
          </button>
        </div>

        <ModuleMenu label="Calendar">
          <MenuChoice
            label="Each day shows"
            value={show}
            options={SHOW_OPTIONS}
            onChange={choose}
          />
        </ModuleMenu>
      </div>

      <div
        className="cal"
        role="group"
        aria-label={`${title}, one cell a day`}
        style={{ ['--cal-rows' as string]: String(rows) }}
      >
        {DOW.map((l) => (
          <div key={l} className="cal__dow" aria-hidden="true">{l.slice(0, 1)}</div>
        ))}
        {cells}
      </div>

      {/* The ramp is the only thing on the page whose meaning is not written
          down anywhere, so one line says it. */}
      <div className="cal__foot">
        <ul className="cal__key">
          <li><span className="cal__keyswatch cal__keyswatch--pos" aria-hidden="true" />Profitable</li>
          <li><span className="cal__keyswatch cal__keyswatch--neg" aria-hidden="true" />Losing</li>
          <li><span className="cal__keyswatch cal__keyswatch--none" aria-hidden="true" />No bets</li>
        </ul>
        <p className="small tnum cal__sum">
          {monthBets > 0
            ? <>{monthBets} bet{monthBets === 1 ? '' : 's'}, <span className={monthNet >= 0 ? 'pos' : 'neg'}>{money(monthNet, currency, { sign: true })}</span></>
            : 'Nothing settled'}
        </p>
      </div>
    </div>
  );
}
