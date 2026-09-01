import type { Metadata } from 'next';
import Link from 'next/link';
import { Icon } from '@/components/Icon';
import { getViewer } from '@/lib/data/session';
import { groupSummaries, slippers, league, feed } from '@/lib/data/social';
import { League } from '@/components/app/League';
import { units as fmtUnits, ago, initials, position as fmtPosition } from '@/lib/format';

export const metadata: Metadata = {
  title: 'Social',
  description: 'Your groups, the Slippers you follow, and the monthly leagues. Ranked in units, never in pounds.',
};

export default async function Social() {
  const { now } = await getViewer();
  const groups = groupSummaries(now);
  const people = slippers(now);
  const you = people.find((p) => p.handle === 'tester123')!;
  const following = people.filter((p) => p.following);
  const followers = people.filter((p) => p.followsYou);
  const items = feed(now).slice(0, 5);

  return (
    <>
      <div className="spread" style={{ marginBottom: 'var(--gap-block)', flexWrap: 'wrap' }}>
        <h1>Social</h1>
        <div className="row" style={{ gap: 'var(--s2)' }}>
          <Link href="/app/social/discover" className="btn btn--ghost btn--sm">
            <Icon name="search" size={16} /> Find Slippers
          </Link>
          <Link href="/app/social/feed" className="btn btn--quiet btn--sm">Feed</Link>
        </div>
      </div>

      <div className="grid">
        <section className="card col-8">
          <div className="card__head">
            <h2 className="card__title">Your groups</h2>
            <p className="card__note">{groups.length} of them</p>
          </div>
          <ul>
            {groups.map((g) => (
              <li key={g.id} className="brow" style={{ gridTemplateColumns: 'minmax(0,1fr) auto auto', gap: 'var(--s3)' }}>
                <span style={{ minWidth: 0 }}>
                  <Link href={`/app/social/group?id=${g.id}`} className="brow__title" style={{ textDecoration: 'none' }}>
                    {g.name}
                  </Link>
                  <span className="brow__sub" style={{ display: 'block' }}>
                    {g.members} Slippers · {g.division}
                    {g.slipBackedOnly ? ' · slip backed only' : ''}
                  </span>
                </span>
                <span className="pill">{fmtPosition(g.yourPosition, g.members)}</span>
                <Icon name="chevronRight" size={16} />
              </li>
            ))}
          </ul>
          <div className="card__foot">
            <Link href="/app/social/discover" className="btn btn--ghost btn--sm">Find a group</Link>
          </div>
        </section>

        <section className="card col-4">
          <div className="card__head">
            <h2 className="card__title">This month</h2>
            <p className="card__note">Units, 1dp</p>
          </div>
          <p className="label">Your units</p>
          <p className={`fig ${you.unitsMonth >= 0 ? 'pos' : 'neg'}`}>
            {fmtUnits(you.unitsMonth, { league: true, sign: true })}
          </p>
          <p className="small dim" style={{ marginTop: 4 }}>{you.slipBackedPct}% of them slip backed</p>
        </section>

        <section className="card col-6">
          <div className="card__head">
            <h2 className="card__title">Slippers you follow</h2>
            <p className="card__note">{following.length}</p>
          </div>
          <League rows={league(following, 'month').slice(0, 6)} />
          <div className="card__foot">
            <Link href="/app/social/discover" className="btn btn--quiet btn--sm">Find more Slippers</Link>
          </div>
        </section>

        <section className="card col-6">
          <div className="card__head">
            <h2 className="card__title">Slippers following you</h2>
            <p className="card__note">{followers.length}</p>
          </div>
          <ul>
            {followers.map((p) => (
              <li key={p.handle} className="brow" style={{ gridTemplateColumns: '30px minmax(0,1fr) auto', gap: 'var(--s3)' }}>
                <span className="avatar" aria-hidden="true">{initials(p.name)}</span>
                <span style={{ minWidth: 0 }}>
                  <Link href={`/app/social/person?handle=${p.handle}`} className="brow__title" style={{ textDecoration: 'none' }}>{p.name}</Link>
                  <span className="brow__sub" style={{ display: 'block' }}>
                    <span className="mono">@{p.handle}</span> · joined {ago(p.joined, now)}
                  </span>
                </span>
                <span className="pill">{p.following ? 'Following' : 'Follows you'}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="card col-12">
          <div className="card__head">
            <h2 className="card__title">What Slippers have been doing</h2>
            <p className="card__note">App actions only, never betting outcomes</p>
          </div>
          <ul>
            {items.map((f) => (
              <li key={f.id} className="brow" style={{ gridTemplateColumns: '30px minmax(0,1fr) auto', gap: 'var(--s3)' }}>
                <span className="avatar" aria-hidden="true">{initials(f.name)}</span>
                <span className="brow__title" style={{ fontWeight: 400 }}>
                  <strong>{f.name}</strong> {f.text}
                </span>
                <span className="small dim nowrap">{ago(f.at, now)}</span>
              </li>
            ))}
          </ul>
          <div className="card__foot">
            <Link href="/app/social/feed" className="btn btn--quiet btn--sm">The whole feed</Link>
          </div>
        </section>
      </div>
    </>
  );
}
