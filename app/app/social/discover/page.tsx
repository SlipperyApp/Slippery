import type { Metadata } from 'next';
import Link from 'next/link';
import { Icon } from '@/components/Icon';
import { getViewer } from '@/lib/data/session';
import { EmptySocial, SOCIAL_EXAMPLE_NOTE } from '@/components/app/EmptySocial';
import { groupSummaries, slippers } from '@/lib/data/social';
import { Discover } from '@/components/app/Discover';

export const metadata: Metadata = {
  title: 'Find Slippers',
  description: 'Search groups and Slippers. Popular, newest, or A to Z.',
};

export default async function DiscoverPage() {
  const { now, source } = await getViewer();

  /*  THE SOCIAL GRAPH ON THIS SCREEN IS THE EXAMPLE ACCOUNT'S. It is folded
      out of lib/data/social.ts, which invents the Slippers around
      @tester123, so showing it to a signed-in account would place that
      person first in a league of bets they never placed. Signed out, on the
      marketing site and on /demo, it is exactly the right thing to show. */
  if (source !== 'example') {
    return <EmptySocial title="Find Slippers" note={SOCIAL_EXAMPLE_NOTE} />;
  }

  return (
    <>
      <div className="row" style={{ marginBottom: 'var(--gap-block)' }}>
        <Link href="/app/social" className="btn btn--quiet btn--sm">
          <Icon name="chevronLeft" size={16} /> Social
        </Link>
      </div>
      <h1>Find Slippers</h1>
      <p className="muted" style={{ marginTop: 'var(--s2)' }}>
        Search a group name or a handle. Nothing here shows anybody&rsquo;s stakes, in a group or
        out of one.
      </p>
      {/*  Measured at 1440 by 900: 1,059 pixels against the 824 the window
           leaves. The search and its results scroll under the heading. */}
      <div className="fitcol fitcol--scroll" style={{ marginTop: 'var(--s5)' }}>
        <Discover groups={groupSummaries(now)} people={slippers(now)} />
      </div>
    </>
  );
}
