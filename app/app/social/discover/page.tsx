import type { Metadata } from 'next';
import Link from 'next/link';
import { Icon } from '@/components/Icon';
import { getViewer } from '@/lib/data/session';
import { groupSummaries, slippers } from '@/lib/data/social';
import { Discover } from '@/components/app/Discover';

export const metadata: Metadata = {
  title: 'Find Slippers',
  description: 'Search groups and Slippers. Popular, newest, or A to Z.',
};

export default async function DiscoverPage() {
  const { now } = await getViewer();
  return (
    <>
      <div className="row" style={{ marginBottom: 'var(--s4)' }}>
        <Link href="/app/social" className="btn btn--quiet btn--sm">
          <Icon name="chevronLeft" size={16} /> Social
        </Link>
      </div>
      <h1>Find Slippers</h1>
      <p className="muted" style={{ marginTop: 'var(--s2)', maxWidth: '58ch' }}>
        Search a group name or a handle. Nothing here shows anybody&rsquo;s stakes, in a group or
        out of one.
      </p>
      <div style={{ marginTop: 'var(--s5)' }}>
        <Discover groups={groupSummaries(now)} people={slippers(now)} />
      </div>
    </>
  );
}
