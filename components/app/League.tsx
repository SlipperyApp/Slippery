import Link from 'next/link';
import { units as fmtUnits, initials, position as fmtPosition } from '@/lib/format';
import type { LeagueRow } from '@/lib/data/social';

/** Position renders as a place out of a field, with the top three marked.
 *  Gold, silver and bronze are classes rather than colour literals, so they
 *  theme, and neither sits near the profit or loss colour. */
export function League({
  rows, you = 'tester123', showEdits = false, showSlipBacked = true, period = 'month',
}: {
  rows: LeagueRow[];
  you?: string;
  showEdits?: boolean;
  showSlipBacked?: boolean;
  period?: 'month' | 'year' | 'all';
}) {
  const key = period === 'month' ? 'unitsMonth' : 'unitsAllTime';
  return (
    <ul>
      {rows.map((r) => {
        const v = r[key] as number;
        const mine = r.handle === you;
        return (
          <li
            key={r.handle}
            className="brow"
            style={{
              gridTemplateColumns: '30px 30px minmax(0,1fr) auto',
              gap: 'var(--s3)',
              ...(mine ? { background: 'color-mix(in oklab, var(--accent) 7%, transparent)', borderRadius: 'var(--r-sm)' } : {}),
            }}
          >
            <span className={`small tnum medal medal--${r.position <= 3 ? r.position : 'none'}`} style={{ fontWeight: 600 }}>
              {r.position}
            </span>
            <span className="avatar" aria-hidden="true">{initials(r.name)}</span>
            <span style={{ minWidth: 0 }}>
              <Link href={`/app/social/person?handle=${r.handle}`} className="brow__title" style={{ textDecoration: 'none' }}>
                {/*  A margin, not a leading space. a.brow__title is inline-flex
                     for the tap-target floor, and a flex item's leading
                     whitespace is trimmed, so the row read "Tester(you)". */}
                {r.name}{mine ? <span className="dim league__you">(you)</span> : null}
              </Link>
              <span className="brow__sub" style={{ display: 'block' }}>
                <span className="mono">@{r.handle}</span>
                {showSlipBacked ? <> · {r.slipBackedPct}% slip backed</> : null}
                {showEdits && r.lateEdits > 0 ? <> · {r.lateEdits} late edit{r.lateEdits === 1 ? '' : 's'}</> : null}
              </span>
            </span>
            <span className={`fig fig--s tnum ${v > 0 ? 'pos' : v < 0 ? 'neg' : ''}`}>
              {fmtUnits(v, { league: true, sign: true })}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

export function PositionLine({ rank, of }: { rank: number; of: number }) {
  return (
    <p className="small muted">
      You are <span className={`medal medal--${rank <= 3 ? rank : 'none'}`} style={{ fontWeight: 600 }}>{fmtPosition(rank, of)}</span>.
    </p>
  );
}
