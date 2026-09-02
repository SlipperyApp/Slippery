import type { Metadata } from 'next';
import Link from 'next/link';
import { Icon } from '@/components/Icon';
import { EXAMPLE_READ } from '@/lib/data/read';
import { ReviewSlip } from '@/components/app/ReviewSlip';
import { getViewer } from '@/lib/data/session';

export const metadata: Metadata = {
  title: 'Check what was read',
  description: 'Every field the reader found, scored on its own, before anything is written to your ledger.',
};

/** The confirm screen every Slipper meets after every slip. */
export default async function Review() {
  /*  The balances come from the server rather than the flow, because the flow
      holds what was READ and this is a question about the account. The one
      that is open is where the slip lands, and the screen has to say so
      before the write rather than after it. */
  const { balances, balance } = await getViewer();
  return (
    <>
      <div className="row" style={{ marginBottom: 'var(--gap-block)' }}>
        <Link href="/app/import" className="btn btn--quiet btn--sm">
          <Icon name="chevronLeft" size={16} /> Add a bet
        </Link>
      </div>

      <h1>Check what was read</h1>
      <p className="muted" style={{ marginTop: 'var(--s2)' }}>
        Nothing is written until you confirm. Each field is scored on its own, and anything the
        reader was not sure of arrives as a question with an empty box rather than a plausible
        number already filled in.
      </p>

      <div style={{ marginTop: 'var(--s5)' }}>
        <ReviewSlip
          fallback={EXAMPLE_READ}
          balances={balances.map((b) => ({ id: b.id, name: b.name, currency: b.currency }))}
          balanceId={balance.id}
          unitMinor={balance.unitMinor}
        />
      </div>
    </>
  );
}
