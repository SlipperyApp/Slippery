import type { Metadata } from 'next';
import Link from 'next/link';
import { Icon } from '@/components/Icon';
import { DRY_RUN } from '@/lib/data/importing';
import { count } from '@/lib/format';

export const metadata: Metadata = {
  title: 'Import written',
  description: 'What landed, what was skipped, and where it went.',
};

export default function ImportDone() {
  const landed = DRY_RUN.wouldCreate + DRY_RUN.wouldMerge;
  return (
    <div className="column column--wide">
      <span className="pill pill--pos">Written</span>
      <h1 style={{ marginTop: 'var(--s4)' }}>{count(landed)} bets are in your ledger</h1>
      <p className="muted" style={{ marginTop: 'var(--s2)', maxWidth: '60ch' }}>
        One transaction, every row marked imported and not slip backed, so a group filtering on slip backed bets sees these for what they are.
      </p>

      <div className="card" style={{ marginTop: 'var(--s5)' }}>
        <ul>
          {[
            ['Created', DRY_RUN.wouldCreate, 'New bets, each with its first settlement event.'],
            ['Merged', DRY_RUN.wouldMerge, 'Matched an existing bet rather than doubling it.'],
            ['Skipped as duplicates', DRY_RUN.duplicateSkip, 'Already in your ledger, identical.'],
            ['Left out by you', DRY_RUN.needsYou, 'The combined selections you chose not to import.'],
          ].map(([t, n, s]) => (
            <li key={String(t)} className="brow">
              <span style={{ minWidth: 0 }}>
                <span className="brow__title" style={{ display: 'block' }}>{t}</span>
                <span className="brow__sub">{s}</span>
              </span>
              <span className="fig fig--s tnum">{count(Number(n))}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="row" style={{ marginTop: 'var(--s5)', gap: 'var(--s3)', flexWrap: 'wrap' }}>
        <Link href="/app/ledger" className="btn btn--primary">
          Open the ledger <Icon name="arrowRight" size={16} />
        </Link>
        <Link href="/app" className="btn btn--ghost">See the dashboard</Link>
        <Link href="/app/history" className="btn btn--link">The audit trail for this import</Link>
      </div>

      <p className="small dim" style={{ marginTop: 'var(--s5)' }}>
        Imported bets carry a source of <span className="mono">csv_import</span> in your change history.
      </p>
    </div>
  );
}
