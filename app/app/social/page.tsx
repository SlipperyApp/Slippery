import type { Metadata } from 'next';
import Link from 'next/link';
import { Icon } from '@/components/Icon';
import { getViewer } from '@/lib/data/session';
import { EmptySocial, SOCIAL_EXAMPLE_NOTE } from '@/components/app/EmptySocial';
import { YOU, groupSummaries, slippers, league, thinReturn, trackingFeed } from '@/lib/data/social';
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
  /*  Four, not three. This card shares a grid row with Your groups, which
      has four in it, and a row takes its tallest card: three left two
      hundred pixels of empty card under the last one. */
  const tracking = trackingFeed(now).slice(0, 4);

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
          {/*  THE REST OF THE FIELD, from 1000 up.
               Three plinths, a sentence and a button left about a hundred and
               thirty pixels of nothing in the middle of this card, because it
               shares a row with the month card beside it and a grid row takes
               its tallest. Filling it with air under the button would have
               been the same hole moved to the end.

               What was missing is the rest of the table: a podium on its own
               is three people and no field, so "first of twelve" and "first of
               four" look identical. These are the same rows the whole table
               draws, at the density a preview can carry, in as many columns as
               the card is wide. Below 1000 the card is a phone card and there
               is room for three plinths and a button, which is what it has
               always shown. */}
          {board.length > 3 ? (
            <div className="lbrest" aria-label="The rest of the field">
              {board.slice(3).map((r) => (
                <span key={r.handle} className="lbrest__row">
                  <span className="lbrest__pos tnum">{r.position}</span>
                  <Link href={`/app/social/person?handle=${r.handle}`} className="lbrest__nm">
                    {r.name}{r.handle === YOU ? <span className="dim league__you">(you)</span> : null}
                  </Link>
                  <span className={`lbrest__u tnum ${r.record.units > 0 ? 'pos' : r.record.units < 0 ? 'neg' : ''}`}>
                    {fmtUnits(r.record.units, { league: true, sign: true })}
                  </span>
                </span>
              ))}
            </div>
          ) : null}
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
          {/*  A FIGURE AT THE TOP AND TWO SENTENCES AT THE BOTTOM IS STILL A
               LAKE. This card shares a row with a leaderboard two hundred
               pixels taller, and a grid row takes its tallest card, so the
               first go at this pushed the sentences to the foot and left the
               hole in the middle instead of at the end. A hole is a hole
               wherever it is put.

               What fills it is the card's own subject. The figure is a
               month's units, and the only question a month's units raises is
               what they are made of: how many bets, how they went, how much
               was staked to get there and how much of it came off a slip.
               Those are five facts this page already held and was printing
               two of, in a sentence, in the smallest type on the screen.

               Every one is folded from the same bets as the figure above
               them, so this card and any table you appear in cannot disagree
               about your month. */}
          <p className="label">Your units</p>
          <p className={`fig ${you.month.units >= 0 ? 'pos' : 'neg'}`}>
            {fmtUnits(you.month.units, { league: true, sign: true })}
          </p>
          <p className="small dim" style={{ marginTop: 4 }}>
            {you.month.bets === 0
              ? 'No bets this month yet.'
              : `Over ${plural(you.month.bets, 'bet')}, ${you.month.wins + you.month.losses} of them settled.`}
          </p>

          <ul style={{ marginTop: 'var(--s5)' }}>
            <li className="brow">
              <span className="brow__title">Won</span>
              <span className="fig fig--s tnum">{you.month.wins}</span>
            </li>
            <li className="brow">
              <span className="brow__title">Lost</span>
              <span className="fig fig--s tnum">{you.month.losses}</span>
            </li>
            <li className="brow">
              <span style={{ minWidth: 0 }}>
                <span className="brow__title">Staked</span>
                <span className="brow__sub">In units. No stake is visible here.</span>
              </span>
              <span className="fig fig--s tnum">{fmtUnits(you.month.stakedUnits)}</span>
            </li>
            {/*  THE RETURN IS SUBJECT TO THE SAME RULE AS THE TABLE BESIDE
                 IT. On the second of a month this card read "1 won, 1 lost,
                 over 7 bets. +66.9% return." while the leaderboard two
                 hundred pixels to the left had struck exactly that figure out
                 and marked the row that produced it. A return over two
                 settled bets is the price of one of them, which is what
                 DECISIONS.md says and what thinReturn() decides for both
                 surfaces. */}
            <li className="brow">
              <span style={{ minWidth: 0 }}>
                <span className="brow__title">Return</span>
                <span className="brow__sub">
                  {you.month.bets === 0
                    ? 'Nothing settled yet'
                    : thinReturn(you.month)
                      ? 'Too few settled for it to mean anything'
                      : `Over ${plural(you.month.wins + you.month.losses, 'settled bet')}`}
                </span>
              </span>
              <span
                className={`fig fig--s tnum ${!thinReturn(you.month) && you.month.roi > 0 ? 'pos' : !thinReturn(you.month) && you.month.roi < 0 ? 'neg' : ''}`}
              >
                {thinReturn(you.month) ? '–' : pct(you.month.roi, { sign: true })}
              </span>
            </li>
            <li className="brow">
              <span style={{ minWidth: 0 }}>
                <span className="brow__title">Slip backed</span>
                <span className="brow__sub">Captured before the off</span>
              </span>
              <span className="fig fig--s tnum">{you.slipBackedPct}%</span>
            </li>
          </ul>
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
                <li key={t.id} className="brow wrow wrow--av" style={{ gap: 'var(--s3)' }}>
                  <span className="avatar" aria-hidden="true">{initials(t.name)}</span>
                  <span style={{ minWidth: 0 }}>
                    <span className="brow__title" style={{ display: 'block' }}>{t.selection}</span>
                    <span className="brow__sub" style={{ display: 'block' }}>{t.name} · {fmtUnits(t.stakeUnits)}</span>
                  </span>
                  {/*  Which match it is on, in the middle, from 1000 up. A
                       selection and a countdown with six hundred pixels of
                       nothing between them said less than it could. */}
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
              <li key={p.handle} className="brow wrow wrow--av" style={{ gap: 'var(--s3)' }}>
                <span className="avatar" aria-hidden="true">{initials(p.name)}</span>
                <span style={{ minWidth: 0 }}>
                  <Link href={`/app/social/person?handle=${p.handle}`} className="brow__title" style={{ textDecoration: 'none' }}>{p.name}</Link>
                  <span className="brow__sub">
                    <span className="mono">@{p.handle}</span> · joined {ago(p.joined, now)}
                  </span>
                </span>
                {/*  What they have actually done, in the middle, from 1000
                     up, rather than a name and a pill at opposite edges of an
                     800 pixel card. Units all time, which is the one figure
                     a Slipper is ranked on anywhere in this product. */}
                <span className="wrow__mid">
                  {fmtUnits(p.all.units, { league: true, sign: true })} all time · {p.slipBackedPct}% slip backed
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
