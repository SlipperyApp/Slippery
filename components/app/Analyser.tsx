'use client';

import { useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Icon } from '@/components/Icon';
import {
  AXES, COLUMNS, axisLabel, defaultSort, sortCells,
  type CrossTab, type Dir,
} from '@/lib/data/analyser';
import { THIN_BETS } from '@/lib/data/analytics';
import { money, pct, units as fmtUnits, type Currency } from '@/lib/format';

/** The cross tab, sorted and exported.
 *
 *  THE SORT IS CLIENT SIDE AND THE FIGURES ARE NOT. Every cell arrives folded
 *  from the one selection the page made; this reorders that array and changes
 *  no number in it. A sort that went back to the server would be a second
 *  query, and two queries is how a total stops agreeing with its own rows.
 *
 *  THE GROUP COLUMN STICKS. Thirteen columns do not fit on a phone and the
 *  table scrolls, which is fine until the only column that says WHICH row you
 *  are reading has scrolled off the left. It stays. */
export function Analyser({
  tab, currency, thinCount,
}: {
  tab: CrossTab;
  currency: Currency;
  /** How many rows are under the threshold, for the sentence under the
   *  table. Counted from the same cells the table draws. */
  thinCount: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const initial = defaultSort(tab.axis);
  const [column, setColumn] = useState(initial.column);
  const [dir, setDir] = useState<Dir>(initial.dir);

  const rows = useMemo(() => sortCells(tab, column, dir), [tab, column, dir]);

  const set = (key: string, value: string) => {
    const next = new URLSearchParams(params?.toString() ?? '');
    if (!value || value === 'none') next.delete(key);
    else next.set(key, value);
    const q = next.toString();
    router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
  };

  const press = (id: string) => {
    if (id === column) { setDir(dir === 'asc' ? 'desc' : 'asc'); return; }
    setColumn(id);
    /*  A new column starts on the reading that answers the question: biggest
        first for a figure, A to Z for the name. Keeping the previous
        direction meant pressing Net gave you the worst rows at the top. */
    setDir(id === 'group' ? 'asc' : 'desc');
  };

  /*  The export carries the view: the same axes, the same scope and the same
      sort, so the file is the table. Built from the URL the page is already
      on, which is where the scope lives. */
  const exportHref = (() => {
    const q = new URLSearchParams(params?.toString() ?? '');
    q.set('sort', column);
    q.set('dir', dir);
    return `/api/analysis?${q.toString()}`;
  })();

  const aria = (id: string) => (column === id ? (dir === 'asc' ? 'ascending' : 'descending') : 'none');

  const value = (kind: string, v: number | string, signed = false) => {
    switch (kind) {
      case 'money': return money(Number(v), currency, { sign: signed });
      case 'pct': return pct(Number(v), { sign: true });
      case 'units': return fmtUnits(Number(v), { sign: true });
      case 'odds': return Number(v) > 0 ? Number(v).toFixed(2) : '';
      default: return String(v);
    }
  };

  return (
    <>
      <div className="xtab__tools">
        <div className="field field--inline">
          <label className="field__label" htmlFor="xt-dim">Break down by</label>
          <select
            id="xt-dim"
            className="select"
            value={tab.axis}
            onChange={(e) => set('dim', e.target.value)}
          >
            {AXES.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
          </select>
        </div>

        <div className="field field--inline">
          <label className="field__label" htmlFor="xt-dim2">And cross it with</label>
          <select
            id="xt-dim2"
            className="select"
            value={tab.axis2 ?? 'none'}
            onChange={(e) => set('dim2', e.target.value)}
          >
            <option value="none">Nothing</option>
            {AXES.filter((a) => a.id !== tab.axis).map((a) => (
              <option key={a.id} value={a.id}>{a.label}</option>
            ))}
          </select>
        </div>

        <a className="btn btn--quiet btn--sm xtab__dl" href={exportHref} download>
          <Icon name="download" size={16} /> Export this view
        </a>
      </div>

      <div className="scroller xtab__scroll" tabIndex={0} role="region" aria-label="The cross tab, scrollable">
        <table className="tbl xtab">
          <caption className="sr-only">
            {axisLabel(tab.axis)}{tab.axis2 ? ` crossed with ${axisLabel(tab.axis2)}` : ''},
            {' '}{tab.rows.length} groups over {tab.total.bets} bets.
          </caption>
          <thead>
            <tr>
              <th scope="col" className="xtab__stick" aria-sort={aria('group')}>
                <button type="button" className="xtab__h" onClick={() => press('group')}>
                  {axisLabel(tab.axis)}{tab.axis2 ? ` · ${axisLabel(tab.axis2)}` : ''}
                  <SortMark on={column === 'group'} dir={dir} />
                </button>
              </th>
              {COLUMNS.map((c) => (
                <th key={c.id} scope="col" className="num" aria-sort={aria(c.id)}>
                  <button type="button" className="xtab__h" onClick={() => press(c.id)}>
                    {c.label}
                    <SortMark on={column === c.id} dir={dir} />
                  </button>
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {rows.map((c) => (
              <tr key={c.key} className={c.thin ? 'xtab__thin' : undefined}>
                <th scope="row" className="xtab__stick">
                  <span className="xtab__name">{c.label}</span>
                  {c.label2 ? <span className="xtab__name2">{c.label2}</span> : null}
                  {/*  Marked on the row rather than in a legend nobody
                       reads. The figures beside it are the real ones. */}
                  {c.thin ? <span className="pill xtab__pill">Thin</span> : null}
                </th>
                {COLUMNS.map((col) => {
                  const v = col.get(c);
                  const tone = col.id === 'net' || col.id === 'roi'
                    ? (Number(v) > 0 ? 'pos' : Number(v) < 0 ? 'neg' : '')
                    : '';
                  return (
                    <td key={col.id} className={`num tnum ${tone}`}>
                      {value(col.kind, v, col.signed)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>

          <tfoot>
            {/*  THE TOTAL IS FOLDED FROM THE WHOLE SELECTION, not added up
                 from the rows above it. If the two ever disagree the table
                 says so on its own face, which is the only way an analyser
                 can be trusted at all. */}
            <tr>
              <th scope="row" className="xtab__stick">All {tab.total.bets} bets</th>
              {COLUMNS.map((col) => {
                const v = col.get(tab.total);
                const tone = col.id === 'net' || col.id === 'roi'
                  ? (Number(v) > 0 ? 'pos' : Number(v) < 0 ? 'neg' : '')
                  : '';
                return <td key={col.id} className={`num tnum ${tone}`}>{value(col.kind, v, col.signed)}</td>;
              })}
            </tr>
          </tfoot>
        </table>
      </div>

      <p className="small dim" style={{ marginTop: 'var(--s4)' }}>
        {rows.length} {rows.length === 1 ? 'group' : 'groups'}, and they add up to the total row:
        every figure here is folded from the one selection above, split once.
        {thinCount > 0
          ? ` ${thinCount} of them ${thinCount === 1 ? 'has' : 'have'} fewer than ${THIN_BETS} bets and ${thinCount === 1 ? 'is' : 'are'} marked thin. A return over three bets is a coin landing the same way twice, and the figures are shown anyway because hiding them would be a different kind of wrong.`
        : ''}
      </p>
    </>
  );
}

/** Which way the pressed column is sorted. An SVG rather than a caret glyph:
 *  a text arrow rasterises from the system font and cannot take a colour. */
function SortMark({ on, dir }: { on: boolean; dir: Dir }) {
  if (!on) return <Icon name="sort" size={12} className="xtab__sort xtab__sort--off" />;
  return <Icon name={dir === 'asc' ? 'chevronUp' : 'chevronDown'} size={12} className="xtab__sort" />;
}
