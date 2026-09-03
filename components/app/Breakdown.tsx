'use client';

import { useEffect, useState } from 'react';
import { DIMENSIONS, ORDERED_DIMENSIONS, type Dimension, type BreakRow } from '@/lib/data/analytics';
import { RowSpark } from '@/components/app/Charts';
import { Seg } from '@/components/app/Seg';
import { ModuleMenu, MenuChoice } from '@/components/app/ModuleMenu';
import { money, pct, units as fmtUnits } from '@/lib/format';
import type { Currency } from '@/lib/domain/types';

/** Four breakdown modules became one, with a segmented control. Same rows,
 *  same sort, same figures. The bet count sits beside each name and rows
 *  under five bets are greyed, because profit without volume ranks one lucky
 *  bet above forty disciplined ones.
 *
 *  Each row carries three things and they answer different questions:
 *
 *    the SPARKLINE   how it got there. Steady, or one Saturday?
 *    the BAR         how big it is next to the biggest row here
 *    the FIGURE      what it came to
 *
 *  The bar is scaled to the largest ABSOLUTE net in the list, so a big loss
 *  and a big win are the same length in opposite colours and the eye can
 *  compare them. Scaling to the largest win instead makes every losing row a
 *  stub, which is the shape most of these charts have and the reason they
 *  are useless.
 *
 *  THE SELECTOR IS ON THE TITLE ROW. It was a strip of six buttons across
 *  the top of the list, which is a second header inside a card that already
 *  has one, and it pushed the rows down by 44 pixels on the one screen in
 *  the product that is sized to the window. Right aligned in the head, it is
 *  where every other module in this build puts the thing it can be adjusted
 *  by.
 *
 *  THE SECOND LIST IS GONE. It drew a second dimension beside the first from
 *  1840 up, on the argument that a wide card can hold two readings. On a
 *  dashboard that is one screen this module is seven of twelve columns
 *  rather than all twelve, so at 1920 it is a thousand pixels: one list at a
 *  readable width, or two at five hundred with every bookmaker's name
 *  truncated. The second dimension is one press away and always was.
 *
 *  THE FOOTNOTE ABOUT CLAMPED SHAPES IS GONE TOO, with the asterisk that
 *  pointed at it and the copy of the same sentence inside every row's screen
 *  reader line. Three sentences of the product explaining its own charting
 *  to the reader, on the row where a figure goes. The clamp is unchanged and
 *  every figure printed anywhere is the true one, which is what the sentence
 *  was there to say and what the figures say for themselves. */
const UNIT_COOKIE = 'slip_brk';

function readUnits(): boolean {
  if (typeof document === 'undefined') return false;
  return new RegExp(`(?:^|; )${UNIT_COOKIE}=u`).test(document.cookie);
}

