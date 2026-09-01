import type { Metadata } from 'next';
import Link from 'next/link';
import { Icon } from '@/components/Icon';
import { UNRESOLVED } from '@/lib/data/importing';
import { Resolver } from '@/components/app/Resolver';

export const metadata: Metadata = {
  title: 'Combined selections',
  description: 'Rows that cannot be split reliably, one at a time, with the original text.',
};

export default function Resolve() {
  return (
    <>
      <div className="row" style={{ marginBottom: 'var(--gap-block)' }}>
        <Link href="/app/import/history/dry-run" className="btn btn--quiet btn--sm">
          <Icon name="chevronLeft" size={16} /> Dry run
        </Link>
      </div>
      <div className="column column--wide" style={{ marginInline: 0 }}>
        <h1>Combined selections</h1>
        <p className="muted" style={{ marginTop: 'var(--s2)' }}>
          These rows have an ampersand in them, and the importer cannot tell whether it joins two
          selections or sits inside one name. It asks rather than guessing.
        </p>
        <div style={{ marginTop: 'var(--s5)' }}><Resolver items={UNRESOLVED} /></div>
      </div>
    </>
  );
}
