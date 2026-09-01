import type { Metadata } from 'next';
import Link from 'next/link';
import { Icon } from '@/components/Icon';
import { DRY_RUN } from '@/lib/data/importing';
import { count } from '@/lib/format';

export const metadata: Metadata = {
  title: 'Dry run',
  description: 'The counts it would write. Nothing has been written.',
};

const ROWS: { k: keyof typeof DRY_RUN; t: string; s: string }[] = [
  { k: 'rowsRead', t: 'Rows read', s: 'Every data row in the file, header excluded.' },
  { k: 'wouldCreate', t: 'Would create', s: 'New bets, each marked as imported and not slip backed.' },
  { k: 'wouldMerge', t: 'Would merge', s: 'Matched an existing bet on selection, stake, bookmaker and kick-off.' },
  { k: 'duplicateSkip', t: 'Duplicate, would skip', s: 'Identical to something already in your ledger.' },
  { k: 'needsYou', t: 'Cannot split reliably', s: 'A selection with an ampersand inside a name. Never guessed.' },
  { k: 'unparseable', t: 'Unreadable', s: 'A row with no usable stake or price at all.' },
];

export default function DryRun() {
  return (
    <>
      <div className="row" style={{ marginBottom: 'var(--gap-block)' }}>
        <Link href="/app/import/history/review" className="btn btn--quiet btn--sm">
          <Icon name="chevronLeft" size={16} /> Match the columns
        </Link>
      </div>
      <div className="column column--wide" style={{ marginInline: 0 }}>
        <span className="pill">Nothing written</span>
        <h1 style={{ marginTop: 'var(--s4)' }}>Dry run</h1>
        <p className="muted" style={{ marginTop: 'var(--s2)' }}>
          This is what the import would do. Your ledger has not been touched and you can close this
          tab with no consequence at all.
        </p>

        <div className="card" style={{ marginTop: 'var(--s5)' }}>
          <ul>
            {ROWS.map((r) => (
              <li key={r.k} className="brow">
                <span style={{ minWidth: 0 }}>
                  <span className="brow__title" style={{ display: 'block' }}>{r.t}</span>
                  <span className="brow__sub">{r.s}</span>
                </span>
                <span className={`fig fig--s tnum ${r.k === 'needsYou' && DRY_RUN[r.k] > 0 ? 'neg' : ''}`}>
                  {count(DRY_RUN[r.k])}
                </span>
              </li>
            ))}
          </ul>
          <p className="small dim card__foot">
            {count(DRY_RUN.wouldCreate + DRY_RUN.wouldMerge)} of {count(DRY_RUN.rowsRead)} rows would
            land. The counts above add up to the rows read, which is the point of showing them.
          </p>
        </div>

        <div className="row" style={{ marginTop: 'var(--s5)', gap: 'var(--s3)', flexWrap: 'wrap' }}>
          <Link href="/app/import/history/resolve" className="btn btn--primary grow">
            Resolve the {DRY_RUN.needsYou} that cannot be split <Icon name="arrowRight" size={16} />
          </Link>
          <Link href="/app/import/history" className="btn btn--link">Start again with another file</Link>
        </div>
      </div>
    </>
  );
}
