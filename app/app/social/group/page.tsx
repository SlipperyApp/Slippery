import type { Metadata } from 'next';
import Link from 'next/link';
import { Icon } from '@/components/Icon';
import { getViewer } from '@/lib/data/session';
import { GROUPS, groupMembers, groupSummaries, league } from '@/lib/data/social';
import { League } from '@/components/app/League';
import { position as fmtPosition } from '@/lib/format';

export const metadata: Metadata = {
  title: 'A group',
  description: 'The leaderboard, the slip backed percentages, and what the group asks of its members.',
};

export default async function GroupPage({
  searchParams,
}: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const { now } = await getViewer();
  const id = (typeof sp.id === 'string' ? sp.id : '') || GROUPS[0].id;
  const summary = groupSummaries(now).find((g) => g.id === id) ?? groupSummaries(now)[0];
  const members = groupMembers(summary.id, now);
  const board = league(members, summary.rankingPeriod);
  const you = board.find((r) => r.handle === 'tester123');
  const verified = Math.round(members.reduce((a, m) => a + m.slipBackedPct, 0) / Math.max(1, members.length));

  return (
    <>
      <div className="row" style={{ marginBottom: 'var(--s4)' }}>
        <Link href="/app/social" className="btn btn--quiet btn--sm">
          <Icon name="chevronLeft" size={16} /> Social
        </Link>
      </div>

      <div className="spread" style={{ marginBottom: 'var(--s4)', flexWrap: 'wrap', gap: 'var(--s3)' }}>
        <div>
          <h1>{summary.name}</h1>
          <p className="muted small" style={{ marginTop: 4 }}>{summary.blurb}</p>
        </div>
        <div className="row" style={{ gap: 'var(--s2)' }}>
          <span className="pill">{summary.members} Slippers</span>
          <span className="pill pill--accent">{summary.division}</span>
        </div>
      </div>

      <div className="banner banner--accent" style={{ marginBottom: 'var(--s4)' }}>
        <Icon name="shield" size={18} className="banner__icon" />
        <span>
          {verified}% of the bets on this leaderboard came from a slip captured at placement.
          {summary.slipBackedOnly
            ? ' This group only counts slip backed bets, so a typed-in winner cannot move a position.'
            : ' Typed-in bets count here and are marked on each row.'}
        </span>
      </div>

      <div className="grid">
        <section className="card col-8">
          <div className="card__head">
            <h2 className="card__title">Leaderboard</h2>
            <p className="card__note">
              {summary.rankingPeriod === 'month' ? 'This month' : summary.rankingPeriod === 'year' ? 'This year' : 'All time'}, units to 1dp
            </p>
          </div>
          <League rows={board} showEdits={summary.showEditAudit} period={summary.rankingPeriod} />
          <p className="small dim card__foot">
            {summary.showEditAudit
              ? 'A late edit is a settlement event entered after the result was known. It is counted, not hidden, and it does not change anybody’s position.'
              : 'This group does not show late edits. They are still recorded in each Slipper’s own change history.'}
          </p>
        </section>

        <div className="col-4" style={{ display: 'grid', gap: 'var(--s4)', alignContent: 'start' }}>
          <section className="card">
            <h2 className="card__title">Where you are</h2>
            <p className="fig" style={{ marginTop: 'var(--s3)' }}>
              {you ? fmtPosition(you.position, board.length) : '—'}
            </p>
            <p className="small muted" style={{ marginTop: 'var(--s3)' }}>
              {summary.division === 'Premier'
                ? 'Staying in the Premier division next month.'
                : `Moving to ${summary.division} next month.`}
            </p>
          </section>

          <section className="card">
            <h2 className="card__title">What this group asks</h2>
            <ul style={{ marginTop: 'var(--s3)' }}>
              <li className="brow"><span className="brow__title">Joining</span><span className="small dim">{summary.joinMode === 'open' ? 'Open to anyone' : summary.joinMode === 'code' ? 'By invite code' : 'Approval by the admin'}</span></li>
              <li className="brow"><span className="brow__title">Counts</span><span className="small dim">{summary.slipBackedOnly ? 'Slip backed only' : 'Every bet'}</span></li>
              <li className="brow"><span className="brow__title">Ranks on</span><span className="small dim">Units, {summary.rankingPeriod === 'month' ? 'monthly' : summary.rankingPeriod}</span></li>
              <li className="brow"><span className="brow__title">Late edits</span><span className="small dim">{summary.showEditAudit ? 'Shown' : 'Not shown'}</span></li>
            </ul>
            <div className="card__foot">
              <p className="label">Invite code</p>
              <p className="fig fig--s mono" style={{ marginTop: 4 }}>{summary.inviteCode}</p>
              <p className="small dim" style={{ marginTop: 'var(--s2)' }}>
                Members see each other’s unit size and that cannot be turned off while you are a
                member. Stakes are never visible, in a group or out of one.
              </p>
            </div>
          </section>

          <section className="card">
            <h2 className="card__title">Other groups</h2>
            <ul style={{ marginTop: 'var(--s3)' }}>
              {groupSummaries(now).filter((g) => g.id !== summary.id).map((g) => (
                <li key={g.id} className="brow">
                  <Link href={`/app/social/group?id=${g.id}`} className="brow__title" style={{ textDecoration: 'none' }}>{g.name}</Link>
                  <span className="small dim">{g.members} Slippers</span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </>
  );
}
