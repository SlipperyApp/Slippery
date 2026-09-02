'use client';

import { useEffect, useState } from 'react';
import { DIMENSIONS, ORDERED_DIMENSIONS, SHAPE_UNIT_CAP, type Dimension, type BreakRow } from '@/lib/data/analytics';
import { RowSpark } from '@/components/app/Charts';
import { Seg } from '@/components/app/Seg';
import { useWide } from './wide';
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
 *  THE SPARKLINE IS NOT THE RECORD, and the row says so when it is not. It
 *  draws units with each bet's contribution clamped to plus or minus three,
 *  because one forty unit bet in a row draws a wall and a flat line and every
 *  other bet in it becomes a pixel. A row that had to clamp anything carries
 *  a marker and the note under the list explains it. The figure beside the
 *  line, and every total anywhere in this product, is the true one.
 *
 *  The bar is scaled to the largest ABSOLUTE net in the list, so a big loss
 *  and a big win are the same length in opposite colours and the eye can
 *  compare them. Scaling to the largest win instead makes every losing row a
 *  stub, which is the shape most of these charts have and the reason they
 *  are useless. */
const UNIT_COOKIE = 'slip_brk';

/*  THE WIDTH AT WHICH THE MODULE HOLDS TWO OF THESE.
    At 1920 this card was 1620 pixels wide for a list of names, a count, a
    sparkline and a figure. It reads at 1440 and everything above that was
    air: the bar simply got longer, which is more pixels for a number the
    figure beside it already states. The module already holds all six
    dimensions and was showing one, so what a wide window buys is the second
    one, beside it, over the same selection. Bookmaker against market is a
    reading; a longer bar is not.

    IT IS A VIEWPORT WIDTH AND THE CARD IS NOT THE VIEWPORT. 1280 was right
    while this module ran the full twelve columns and its card was the window
    less a 232px sidebar; it now takes seven of them beside the calendar, and
    at 1280 the same rule put two 333px lists where one 699px list belongs,
    with every name in both truncating. 1840 is the window at which the card
    reaches the width the pair was justified at.

    THE SAME NUMBER IS IN components.css, on .brk__two, and the two have to
    agree: the grid draws the columns and this decides whether the second
    list exists to go in one. They were 1280 and 1280 and stayed in step by
    luck; both now carry a comment pointing at the other. */
const TWO_AT = 1840;

function readUnits(): boolean {
  if (typeof document === 'undefined') return false;
  return new RegExp(`(?:^|; )${UNIT_COOKIE}=u`).test(document.cookie);
}

