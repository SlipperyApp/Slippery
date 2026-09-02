'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Icon } from '@/components/Icon';
import {
  AXES, COLUMNS, axisLabel, defaultSort, sortCells,
  type Cell, type CrossTab, type Dir,
} from '@/lib/data/analyser';
import { useWide } from './wide';
import { THIN_BETS } from '@/lib/data/analytics';
import { count, money, pct, plural, units as fmtUnits, type Currency } from '@/lib/format';

/** The cross tab, sorted and exported.
 *
 *  THE SORT IS CLIENT SIDE AND THE FIGURES ARE NOT. Every cell arrives folded
 *  from the one selection the page made; this reorders that array and changes
 *  no number in it. A sort that went back to the server would be a second
 *  query, and two queries is how a total stops agreeing with its own rows.
 *
 *  THE GROUP COLUMN STICKS. Thirteen columns do not fit on a phone and the
 *  table scrolls, which is fine until the only column that says WHICH row you
 *  are reading has scrolled off the left. It stays.
 *
 *  AND FROM 1740 A ROW OPENS BESIDE IT. The best looking screen in the app
 *  had no detail view at all: eleven columns of figures and no way to ask
 *  what any one of them was a share of. The pane answers the question the
 *  table cannot, which is how big this group is inside the selection it was
 *  split out of, and it does it from the same cells the table draws rather
 *  than from a second query. 1740 rather than 1280, because the table's
 *  natural width is 1110 and it must not be pushed into a sideways scroll at
 *  1440, which is the width the demo happens on. */
const SPLIT_AT = 1740;

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
  const wide = useWide(SPLIT_AT);
  const [picked, setPicked] = useState<string | null>(null);

  const rows = useMemo(() => sortCells(tab, column, dir), [tab, column, dir]);
  const cell = picked ? rows.find((c) => c.key === picked) ?? null : null;

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

  /*  WHETHER IT SCROLLS, MEASURED RATHER THAN ASSUMED.
      At 390 this table is 820px inside 323, so it is two and a half phone
      widths wide and the only thing that said so was a shadow nobody could
      see. A sentence is the affordance that survives a screenshot. It is
      measured because the answer moves: one axis at 1440 now fits exactly,
      the same table crossed with a second axis does not, and a hint that is
      wrong in either direction is worse than none. Depends on the axes and
      the sort because both change the natural width. */
  const scroll = useRef<HTMLDivElement | null>(null);
  const [reach, setReach] = useState({ over: false, right: false });
  useEffect(() => {
    const el = scroll.current;
    if (!el) return;
    /*  Two answers, and they are not the same question. `over` is whether
        the table is wider than its frame at all, which is what the sentence
        under it reports; `right` is whether there is anything past the
        right edge right now, which is what draws the fade. At the far right
        the first is still true and the second is not. */
    const check = () => setReach({
      over: el.scrollWidth - el.clientWidth > 2,
      right: el.scrollWidth - el.clientWidth - el.scrollLeft > 2,
    });
    check();
    el.addEventListener('scroll', check, { passive: true });
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', check);
      return () => {
        el.removeEventListener('scroll', check);
        window.removeEventListener('resize', check);
      };
    }
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => {
      el.removeEventListener('scroll', check);
      ro.disconnect();
    };
  }, [tab, column, dir]);

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

      <div className="dsplit dsplit--xtab">
        <div>
      <div
        ref={scroll}
        className={`scroller xtab__scroll${reach.right ? ' scroller--r' : ''}`}
        tabIndex={0}
        role="region"
        aria-label="The cross tab, scrollable"
      >
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
              <tr
                key={c.key}
                className={`xtab__r${c.thin ? ' xtab__thin' : ''}${picked === c.key ? ' xtab__r--on' : ''}`}
                onClick={wide ? () => setPicked(c.key) : undefined}
                aria-current={wide ? (picked === c.key ? 'true' : 'false') : undefined}
              >
                <th scope="row" className="xtab__stick">
                  {/*  The group's name is the control, so a keyboard opens
                       the pane the same way a mouse does and the hand cursor
                       is over one thing rather than over eleven columns of
                       figures that are not controls. Under the split width
                       there is no pane, so there is no button either. */}
                  <RowName as={wide ? 'button' : 'span'} onOpen={() => setPicked(c.key)}>
                    <span className="xtab__name">{c.label}</span>
                    {c.label2 ? <span className="xtab__name2">{c.label2}</span> : null}
                    {/*  Marked on the row rather than in a legend nobody
                         reads. The figures beside it are the real ones. */}
                    {c.thin ? <span className="pill xtab__pill">Thin</span> : null}
                  </RowName>
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
        {reach.over
          ? ` ${COLUMNS.length + 1} columns: the table scrolls sideways, and the ${axisLabel(tab.axis).toLowerCase()} column stays put while it does.`
          : ''}
        {thinCount > 0
          ? ` ${thinCount} of them ${thinCount === 1 ? 'has' : 'have'} fewer than ${THIN_BETS} bets and ${thinCount === 1 ? 'is' : 'are'} marked thin. A return over three bets is a coin landing the same way twice, and the figures are shown anyway because hiding them would be a different kind of wrong.`
        : ''}
        {wide ? ' Press any row to read one group beside the table.' : ''}
      </p>
        </div>

        <aside className="dsplit__side" aria-label="The group you have open">
          {cell && wide ? (
            <GroupPane
              key={cell.key}
              cell={cell}
              total={tab.total}
              axis={axisLabel(tab.axis)}
              axis2={tab.axis2 ? axisLabel(tab.axis2) : null}
              currency={currency}
              onClose={() => setPicked(null)}
            />
          ) : (
            <div className="dpane dpane--rest">
              <Icon name="sliders" size={22} className="dpane__mark" />
              <p className="card__title">Press a group</p>
              <p className="small dim">
                A row here is a slice of one selection, and the table cannot say how big a slice.
                That opens beside it: the share of the bets, the turnover and the net that this
                group accounts for.
              </p>
            </div>
          )}
        </aside>
      </div>
    </>
  );
}

