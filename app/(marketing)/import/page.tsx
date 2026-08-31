import type { Metadata } from 'next';
import Link from 'next/link';
import { Icon } from '@/components/Icon';
import { SectionHead, Checks, RowList } from '@/components/MarketingChrome';

export const metadata: Metadata = {
  title: 'Import a history',
  description:
    'Bring a history in from a spreadsheet or another tracker. Dry run first, counts reported before anything is written, and nothing that cannot be split reliably is guessed at.',
  alternates: { canonical: '/import' },
  openGraph: {
    title: 'Import a history into Slippery',
    description: 'Dry run first. Counts before writes. Nothing guessed.',
    url: '/import',
    images: [{ url: '/og?title=Import+a+history&sub=Dry+run+first%2C+always', width: 1200, height: 630, alt: 'Import a history into Slippery' }],
  },
};

export default function ImportPage() {
  return (
    <>
      <section className="sect" style={{ paddingBottom: 'var(--s7)' }}>
        <div className="wrap">
          <span className="pill">Import</span>
          <h1 className="sect__h" style={{ marginTop: 'var(--s4)', fontSize: 'clamp(30px, 6vw, 52px)' }}>
            <span className="setup">Bring the old record with you.</span>
            <span>The dry run goes first, always.</span>
          </h1>
          <p className="sect__p">
            A CSV from a spreadsheet or another tracker. Slippery reads it, reports exactly what it
            would create, and writes nothing until you say so.
          </p>
        </div>
      </section>

      <section className="sect" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <div className="two">
            <RowList
              rows={[
                { title: 'Export from old tracker', sub: 'CSV or JSON. Column names are matched, not assumed.', icon: 'download', on: true },
                { title: 'Dry run', sub: 'Counts, per row: create, merge, skip, needs you.', icon: 'eye' },
                { title: 'Resolve what cannot be split', sub: 'A selection with an ampersand in the team name is asked about, never guessed.', icon: 'split' },
                { title: 'Write, once', sub: 'Everything imported is marked as imported and is not slip backed.', icon: 'check' },
              ]}
            />
            <div className="card">
              <p className="label">Dry run, example</p>
              <ul style={{ marginTop: 'var(--s3)' }}>
                {[
                  ['Rows read', '1,284'],
                  ['Would create', '1,197'],
                  ['Would merge into an existing bet', '54'],
                  ['Duplicate, would skip', '19'],
                  ['Cannot split reliably, needs you', '14'],
                ].map(([k, v]) => (
                  <li key={k} className="brow">
                    <span className="brow__title">{k}</span>
                    <span className="fig fig--s tnum">{v}</span>
                  </li>
                ))}
              </ul>
              <p className="small muted card__foot">
                Nothing is written by a dry run. The fourteen it cannot split go to a resolve step
                where you see the original text and pick, one at a time.
              </p>
            </div>
          </div>

          <Checks
            items={[
              'Duplicates matched on selection, stake, bookmaker and kick-off',
              'Multiples re-derived into real legs, never joined with an ampersand',
              'Imported bets are marked and are not slip backed',
              'Every mutation writes an audit line with its source',
            ]}
          />

          <div className="card" style={{ marginTop: 'var(--s6)', alignItems: 'flex-start' }}>
            <p className="card__title">Start an import</p>
            <p className="small muted" style={{ marginTop: 'var(--s2)', maxWidth: '56ch' }}>
              A history of a few thousand rows takes under a minute to dry run. You will see the
              counts before anything touches your ledger.
            </p>
            <Link href="/app/import/history" className="btn btn--primary" style={{ marginTop: 'var(--s5)' }}>
              Import a history <Icon name="arrowRight" size={16} />
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