export function Breakdown({
  rowsByDim, currency = 'GBP', showUnits = false,
}: {
  rowsByDim: Record<Dimension, BreakRow[]>;
  currency?: Currency;
  showUnits?: boolean;
}) {
  /*  BOOKMAKER FIRST, not sport.
   *
   *  Every bet has exactly one bookmaker and most accounts keep several, so
   *  it is the dimension with the most rows in it on any real record. Sport
   *  opened with two rows, Football and Tennis, in a module 1152 by 408,
   *  which is the widest thing on the page showing the shortest list it has.
   *  It is also the least interesting first cut: a bettor already knows
   *  which sports they bet on and does not know which book is taking their
   *  money. Sport is one press away. */
  const [dim, setDim] = useState<Dimension>('bookmaker');
  /*  The second list. Market, because bookmaker against market is the pair
      a bettor actually asks about and because sport opens with two rows,
      which would put a four hundred pixel column beside a seven hundred
      pixel one on the first paint. Choosing the one already on the other
      side swaps them rather than drawing the same list twice. */
  const [dim2, setDim2] = useState<Dimension>('market');
  const two = useWide(TWO_AT);
  /*  Money or units, in the corner menu rather than as a second row of
      buttons over the rows. A £500 staker and a £5 staker read the same list
      differently and both are right, so it is a preference and it is kept the
      same way the theme and the calendar's display mode are: a cookie, which
      survives a phone being closed and needs no database. */
  const [units, setUnits] = useState(showUnits);
  useEffect(() => { setUnits(readUnits()); }, []);
  const rows = rowsByDim[dim] ?? [];
  const rows2 = rowsByDim[dim2] ?? [];

  const choose = (next: Dimension) => {
    if (next === dim2) setDim2(dim);
    setDim(next);
  };
  const choose2 = (next: Dimension) => {
    if (next === dim) setDim(dim2);
    setDim2(next);
  };

  const pick = (next: boolean) => {
    setUnits(next);
    document.cookie = `${UNIT_COOKIE}=${next ? 'u' : 'm'}; path=/; max-age=31536000; samesite=lax`;
  };

  return (
    <>
      <div className="brk__tools">
        <ModuleMenu label="Breakdown">
          <MenuChoice
            label="Show each row in"
            value={units ? 'units' : 'money'}
            options={[{ id: 'money', label: 'Money' }, { id: 'units', label: 'Units' }]}
            onChange={(next) => pick(next === 'units')}
          />
        </ModuleMenu>
      </div>
      {/*  TWO COLUMNS FROM 1280, AND THE GRID IS THERE BEFORE THE SECOND
           LIST IS. The column widths do not depend on whether the second
           list has mounted, so the first one is laid out at its final width
           on the first paint and nothing jumps when the browser answers
           what the window is. Under 1280 the second list is not rendered at
           all, which is the point of asking rather than drawing it and
           hiding it: a phone should not carry ten rows and ten sparklines it
           will never show. */}
      <div className="brk__two">
        <div className="brk__col">
          <Seg label="Break down by" className="seg--gap">
            {DIMENSIONS.map((d) => (
              <button key={d.id} type="button" className="seg__btn" aria-pressed={dim === d.id} onClick={() => choose(d.id)}>
                {d.label}
              </button>
            ))}
          </Seg>

          {rows.length === 0 ? (
            <p className="small dim">Nothing in this scope yet.</p>
          ) : (
            /*  THE LIST SCROLLS, NOTHING IS DROPPED.
                The card is one row of a dashboard sized to the window, and a
                bookmaker list is as long as the account has bookmakers. The
                alternative was showing the top few, and a breakdown that
                shows the best five rows of nine is a tracker flattering its
                own reader. tabIndex, because a region that scrolls has to be
                reachable from a keyboard. */
            <div className="brk__scroll" tabIndex={0}>
              <BreakList rows={rows} currency={currency} showUnits={units} ordered={ORDERED_DIMENSIONS.has(dim)} note={false} />
            </div>
          )}
        </div>

        {two ? (
          <div className="brk__col">
            <Seg label="And beside it" className="seg--gap">
              {DIMENSIONS.map((d) => (
                <button key={d.id} type="button" className="seg__btn" aria-pressed={dim2 === d.id} onClick={() => choose2(d.id)}>
                  {d.label}
                </button>
              ))}
            </Seg>

            {rows2.length === 0 ? (
              <p className="small dim">Nothing in this scope yet.</p>
            ) : (
              <div className="brk__scroll" tabIndex={0}>
                <BreakList rows={rows2} currency={currency} showUnits={units} ordered={ORDERED_DIMENSIONS.has(dim2)} note={false} />
              </div>
            )}
          </div>
        ) : null}
      </div>

      {/*  ONE FOOTNOTE, UNDER BOTH. Each list drew its own, so at 1280 the
           same sentence about how the shapes are clamped appeared twice
           inside one module, once under each column. */}
      {[...rows, ...(two ? rows2 : [])].some((r) => r.capped) ? (
        <p className="small dim brk__note">
          <span aria-hidden="true">*</span> A bet over {SHAPE_UNIT_CAP} units is drawn at{' '}
          {SHAPE_UNIT_CAP} on these shapes, so one heavy stake cannot flatten the rest of the
          line. Every figure is the real one.
        </p>
      ) : null}
    </>
  );
}

/** The row list on its own, so the ordered modules (odds bands, stake bands)
 *  can use exactly the same row without the segmented control on top. */
export function BreakList({
  rows, currency = 'GBP', showUnits = false, ordered = false, note = true,
}: {
  rows: BreakRow[];
  currency?: Currency;
  showUnits?: boolean;
  /** Ordered lists keep their order and colour the bar by the sign of the
   *  row, rather than ranking. */
  ordered?: boolean;
  /** Whether this list prints the footnote about clamped shapes. Off when
   *  two lists sit side by side and one sentence covers both. */
  note?: boolean;
}) {
  const peak = Math.max(1, ...rows.map((r) => Math.abs(r.netPence)));
  const anyCapped = rows.some((r) => r.capped);

  return (
    <>
      <ul className={`brk${anyCapped ? ' brk--noted' : ''}`}>
      {rows.map((r) => {
        const pos = r.netPence >= 0;
        const empty = ordered && r.count === 0;
        return (
          <li key={r.key} className={`brk__row${r.thin ? ' brk__row--faded' : ''}`}>
            <span className="brk__name" title={r.label}>{r.label}</span>

            <span className="brk__n tnum" aria-hidden="true">{r.count}</span>

            <span className="brk__spark">
              <RowSpark values={r.spark} tone={pos ? 'pos' : 'neg'} />
              {r.capped ? (
                <span className="brk__cap" aria-hidden="true">*</span>
              ) : null}
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
              {r.capped
                ? ` The shape beside this row draws a bet over ${SHAPE_UNIT_CAP} units at ${SHAPE_UNIT_CAP}. The figure is the real one.`
                : ''}
            </span>
          </li>
        );
      })}
      </ul>
      {anyCapped && note ? (
        /*  Named where it applies rather than in a settings page nobody
            opens. A chart the reader cannot tell apart from the record is
            worse than no chart. */
        <p className="small dim brk__note">
          <span aria-hidden="true">*</span> A bet over {SHAPE_UNIT_CAP} units is drawn at{' '}
          {SHAPE_UNIT_CAP} on these shapes, so one heavy stake cannot flatten the rest of the
          line. Every figure is the real one.
        </p>
      ) : null}
    </>
  );
}