/** The first cell's contents, as a button where there is a pane to open and
 *  as plain text where there is not. */
function RowName({
  as, onOpen, children,
}: { as: 'button' | 'span'; onOpen: () => void; children: React.ReactNode }) {
  if (as === 'span') return <span className="xtab__open">{children}</span>;
  return (
    <button
      type="button"
      className="xtab__open"
      onClick={(e) => { e.stopPropagation(); onOpen(); }}
    >
      {children}
    </button>
  );
}

/** One group, beside the table.
 *
 *  EVERY FIGURE COMES FROM THE CELL AND THE TOTAL, both of which the table
 *  above is already drawing, so the pane cannot disagree with the row it was
 *  opened from. The three shares are the thing the table has no column for:
 *  a row saying +£2,336.28 does not say whether that is most of the record or
 *  a corner of it, and the two answers mean opposite things. */
function GroupPane({
  cell, total, axis, axis2, currency, onClose,
}: {
  cell: Cell;
  total: Cell;
  axis: string;
  axis2: string | null;
  currency: Currency;
  onClose: () => void;
}) {
  const share = (part: number, whole: number) => (whole === 0 ? 0 : (part / whole) * 100);
  /*  A share of the net is only an amount of anything when the two have the
      same sign. A losing group inside a winning book is minus forty per cent
      of the net, which reads as a fraction and is not one. */
  const netComparable = cell.netMinor !== 0 && total.netMinor !== 0
    && Math.sign(cell.netMinor) === Math.sign(total.netMinor);

  return (
    <div className="dpane">
      <div className="dpane__head">
        <div style={{ minWidth: 0 }}>
          <h3 className="card__title">{cell.label}</h3>
          <p className="small dim">
            {axis2 ? `${cell.label2} · ` : ''}{axis2 ? `${axis} crossed with ${axis2.toLowerCase()}` : axis}
          </p>
        </div>
        <button type="button" className="icobtn" onClick={onClose} aria-label="Close this group">
          <Icon name="close" size={18} />
        </button>
      </div>

      <p className="label">Net</p>
      <p className={`fig tnum ${cell.netMinor > 0 ? 'pos' : cell.netMinor < 0 ? 'neg' : ''}`}>
        {money(cell.netMinor, currency, { sign: true })}
      </p>
      <p className="small dim" style={{ marginTop: 4 }}>
        {pct(cell.roi, { sign: true })} on {money(cell.turnoverMinor, currency)} of turnover
        {cell.thin ? `, over ${plural(cell.bets, 'bet')}, which is too few to read` : ''}.
      </p>

      <ul className="dpane__rows">
        <li className="brow">
          <span style={{ minWidth: 0 }}>
            <span className="brow__title">Bets</span>
            <span className="brow__sub">
              {cell.won} won, {cell.lost} lost{cell.voided > 0 ? `, ${cell.voided} void` : ''}
              {cell.placed > 0 ? `, ${cell.placed} placed` : ''}
            </span>
          </span>
          <span className="fig fig--s tnum">{count(cell.bets)}</span>
        </li>
        <li className="brow">
          <span className="brow__title">Staked</span>
          <span className="fig fig--s tnum">{money(cell.stakedMinor, currency)}</span>
        </li>
        <li className="brow">
          <span className="brow__title">Returned</span>
          <span className="fig fig--s tnum">{money(cell.returnedMinor, currency)}</span>
        </li>
        <li className="brow">
          <span className="brow__title">Units</span>
          <span className={`fig fig--s tnum ${cell.units > 0 ? 'pos' : cell.units < 0 ? 'neg' : ''}`}>
            {fmtUnits(cell.units, { sign: true })}
          </span>
        </li>
        <li className="brow">
          <span className="brow__title">Win rate</span>
          <span className="fig fig--s tnum">{pct(cell.winRate)}</span>
        </li>
        <li className="brow">
          <span className="brow__title">Average price</span>
          <span className="fig fig--s tnum">{cell.avgOdds > 0 ? cell.avgOdds.toFixed(2) : '–'}</span>
        </li>
      </ul>

      <div className="card__foot">
        <p className="label">Share of the selection</p>
        <ul style={{ marginTop: 'var(--s2)' }}>
          <li className="brow">
            <span className="brow__title">Of the bets</span>
            <span className="fig fig--s tnum">{pct(share(cell.bets, total.bets))}</span>
          </li>
          <li className="brow">
            <span className="brow__title">Of the turnover</span>
            <span className="fig fig--s tnum">{pct(share(cell.turnoverMinor, total.turnoverMinor))}</span>
          </li>
          <li className="brow">
            <span style={{ minWidth: 0 }}>
              <span className="brow__title">Of the net</span>
              {!netComparable
                ? <span className="brow__sub">Not a share: it runs the other way from the total</span>
                : null}
            </span>
            <span className="fig fig--s tnum">
              {netComparable ? pct(share(cell.netMinor, total.netMinor)) : '–'}
            </span>
          </li>
        </ul>
      </div>
    </div>
  );
}

/** Which way the pressed column is sorted. An SVG rather than a caret glyph:
 *  a text arrow rasterises from the system font and cannot take a colour. */
function SortMark({ on, dir }: { on: boolean; dir: Dir }) {
  if (!on) return <Icon name="sort" size={12} className="xtab__sort xtab__sort--off" />;
  return <Icon name={dir === 'asc' ? 'chevronUp' : 'chevronDown'} size={12} className="xtab__sort" />;
}
