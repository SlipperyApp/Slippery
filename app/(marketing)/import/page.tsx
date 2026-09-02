import type { Metadata } from 'next';
import Link from 'next/link';
import { Icon } from '@/components/Icon';
import { Checks, RowList, EndCard } from '@/components/MarketingChrome';
import { Breadcrumbs } from '@/components/marketing/Breadcrumbs';
import { StickyCta } from '@/components/marketing/StickyCta';

export const metadata: Metadata = {
  title: 'Import a history',
  description:
    'Bring a history in from a spreadsheet or another tracker. Dry run first, counts before writes, nothing guessed.',
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
          <Breadcrumbs trail={[{ href: '/', label: 'Slippery' }]} page="Import a history" />
          <h1 className="sect__h" style={{ fontSize: 'clamp(30px, 6vw, 52px)' }}>
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
                The fourteen go to a resolve step, one at a time.
              </p>
            </div>
          </div>

          <Checks
            items={[
              'Duplicates matched on selection, stake, bookmaker and kick-off',
              'Multiples re-derived into real legs',
              'Every mutation writes an audit line with its source',
            ]}
          />

          <div style={{ marginTop: 'var(--s6)' }}>
            <EndCard
              title="Start an import"
              actions={
                <Link href="/app/import/history" className="btn btn--primary">
                  Import a history <Icon name="arrowRight" size={16} />
                </Link>
              }
            />
          </div>
        </div>
      </section>
      <StickyCta />
    </>
  );
}
