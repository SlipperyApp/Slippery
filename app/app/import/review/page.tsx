import type { Metadata } from 'next';
import Link from 'next/link';
import { Icon } from '@/components/Icon';
import { EXAMPLE_READ } from '@/lib/data/read';
import { ReviewSlip } from '@/components/app/ReviewSlip';

export const metadata: Metadata = {
  title: 'Check what was read',
  description: 'Every field the reader found, scored on its own, before anything is written to your ledger.',
};

/** The confirm screen every Slipper meets after every slip. */
export default function Review() {
  return (
    <>
      <div className="row" style={{ marginBottom: 'var(--s4)' }}>
        <Link href="/app/import" className="btn btn--quiet btn--sm">
          <Icon name="chevronLeft" size={16} /> Add a bet
        </Link>
      </div>

      <h1>Check what was read</h1>
      <p className="muted" style={{ marginTop: 'var(--s2)', maxWidth: '62ch' }}>
        Nothing is written until you confirm. Each field is scored on its own.
      </p>

      <div style={{ marginTop: 'var(--s5)' }}>
        <ReviewSlip read={EXAMPLE_READ} />
      </div>
    </>
  );
}
