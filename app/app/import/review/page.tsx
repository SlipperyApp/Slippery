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

      {/*  THE READ SCROLLS AND THE HEADING DOES NOT. Measured at 1440 by 900
           this screen was 1,532 pixels against the 824 the window leaves, so
           the three promotion switches and the line saying what the bet as
           flagged returns were both under the fold on the screen whose whole
           job is checking a read before it is filed. */}
      <div className="fitcol fitcol--scroll" style={{ marginTop: 'var(--s5)' }}>
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
