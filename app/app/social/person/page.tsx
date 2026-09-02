import type { Metadata } from 'next';
import Link from 'next/link';
import { Icon } from '@/components/Icon';
import { getViewer } from '@/lib/data/session';
import { EmptySocial, SOCIAL_EXAMPLE_NOTE } from '@/components/app/EmptySocial';
import { findSlipper, groupSummaries, slippers } from '@/lib/data/social';
import { FollowButton } from '@/components/app/FollowButton';
import { units as fmtUnits, initials, longDate, count, pct, plural } from '@/lib/format';

export const metadata: Metadata = {
  title: 'A Slipper',
  description: 'What another Slipper shows: units, slip backed percentage and the groups they are in. Never their stakes.',
};

export default async function PersonPage({
  searchParams,
}: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const { now, source } = await getViewer();

  /*  THE SOCIAL GRAPH ON THIS SCREEN IS THE EXAMPLE ACCOUNT'S. It is folded
      out of lib/data/social.ts, which invents the Slippers around
      @tester123, so showing it to a signed-in account would place that
      person first in a league of bets they never placed. Signed out, on the
      marketing site and on /demo, it is exactly the right thing to show. */
  if (source !== 'example') {
    return <EmptySocial title="Slipper" note={SOCIAL_EXAMPLE_NOTE} />;
  }

  const handle = (typeof sp.handle === 'string' ? sp.handle : '') || 'rowan';
  const person = findSlipper(handle, now) ?? slippers(now)[0];
  const groups = groupSummaries(now).filter((g) => person.groups.includes(g.id));

  return (
    <>
      <div className="row" style={{ marginBottom: 'var(--gap-block)' }}>
        <Link href="/app/social" className="btn btn--quiet btn--sm">
          <Icon name="chevronLeft" size={16} /> Social
        </Link>
      </div>

      <div className="column column--wide" style={{ marginInline: 0 }}>
        <div className="card">
          <div className="row" style={{ gap: 'var(--s4)', alignItems: 'flex-start' }}>
            <span className="avatar avatar--lg" aria-hidden="true">{initials(person.name)}</span>
            <div className="grow" style={{ minWidth: 0 }}>
              <h1 style={{ fontSize: 'var(--t-h2)' }}>{person.name}</h1>
              <p className="small dim mono">@{person.handle}</p>
              <p className="small muted" style={{ marginTop: 'var(--s2)' }}>
                On Slippery since {longDate(person.joined)}
              </p>
            </div>
            <FollowButton handle={person.handle} initial={person.following} />
          </div>

          <div className="row row--wrap" style={{ gap: 'var(--s7)', marginTop: 'var(--s6)' }}>
            <div>
              <p className="label">This month</p>
              <p className={`fig fig--m ${person.month.units >= 0 ? 'pos' : 'neg'}`}>
                {fmtUnits(person.month.units, { league: true, sign: true })}
              </p>
            </div>
            <div>
              <p className="label">All time</p>
              <p className={`fig fig--m ${person.all.units >= 0 ? 'pos' : 'neg'}`}>
                {fmtUnits(person.all.units, { league: true, sign: true })}
              </p>
            </div>
            <div>
              <p className="label">Return</p>
              <p className="fig fig--m tnum">{pct(person.all.roi, { sign: true })}</p>
            </div>
            <div>
              <p className="label">Slip backed</p>
              <p className="fig fig--m tnum">{person.slipBackedPct}%</p>
            </div>
            <div>
              <p className="label">Bets</p>
              <p className="fig fig--m tnum">{count(person.all.bets)}</p>
            </div>
          </div>

          {/*  The record and the return come out of the same fold as the units
               above them, so a profile and a leaderboard row cannot disagree
               about the same person. */}
          <p className="small muted" style={{ marginTop: 'var(--s4)' }}>
            All time: {count(person.all.wins)} won, {count(person.all.losses)} lost, over{' '}
            {plural(person.all.bets, 'bet')}.
          </p>

          <p className="small dim card__foot">
            Units only. Stakes are never visible outside a group, and inside one only the unit
            size is, which is what makes a comparison between two Slippers mean anything.
          </p>
        </div>

        <div className="card" style={{ marginTop: 'var(--s4)' }}>
          <h2 className="card__title">Groups</h2>
          {groups.length === 0 ? (
            <p className="small dim" style={{ marginTop: 'var(--s3)' }}>Not in a group yet.</p>
          ) : (
            <ul style={{ marginTop: 'var(--s3)' }}>
              {groups.map((g) => (
                <li key={g.id} className="brow">
                  <Link href={`/app/social/group?id=${g.id}`} className="brow__title" style={{ textDecoration: 'none' }}>{g.name}</Link>
                  <span className="small dim">{plural(g.members, 'Slipper')} · {g.division}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </>
  );
}
