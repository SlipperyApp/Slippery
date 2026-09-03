import type { Metadata } from 'next';
import Link from 'next/link';
import { Icon } from '@/components/Icon';
import { getViewer } from '@/lib/data/session';
import { EmptySocial, SOCIAL_EXAMPLE_NOTE } from '@/components/app/EmptySocial';
import { YOU, groupSummaries, slippers, league, trackingFeed } from '@/lib/data/social';
import {
  units as fmtUnits, gap, initials, plural, position as fmtPosition,
} from '@/lib/format';

export const metadata: Metadata = {
  title: 'Social',
  description: 'The feed and your groups. Ranked in units, never in pounds.',
};

/** Social is two regions: what people are tracking, and the groups you are in.
 *
 *  IT WAS SIX CARDS AND FOUR OF THEM WERE ABOUT FOLLOWING. "Slippers you
 *  follow" drew a six row league table; "Slippers following you" drew the same
 *  people again in a different row shape; both carried a count in the corner;
 *  and every row of both carried a Following pill. Two of the twelve people in
 *  the example data appeared three times on one screen. A follow count is a
 *  score for collecting people, which is an engagement mechanic on a product
 *  that is not allowed to have one, and following somebody was never a feature
 *  anything on this page depended on: the feed is opt in per account and the
 *  leagues rank whoever is in the group.
 *
 *  "THIS MONTH" WENT WITH THEM. It was five rows of the viewer's own record,
 *  in units, on the social page, next to a leaderboard whose first row is the
 *  viewer's own record in units. The dashboard is where an account reads its
 *  own figures and it now has a period selector governing every one of them.
 *
 *  THE LEADERBOARD IS A STRIP. Three plinths, a sentence, nine more rows in
 *  three columns and a button came to 640 pixels for a table that has its own
 *  page. Three names, three figures and the way through to that page. */
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
  const groups = groupSummaries(now);
  const mine = groups.filter((g) => g.youAreIn);
  /*  ALL TIME, and the month is a tab on the table itself. A monthly board on
      the second of a month is a board of two days: every row reads one bet
      and a return of four hundred per cent, which is true and is a poor first
      thing to see twelve times a year. */
  const board = league(people, 'all');
  const top = board.slice(0, 3);
  const tracking = trackingFeed(now).slice(0, 6);

  return (
    <>
      <div className="spread lgr__top">
        <h1>Social</h1>
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
        </div>
      </div>

      {/*  THE TOP THREE, AS A STRIP. Position, name, units, and the way to
           the rest of the field. Nothing here is a plinth: the whole table
           is one press away and it is the thing that can carry a shape. */}
      <div className="top3">
        <p className="label top3__k">Leaderboard, all time</p>
        <ol className="top3__list">
          {top.map((r) => {
            const u = r.record.units;
            return (
              <li key={r.handle} className="top3__row">
                <span className={`top3__pos medal medal--${r.position}`}>{r.position}</span>
                <Link href={`/app/social/person?handle=${r.handle}`} className="top3__nm">
                  {r.name}{r.handle === YOU ? <span className="dim league__you">(you)</span> : null}
                </Link>
                <span className={`fig fig--s tnum top3__u ${u > 0 ? 'pos' : u < 0 ? 'neg' : ''}`}>
                  {fmtUnits(u, { league: true, sign: true })}
                </span>
              </li>
            );
          })}
        </ol>
        <Link href="/app/social/leaderboard" className="btn btn--ghost btn--sm top3__go">
          The whole table
        </Link>
      </div>

      <div className="grid fitcol">
        <section className="card col-6" aria-labelledby="soc-feed">
          <div className="card__head">
            {/*  "Before kick off only" is gone from the corner. It read as a
                 rule about what may be recorded, and Slippery tracks a bet at
                 any time: what is true here is that an item in this list has
                 not started yet, which every row says by counting down to its
                 own kick off. The gate itself is unchanged and is about what
                 is PUBLISHED to other people, not about what may be sent. */}
            <h2 className="card__title" id="soc-feed">Tracking now</h2>
          </div>
          {tracking.length === 0 ? (
            <p className="small muted" style={{ marginTop: 'var(--s4)' }}>
              Nothing is waiting to start.
            </p>
          ) : (
            <ul className="soc__scroll">
              {tracking.map((t) => (
                <li key={t.id} className="brow wrow wrow--av" style={{ gap: 'var(--s3)' }}>
                  <span className="avatar" aria-hidden="true">{initials(t.name)}</span>
                  <span style={{ minWidth: 0 }}>
                    <span className="brow__title" style={{ display: 'block' }}>{t.selection}</span>
                    <span className="brow__sub" style={{ display: 'block' }}>{t.name} · {fmtUnits(t.stakeUnits)}</span>
                  </span>
                  <span className="wrow__mid">{t.eventName}</span>
                  <span className="small dim nowrap">in {gap(now, t.startsAt)}</span>
                </li>
              ))}
            </ul>
          )}
          <div className="card__foot">
            <Link href="/app/social/feed" className="btn btn--quiet btn--sm">The whole feed</Link>
          </div>
        </section>

        <section className="card col-6" aria-labelledby="soc-groups">
          <div className="card__head">
            <h2 className="card__title" id="soc-groups">Your groups</h2>
          </div>
          {mine.length === 0 ? (
            <p className="small muted" style={{ marginTop: 'var(--s4)' }}>
              You are not in a group yet. One takes about a minute to start.
            </p>
          ) : (
            <ul className="soc__scroll">
              {mine.map((g) => (
                <li key={g.id} className="brow wrow wrow--go" style={{ gap: 'var(--s3)' }}>
                  <span style={{ minWidth: 0 }}>
                    <Link href={`/app/social/group?id=${g.id}`} className="brow__title" style={{ textDecoration: 'none' }}>
                      {g.name}
                    </Link>
                    <span className="brow__sub" style={{ display: 'block' }}>
                      {plural(g.members, 'Slipper')} · {g.division}
                      {g.slipBackedOnly ? ' · slip backed only' : ''}
                    </span>
                  </span>
                  {/*  The group's own sentence, in the middle, from 1000 up.
                       A name and a position pill with six hundred pixels
                       between them is the shape this branch exists to end. */}
                  <span className="wrow__mid">{g.blurb}</span>
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
      </div>
    </>
  );
}
