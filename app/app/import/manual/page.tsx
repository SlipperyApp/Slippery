import type { Metadata } from 'next';
import Link from 'next/link';
import { Icon } from '@/components/Icon';
import { getViewer } from '@/lib/data/session';
import { ManualEntry } from '@/components/app/ManualEntry';
import { ALL_BOOKMAKERS, SPORTS } from '@/lib/data/reference';

export const metadata: Metadata = {
  title: 'Type it in',
  description: 'A single, a multiple, an each way or a permed bet. Manual entry that cannot record a multiple is a hole under the bet type the landing page opens with.',
};

export default async function Manual() {
  const { data } = await getViewer();
  return (
    <>
      <div className="row" style={{ marginBottom: 'var(--s4)' }}>
        <Link href="/app/import" className="btn btn--quiet btn--sm">
          <Icon name="chevronLeft" size={16} /> Add a bet
        </Link>
      </div>
      <h1>Type it in</h1>
      <p className="muted" style={{ marginTop: 'var(--s2)', maxWidth: '58ch' }}>
        A typed-in bet counts everywhere a captured one does, and is marked as typed in, which is
        what a group&rsquo;s slip backed filter reads.
      </p>
      <div style={{ marginTop: 'var(--s5)' }}>
        <ManualEntry
          bookmakers={ALL_BOOKMAKERS.map((b) => ({ id: b.id, name: b.name }))}
          sports={SPORTS.map((s) => ({ id: s.id, name: s.name }))}
          unitPence={data.account.unitPence}
          currency={data.account.currency}
        />
      </div>
    </>
  );
}
