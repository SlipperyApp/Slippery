import type { Metadata } from 'next';
import Link from 'next/link';
import { Icon } from '@/components/Icon';
import { COLUMN_GUESSES } from '@/lib/data/importing';

export const metadata: Metadata = {
  title: 'Match the columns',
  description: 'What was matched to what, and everything the importer is not sure about.',
};

export default function HistoryReview() {
  return (
    <>
      <div className="row" style={{ marginBottom: 'var(--s4)' }}>
        <Link href="/app/import/history" className="btn btn--quiet btn--sm">
          <Icon name="chevronLeft" size={16} /> Import a history
        </Link>
      </div>
      <div className="column column--wide" style={{ marginInline: 0 }}>
        <h1>Match the columns</h1>
        <p className="muted" style={{ marginTop: 'var(--s2)', maxWidth: '60ch' }}>
          Matched on the header names in your file, never on position. Two are marked as guesses.
        </p>

        <div className="card" style={{ marginTop: 'var(--s5)' }}>
          <div className="scroller" tabIndex={0} role="region" aria-label="Column matches, scrollable">
            <table className="tbl">
              <caption className="sr-only">Column matches</caption>
              <thead>
                <tr><th scope="col">In your file</th><th scope="col">Becomes</th><th scope="col">Confidence</th></tr>
              </thead>
              <tbody>
                {COLUMN_GUESSES.map((c) => (
                  <tr key={c.theirs}>
                    <td className="mono">{c.theirs}</td>
                    <td>{c.ours}</td>
                    <td>
                      <span className={`pill ${c.sure ? 'pill--pos' : ''}`}>{c.sure ? 'Matched' : 'A guess'}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="small dim card__foot">
            A guess is still shown to you before anything is read from it. Nothing in this table
            has been written anywhere yet.
          </p>
        </div>

        <div className="row" style={{ marginTop: 'var(--s5)', gap: 'var(--s3)' }}>
          <Link href="/app/import/history/dry-run" className="btn btn--primary grow">
            Dry run <Icon name="arrowRight" size={16} />
          </Link>
          <Link href="/app/import/history" className="btn btn--link">Choose a different file</Link>
        </div>
      </div>
    </>
  );
}
