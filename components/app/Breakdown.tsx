'use client';

import { useState } from 'react';
import { DIMENSIONS, type Dimension, type BreakRow } from '@/lib/data/analytics';
import { money, pct, units as fmtUnits } from '@/lib/format';
import type { Currency } from '@/lib/domain/types';

/** Four breakdown modules became one, with a segmented control. Same chart,
 *  same rows, same sort. The bet count sits beside each name and rows under
 *  five bets are greyed, because profit without volume ranks one lucky bet
 *  above forty disciplined ones. */
export function Breakdown({
  rowsByDim, currency = 'GBP', showUnits = false,
}: {
  rowsByDim: Record<Dimension, BreakRow[]>;
  currency?: Currency;
  showUnits?: boolean;
}) {
  const [dim, setDim] = useState<Dimension>('sport');
  const rows = rowsByDim[dim] ?? [];
  const peak = Math.max(1, ...rows.map((r) => Math.abs(r.netPence)));

  return (
    <>
      <div className="seg" role="group" aria-label="Break down by" style={{ marginBottom: 'var(--s3)' }}>
        {DIMENSIONS.map((d) => (
          <button key={d.id} type="button" className="seg__btn" aria-pressed={dim === d.id} onClick={() => setDim(d.id)}>
            {d.label}
          </button>
        ))}
      </div>

      {rows.length === 0 ? (
        <p className="small dim">Nothing in this scope yet.</p>
      ) : (
        <ul className="grow" style={{ overflowY: 'auto', minHeight: 0 }}>
          {rows.map((r) => (
            <li key={r.key} className={`brow${r.thin ? ' brow--faded' : ''}`} style={{ gridTemplateColumns: 'minmax(0,1fr) auto', gap: '4px var(--s3)' }}>
              <span className="brow__title" style={{ display: 'flex', gap: 8, alignItems: 'baseline', minWidth: 0 }}>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.label}</span>
                <span className="small dim tnum nowrap">{r.count}</span>
              </span>
              <span className={`fig fig--s tnum ${r.netPence > 0 ? 'pos' : r.netPence < 0 ? 'neg' : ''}`}>
                {showUnits ? fmtUnits(r.units, { sign: true }) : money(r.netPence, currency, { sign: true })}
              </span>
              <span style={{ gridColumn: '1 / -1' }}>
                <span className="meter" style={{ display: 'block' }}>
                  <span
                    className={`meter__fill ${r.netPence >= 0 ? 'meter__fill--pos' : 'meter__fill--neg'}`}
                    style={{ width: `${(Math.abs(r.netPence) / peak) * 100}%` }}
                  />
                </span>
              </span>
              <span className="small dim" style={{ gridColumn: '1 / -1' }}>
                {pct(r.roi, { sign: true })} return on {money(r.turnoverPence, currency)} turnover
              </span>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
