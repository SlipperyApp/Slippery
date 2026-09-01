import type { Metadata } from 'next';
import Link from 'next/link';
import { Icon } from '@/components/Icon';
import { HistoryUpload } from '@/components/app/HistoryUpload';

export const metadata: Metadata = {
  title: 'Import a history',
  description: 'Bring a history in from a spreadsheet or another tracker. The dry run goes first, always.',
};

export default function ImportHistory() {
  return (
    <>
      <div className="row" style={{ marginBottom: 'var(--gap-block)' }}>
        <Link href="/app/import" className="btn btn--quiet btn--sm">
          <Icon name="chevronLeft" size={16} /> Add a bet
        </Link>
      </div>
      <div className="column column--wide" style={{ marginInline: 0 }}>
        <h1>Import a history</h1>
        <p className="muted" style={{ marginTop: 'var(--s2)' }}>
          A CSV or JSON export from a spreadsheet or another tracker. Slippery reads it, reports
          exactly what it would create, and writes nothing until you say so.
        </p>
        <div style={{ marginTop: 'var(--s5)' }}><HistoryUpload /></div>
      </div>
    </>
  );
}
