import type { Metadata } from 'next';
import Link from 'next/link';
import { Icon } from '@/components/Icon';
import { getViewer } from '@/lib/data/session';
import { EmptySocial, SOCIAL_EXAMPLE_NOTE } from '@/components/app/EmptySocial';
import { YOU, groupSummaries, slippers, league, trackingFeed } from '@/lib/data/social';
import { League } from '@/components/app/League';
import { Podium } from '@/components/app/Podium';
import {
  units as fmtUnits, ago, gap, initials, pct, plural, position as fmtPosition,
} from '@/lib/format';

export const metadata: Metadata = {
  title: 'Social',
  description: 'Your groups, the Slippers you follow, and the monthly leagues. Ranked in units, never in pounds.',
};

export default async function Social() {
  const { now, source } = await getViewer();

  /*  THE SOCIAL GRAPH ON THIS SCREEN IS THE EXAMPLE ACCOUNT'S. It is folded
      out of lib/data/social.ts, which invents the Slippers around
      @tester123, so showing it to a signed-in account would place that
      person first in a league of bets they never placed. Signed out, on the
      marketing site and on /demo, it is exactly the right thing to show. */
  if (source !== 'example') {
    return <EmptySocial title="Social" note={SOCIAL_EXAMPLE_NOTE} />;
  }

  const people = slippers(now);
  const you = people.find((p) => p.handle === YOU)!;
  const groups = groupSummaries(now);
  const mine = groups.filter((g) => g.youAreIn);
  const following = people.filter((p) => p.following);
  const followers = people.filter((p) => p.followsYou);
  /*  ALL TIME on the hub, and the month is a tab on the table itself.
      A monthly board on the second of a month is a board of two days: every
      row reads one bet and a return of four hundred per cent, which is true
      and is a poor first thing to see twelve times a year. */
  const board = league(people, 'all');
  const tracking = trackingFeed(now).slice(0, 3);

  return (
    <>
      <div className="spread" style={{ marginBottom: 'var(--gap-block)', flexWrap: 'wrap' }}>
        <h1>Social</h1>
        {/*  row--wrap: three buttons on one line measured 321px inside a
             320px phone, which is the whole page scrolling sideways for one
             pixel of button. */}
        <div className="row row--wrap" style={{ gap: 'var(--s2)' }}>
          {/*  Start one BEFORE find one. Somebody with no group cannot use
               discovery, and this button was the thing three other screens
               promised and none of them provided. */}
          <Link href="/app/social/group/new" className="btn btn--primary btn--sm">
            <Icon name="plus" size={16} /> Start a group
          </Link>
          <Link href="/app/social/group/join" className="btn btn--ghost btn--sm">Join with a code</Link>
          <Link href="/app/social/discover" className="btn btn--quiet btn--sm">
            <Icon name="search" size={16} /> Find Slippers
          </Link>
          <Link href="/app/social/feed" className="btn btn--quiet btn--sm">Feed</Link>
        </div>
      </div>

      <div className="grid">
        <section className="card col-8">
          <div className="card__head">
            <h2 className="card__title">Leaderboard</h2>
            <p className="card__note">All time</p>
          </div>
          <Podium rows={board} you={YOU} period="all time" />
          <div className="card__foot">
            <Link href="/app/social/leaderboard" className="btn btn--ghost btn--sm">
              The whole table
            </Link>
          </div>
        </section>

        <section className="card col-4">
          <div className="card__head">
            <h2 className="card__title">This month</h2>
          </div>
          <p className="label">Your units</p>
          <p className={`fig ${you.month.units >= 0 ? 'pos' : 'neg'}`}>
            {fmtUnits(you.month.units, { league: true, sign: true })}
          </p>
          {/*  The record and the return are folded from the same bets as the
               figure above them, so this card and any table you appear in
               cannot disagree about your month.

               At the FOOT of the card. This sits beside a leaderboard that
               is two hundred pixels taller and every card in a grid row
               stretches to the tallest, so with the sentences under the
               figure the card ended a third of the way down and left the
               rest empty. The figure keeps the top, the sentences take the
               bottom, and the hole between them becomes the space that
               separates a number from what it is made of. */}
          <div className="card__foot">
            <p className="small muted">
              {you.month.bets === 0
                ? 'No bets this month yet.'
                : `${you.month.wins} won, ${you.month.losses} lost, over ${plural(you.month.bets, 'bet')}. ${pct(you.month.roi, { sign: true })} return.`}
            </p>
            <p className="small dim" style={{ marginTop: 'var(--s2)' }}>{you.slipBackedPct}% of them slip backed</p>
          </div>
        </section>

        <section className="card col-6">
          <div className="card__head">
            <h2 className="card__title">Your groups</h2>
          </div>
          {mine.length === 0 ? (
            <p className="small muted" style={{ marginTop: 'var(--s4)' }}>
              You are not in a group yet. One takes about a minute to start.
            </p>
          ) : (
            <ul>
              {mine.map((g) => (
                <li key={g.id} className="brow" style={{ gridTemplateColumns: 'minmax(0,1fr) auto auto', gap: 'var(--s3)' }}>
                  <span style={{ minWidth: 0 }}>
                    <Link href={`/app/social/group?id=${g.id}`} className="brow__title" style={{ textDecoration: 'none' }}>
                      {g.name}
                    </Link>
                    <span className="brow__sub" style={{ display: 'block' }}>
                      {plural(g.members, 'Slipper')} · {g.division}
                      {g.slipBackedOnly ? ' · slip backed only' : ''}
                    </span>
                  </span>
                  <span className="pill">{fmtPosition(g.yourPosition, g.members)}</span>
                  <Icon name="chevronRight" size={16} />
                </li>
              ))}
            </ul>
          )}
          <div className="card__foot">
            <Link href="/app/social/discover" className="btn btn--ghost btn--sm">Find a group</Link>
          </div>
        </section>

        <section className="card col-6">
          <div className="card__head">
            <h2 className="card__title">Tracking now</h2>
            <p className="card__note">Before kick off only</p>
          </div>
          {tracking.length === 0 ? (
            <p className="small muted" style={{ marginTop: 'var(--s4)' }}>
              Nothing is waiting to start.
            </p>
          ) : (
            <ul>
              {tracking.map((t) => (
                <li key={t.id} className="brow" style={{ gridTemplateColumns: '30px minmax(0,1fr) auto', gap: 'var(--s3)' }}>
                  <span className="avatar" aria-hidden="true">{initials(t.name)}</span>
                  <span style={{ minWidth: 0 }}>
                    <span className="brow__title" style={{ display: 'block' }}>{t.selection}</span>
                    <span className="brow__sub" style={{ display: 'block' }}>{t.name} · {fmtUnits(t.stakeUnits)}</span>
                  </span>
                  <span className="small dim nowrap">in {gap(now, t.startsAt)}</span>
                </li>
              ))}
            </ul>
          )}
          <div className="card__foot">
            <Link href="/app/social/feed" className="btn btn--quiet btn--sm">The whole feed</Link>
          </div>
        </section>

        <section className="card col-6">
          <div className="card__head">
            <h2 className="card__title">Slippers you follow</h2>
            <p className="card__note">{following.length}, all time</p>
          </div>
          <League rows={league(following, 'all').slice(0, 6)} you={YOU} />
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
                  <span className="brow__sub">
                    <span className="mono">@{p.handle}</span> · joined {ago(p.joined, now)}
                  </span>
                </span>
                <span className="pill">{p.following ? 'Following' : 'Follows you'}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  );
}
