'use client';

import { useState } from 'react';
import { DIMENSIONS, ORDERED_DIMENSIONS, type Dimension, type BreakRow } from '@/lib/data/analytics';
import { RowSpark } from '@/components/app/Charts';
import { Seg } from '@/components/app/Seg';
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
 *  are useless. */
export function Breakdown({
  rowsByDim, currency = 'GBP', showUnits = false,
}: {
  rowsByDim: Record<Dimension, BreakRow[]>;
  currency?: Currency;
  showUnits?: boolean;
}) {
  const [dim, setDim] = useState<Dimension>('sport');
  const rows = rowsByDim[dim] ?? [];

  return (
    <>
      <Seg label="Break down by" className="seg--gap">
        {DIMENSIONS.map((d) => (
          <button key={d.id} type="button" className="seg__btn" aria-pressed={dim === d.id} onClick={() => setDim(d.id)}>
            {d.label}
          </button>
        ))}
      </Seg>

      {rows.length === 0 ? (
        <p className="small dim">Nothing in this scope yet.</p>
      ) : (
        <div
          className="grow"
          style={{ overflowY: 'auto', minHeight: 0 }}
          tabIndex={0}
          role="region"
          aria-label={`Broken down by ${dim}, scrollable`}
        >
          <BreakList rows={rows} currency={currency} showUnits={showUnits} ordered={ORDERED_DIMENSIONS.has(dim)} />
        </div>
      )}
    </>
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
