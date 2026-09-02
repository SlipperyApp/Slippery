import Link from 'next/link';
import { units as fmtUnits, initials, pct, plural, position as fmtPosition } from '@/lib/format';
import type { LeagueRow } from '@/lib/data/social';

/** One row of a table, and every figure on it folded from one record.
 *
 *  The row takes `r.record` and never picks a field by period itself. It used
 *  to read `r[period === 'month' ? 'unitsMonth' : 'unitsAllTime']`, which
 *  meant the component decided the period a second time, and a return worked
 *  out anywhere else would have been a return over a different set of bets
 *  from the units beside it.
 *
 *  Position renders as a place out of a field, with the top three marked.
 *  Gold, silver and bronze are classes rather than colour literals, so they
 *  theme, and neither sits near the profit or loss colour. */
export function LeagueLine({
  row, mine = false, showEdits = false, showSlipBacked = true,
}: {
  row: LeagueRow;
  mine?: boolean;
  showEdits?: boolean;
  showSlipBacked?: boolean;
}) {
  const r = row.record;
  /*  Under five bets the row is marked, using the treatment the breakdown
      already uses for the same reason: profit without volume ranks one lucky
      bet above forty disciplined ones, and a hundred per cent return off a
      single winner is the loudest figure on the table. The bet count beside
      the name says the same thing in words; this is the version somebody
      scanning a column sees. */
  const thin = r.bets < 5;
  return (
    <li className={`brow lb__row${thin ? ' brow--faded' : ''}${mine ? ' lb__row--you' : ''}`}>
      <span className={`small tnum medal medal--${row.position <= 3 ? row.position : 'none'}`} style={{ fontWeight: 600 }}>
        {row.position}
      </span>
      <span className="avatar" aria-hidden="true">{initials(row.name)}</span>
      <span style={{ minWidth: 0 }}>
        <Link href={`/app/social/person?handle=${row.handle}`} className="brow__title" style={{ textDecoration: 'none' }}>
          {/*  A margin, not a leading space. a.brow__title is inline-flex
               for the tap-target floor, and a flex item's leading
               whitespace is trimmed, so the row read "Tester(you)". */}
          {row.name}{mine ? <span className="dim league__you">(you)</span> : null}
        </Link>
        <span className="brow__sub" style={{ display: 'block' }}>
          <span className="mono">@{row.handle}</span>
          {r.bets === 0
            ? <> · no bets in this table yet</>
            : <> · {r.wins} W, {r.losses} L · {plural(r.bets, 'bet')}</>}
          {showSlipBacked ? <> · {row.slipBackedPct}% slip backed</> : null}
          {showEdits && row.lateEdits > 0 ? <> · {row.lateEdits} late edit{row.lateEdits === 1 ? '' : 's'}</> : null}
        </span>
      </span>
      <span className="lb__fig">
        <span className={`fig fig--s tnum ${r.units > 0 ? 'pos' : r.units < 0 ? 'neg' : ''}`}>
          {fmtUnits(r.units, { league: true, sign: true })}
        </span>
        {/*  A RETURN OVER FOUR BETS IS NOT A RETURN, it is the price of one
             of them. On the second of a month every row had one bet and the
             column read plus four hundred and ninety two per cent beside
             minus a hundred, which is the loudest and least useful figure on
             the table. Under five it is a dash, and the bet count beside the
             name says why. The units still show, because units are what the
             table is ranked on and that is a fact whatever the volume. */}
        <span className="small dim tnum">
          {thin ? '–' : `${pct(r.roi, { sign: true })} return`}
        </span>
      </span>
    </li>
  );
}

export function League({
  rows, you = 'tester123', showEdits = false, showSlipBacked = true,
}: {
  rows: LeagueRow[];
  you?: string;
  showEdits?: boolean;
  showSlipBacked?: boolean;
}) {
  /*  The note lives with the thing it explains rather than in each page's
      footer, so a board cannot grow a marked row and lose the sentence that
      says what the mark means. */
  const anyThin = rows.some((r) => r.record.bets < 5);
  return (
    <>
      <ul>
        {rows.map((r) => (
          <LeagueLine
            key={r.handle}
            row={r}
            mine={r.handle === you}
            showEdits={showEdits}
            showSlipBacked={showSlipBacked}
          />
        ))}
      </ul>
      {anyThin ? (
        <p className="small dim lb__note">
          A row marked down the left has fewer than five bets in this table, and its return is
          left out rather than worked out over one of them.
        </p>
      ) : null}
    </>
  );
}

export function PositionLine({ rank, of }: { rank: number; of: number }) {
  return (
    <p className="small muted">
      You are <span className={`medal medal--${rank <= 3 ? rank : 'none'}`} style={{ fontWeight: 600 }}>{fmtPosition(rank, of)}</span>.
    </p>
  );
}