export function Breakdown({
  rowsByDim, currency = 'GBP', showUnits = false, card,
}: {
  rowsByDim: Record<Dimension, BreakRow[]>;
  currency?: Currency;
  showUnits?: boolean;
  /** Draw the card, with the selector in its head beside the title.
   *
   *  The dashboard passes this and nothing else does. It is a prop rather
   *  than a second component because the state the selector drives is in
   *  here, and two components holding the same three pieces of state is how
   *  a module ends up with two answers to which dimension is open. Without
   *  it this renders its content only, for a caller that has already drawn a
   *  Module around it. */
  card?: { title: string; span: 6 | 7 | 8 | 12; id: string };
}) {
  /*  BOOKMAKER FIRST, not sport.
   *
   *  Every bet has exactly one bookmaker and most accounts keep several, so
   *  it is the dimension with the most rows in it on any real record. Sport
   *  opened with two rows, Football and Tennis, in the widest module on the
   *  page showing the shortest list it has. It is also the least interesting
   *  first cut: a bettor already knows which sports they bet on and does not
   *  know which book is taking their money. Sport is one press away. */
  const [dim, setDim] = useState<Dimension>('bookmaker');
  /*  Money or units, in the corner menu rather than as a second row of
      buttons over the rows. A £500 staker and a £5 staker read the same list
      differently and both are right, so it is a preference and it is kept the
      same way the theme and the calendar's display mode are: a cookie, which
      survives a phone being closed and needs no database. */
  const [units, setUnits] = useState(showUnits);
  useEffect(() => { setUnits(readUnits()); }, []);
  const rows = rowsByDim[dim] ?? [];

  const pick = (next: boolean) => {
    setUnits(next);
    document.cookie = `${UNIT_COOKIE}=${next ? 'u' : 'm'}; path=/; max-age=31536000; samesite=lax`;
  };

  const chooser = (
    <Seg label="Break down by" className="seg--tight">
      {DIMENSIONS.map((d) => (
        <button key={d.id} type="button" className="seg__btn" aria-pressed={dim === d.id} onClick={() => setDim(d.id)}>
          {d.label}
        </button>
      ))}
    </Seg>
  );

  const menu = (
    <ModuleMenu label="Breakdown">
      <MenuChoice
        label="Show each row in"
        value={units ? 'units' : 'money'}
        options={[{ id: 'money', label: 'Money' }, { id: 'units', label: 'Units' }]}
        onChange={(next) => pick(next === 'units')}
      />
    </ModuleMenu>
  );

  const list = rows.length === 0 ? (
    <p className="small dim">Nothing in this scope yet.</p>
  ) : (
    /*  THE LIST SCROLLS, NOTHING IS DROPPED.
        The card is one row of a dashboard sized to the window, and a
        bookmaker list is as long as the account has bookmakers. The
        alternative was showing the top few, and a breakdown that shows the
        best five rows of nine is a tracker flattering its own reader.
        tabIndex, because a region that scrolls has to be reachable from a
        keyboard. */
    <div className="brk__scroll" tabIndex={0}>
      <BreakList rows={rows} currency={currency} showUnits={units} ordered={ORDERED_DIMENSIONS.has(dim)} />
    </div>
  );

  if (!card) {
    return (
      <>
        <div className="brk__tools">{menu}</div>
        <div className="brk__col">
          {chooser}
          {list}
        </div>
      </>
    );
  }

  return (
    <section className={`card col-${card.span} brk__card`} aria-labelledby={`${card.id}-t`} id={card.id}>
      <header className="card__head">
        <h2 className="card__title" id={`${card.id}-t`}>{card.title}</h2>
        <div className="card__tools">{chooser}{menu}</div>
      </header>
      {list}
    </section>
  );
}

/** The row list on its own, so the ordered modules (odds bands, stake bands)
 *  can use exactly the same row without the segmented control on top. */
export function BreakList({
  rows, currency = 'GBP', showUnits = false, ordered = false,
}: {
  rows: BreakRow[];
  currency?: Currency;
  showUnits?: boolean;
  /** Ordered lists keep their order and colour the bar by the sign of the
   *  row, rather than ranking. */
  ordered?: boolean;
}) {
  const peak = Math.max(1, ...rows.map((r) => Math.abs(r.netPence)));

  return (
    <ul className="brk">
      {rows.map((r) => {
        const pos = r.netPence >= 0;
        const empty = ordered && r.count === 0;
        return (
          <li key={r.key} className={`brk__row${r.thin ? ' brk__row--faded' : ''}`}>
            <span className="brk__name" title={r.label}>{r.label}</span>

            <span className="brk__n tnum" aria-hidden="true">{r.count}</span>

            <span className="brk__spark">
              <RowSpark values={r.spark} tone={pos ? 'pos' : 'neg'} />
            </span>

            <span className={`brk__fig tnum ${empty ? 'dim' : pos ? 'pos' : 'neg'}`}>
              {showUnits ? fmtUnits(r.units, { sign: true }) : money(r.netPence, currency, { sign: true })}
            </span>

            <span className="brk__bar" aria-hidden="true">
              <span
                className={`brk__barfill ${pos ? 'brk__barfill--pos' : 'brk__barfill--neg'}`}
                style={{ width: `${Math.min(100, (Math.abs(r.netPence) / peak) * 100).toFixed(1)}%` }}
              />
            </span>

            <span className="brk__sub">
              {empty
                ? 'No bets'
                : <>{pct(r.roi, { sign: true })} on {money(r.turnoverPence, currency)}</>}
            </span>

            {/* One sentence per row for a screen reader, because the bar, the
                sparkline and the colour are all visual only. */}
            <span className="sr-only">
              {r.label}: {r.count} bet{r.count === 1 ? '' : 's'},{' '}
              {money(r.netPence, currency, { sign: true })}, {pct(r.roi, { sign: true })} return
              on {money(r.turnoverPence, currency)} turnover.
            </span>
          </li>
        );
      })}
    </ul>
  );
}
