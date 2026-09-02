import type { Metadata } from 'next';
import Link from 'next/link';
import { Icon } from '@/components/Icon';
import { getViewer } from '@/lib/data/session';
import { EmptySocial, SOCIAL_EXAMPLE_NOTE } from '@/components/app/EmptySocial';
import {
  YOU, divisionMove, findGroup, groupMembers, groupSummaries, league, slipBackedExcluded,
} from '@/lib/data/social';
import { League } from '@/components/app/League';
import { Podium } from '@/components/app/Podium';
import { CopyCode } from '@/components/app/CopyCode';
import { GroupSettings, LeaveGroup } from '@/components/app/GroupControls';
import { JoinGroupButton } from '@/components/app/JoinGroupButton';
import { plural, position as fmtPosition } from '@/lib/format';

export const metadata: Metadata = {
  title: 'A group',
  description: 'The leaderboard, the slip backed percentages, and what the group asks of its members.',
};

const JOIN_LABEL = {
  open: 'Open to anyone',
  code: 'By invite code',
  approval: 'Approval by the admin',
} as const;

const JOIN_MEANS = {
  open: 'Anybody can join from Discover. There is nothing to approve and nothing to share.',
  code: 'Anybody holding the six characters is in. Every member can pass them on, so a code is a key rather than an invitation.',
  approval: 'The group shows in Discover and each request goes to the admin, who decides.',
} as const;

export default async function GroupPage({
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
    return <EmptySocial title="Group" note={SOCIAL_EXAMPLE_NOTE} />;
  }

  const wanted = typeof sp.id === 'string' ? sp.id : '';
  const all = groupSummaries(now);
  /*  A group that does not exist used to fall through to the first one in the
      list, so a stale link showed somebody a different group's table under
      the name they clicked. It says the id did not match instead. */
  const summary = wanted ? findGroup(wanted, now) : all.find((g) => g.youAreIn);

  if (!summary) {
    return (
      <>
        <div className="row" style={{ marginBottom: 'var(--gap-block)' }}>
          <Link href="/app/social" className="btn btn--quiet btn--sm">
            <Icon name="chevronLeft" size={16} /> Social
          </Link>
        </div>
        <h1>No group there</h1>
        <p className="muted" style={{ marginTop: 'var(--s2)' }}>
          Nothing matches {wanted ? <span className="mono">{wanted}</span> : 'that'}. A group that was
          deleted leaves its link behind, and so does a link typed from a photograph of a screen.
        </p>
        <div className="row" style={{ gap: 'var(--s3)', marginTop: 'var(--s5)', flexWrap: 'wrap' }}>
          <Link href="/app/social/group/join" className="btn btn--primary btn--sm">Join with a code</Link>
          <Link href="/app/social/discover" className="btn btn--ghost btn--sm">Find a group</Link>
          <Link href="/app/social/group/new" className="btn btn--quiet btn--sm">Start one</Link>
        </div>
      </>
    );
  }

  const members = groupMembers(summary.id, now);
  const board = league(members, summary.rankingPeriod);
  const you = board.find((r) => r.handle === YOU);
  const excluded = slipBackedExcluded(summary.id, now);
  /*  Only the person who made it sees "this is yours". A link with new=1 on
      it forwarded to somebody else is a link to a group they are looking at
      for the first time, and telling them they created it would be a lie
      that a share button could tell on its own. */
  const justCreated = sp.new === '1' && summary.youOwn;
  const periodLabel = summary.rankingPeriod === 'month'
    ? 'This month' : summary.rankingPeriod === 'year' ? 'This year' : 'All time';
  const verified = Math.round(members.reduce((a, m) => a + m.slipBackedPct, 0) / Math.max(1, members.length));

  return (
    <>
      <div className="row" style={{ marginBottom: 'var(--gap-block)' }}>
        <Link href="/app/social" className="btn btn--quiet btn--sm">
          <Icon name="chevronLeft" size={16} /> Social
        </Link>
      </div>

      <div className="spread" style={{ marginBottom: 'var(--gap-block)', flexWrap: 'wrap', gap: 'var(--s3)' }}>
        <div>
          <h1>{summary.name}</h1>
          <p className="muted small" style={{ marginTop: 'var(--s1)' }}>{summary.blurb}</p>
        </div>
        <div className="row row--wrap" style={{ gap: 'var(--s2)' }}>
          <span className="pill">{plural(summary.members, 'Slipper')}</span>
          <span className="pill pill--accent">{summary.division}</span>
          <span className="pill">{JOIN_LABEL[summary.joinMode]}</span>
        </div>
      </div>

      {justCreated ? (
        <div className="banner banner--accent" style={{ marginBottom: 'var(--gap-block)' }}>
          <Icon name="check" size={18} className="banner__icon" />
          <span>
            {summary.name} is yours and you are its admin. Nothing is in the table until a second
            Slipper joins, so the code below is the next step.
          </span>
        </div>
      ) : null}

      {/*  A slip backed group says WHAT IT LEFT OUT, with the number.
           Quietly counting fewer bets than the profile behind each row is how
           a member ends up asking why a table disagrees with their own
           ledger, and the answer to that is a sentence, not a support
           email. The average slip backed figure is not shown on one of these
           groups: inside the table it is a hundred per cent by definition,
           and printing 89% beside a rule that says only slip backed bets
           count reads as the rule not working. */}
      <div className="banner banner--accent" style={{ marginBottom: 'var(--gap-block)' }}>
        <Icon name="shield" size={18} className="banner__icon" />
        <span>
          {summary.slipBackedOnly
            ? `Slip backed bets only, so every bet in this table was captured from a slip at placement. ${excluded === 0
              ? 'Nothing its members have typed in has been left out yet.'
              : `${plural(excluded, 'bet')} from its members are out of it because they were not.`} A typed-in winner cannot move a position.`
            : `${verified}% of the bets here came from a slip captured at placement. Typed-in and imported bets count, and are marked on each Slipper.`}
        </span>
      </div>

      <div className="grid">
        <section className="card col-8">
          <div className="card__head">
            <h2 className="card__title">Leaderboard</h2>
            <p className="card__note">{periodLabel}, units to 1dp</p>
          </div>

          {members.length <= 1 ? (
            /*  A table of one is a list of one number. Saying so is better
                than drawing a podium with two empty plinths beside it. */
            <p className="small muted" style={{ marginTop: 'var(--s4)' }}>
              {summary.youOwn
                ? 'You are the only Slipper in this one. A table starts at two: share the code below and it fills in as they capture slips.'
                : `${plural(members.length, 'Slipper')} so far. A table starts at two.`}
            </p>
          ) : (
            <>
              <Podium rows={board} you={YOU} period={periodLabel.toLowerCase()} />
              <div style={{ marginTop: 'var(--s5)' }}>
                <League rows={board} you={YOU} showEdits={summary.showEditAudit} showSlipBacked={!summary.slipBackedOnly} />
              </div>
            </>
          )}

          <p className="small dim card__foot">
            {summary.showEditAudit
              ? 'A late edit is a settlement entered after the result was known. Counted, not hidden.'
              : 'Late edits are not shown here. They stay in each Slipper’s own change history.'}
          </p>
        </section>

        <div className="col-4" style={{ display: 'grid', gap: 'var(--s4)', alignContent: 'start' }}>
          <section className="card">
            <h2 className="card__title">Where you are</h2>
            {you ? (
              <>
                <p className="fig" style={{ marginTop: 'var(--s3)' }}>
                  {fmtPosition(you.position, board.length)}
                </p>
                <p className="small muted" style={{ marginTop: 'var(--s3)' }}>
                  {divisionMove(you.position, board.length, summary.division)}
                </p>
              </>
            ) : (
              <p className="small muted" style={{ marginTop: 'var(--s3)' }}>
                You are not in this group, so there is no position to show. Joining puts your units
                in the table from the next bet you capture.
              </p>
            )}
          </section>

          <section className="card">
            <h2 className="card__title">What this group asks</h2>
            <ul style={{ marginTop: 'var(--s3)' }}>
              <li className="brow"><span className="brow__title">Joining</span><span className="small dim">{JOIN_LABEL[summary.joinMode]}</span></li>
              <li className="brow"><span className="brow__title">Counts</span><span className="small dim">{summary.slipBackedOnly ? 'Slip backed only' : 'Every bet'}</span></li>
              <li className="brow"><span className="brow__title">Ranks on</span><span className="small dim">Units, {periodLabel.toLowerCase()}</span></li>
              <li className="brow"><span className="brow__title">Late edits</span><span className="small dim">{summary.showEditAudit ? 'Shown' : 'Not shown'}</span></li>
            </ul>
            <p className="small dim" style={{ marginTop: 'var(--s3)' }}>{JOIN_MEANS[summary.joinMode]}</p>

            {/*  THE CODE IS FOR MEMBERS. It was printed on this page for
                 anybody who could reach it, which hands the key to a group
                 they are not in to whoever follows a link to it. A member
                 sees it because passing it on is what it is for. */}
            <div className="card__foot">
              {summary.youAreIn ? (
                <>
                  <p className="label">Invite code</p>
                  <CopyCode code={summary.inviteCode} />
                </>
              ) : (
                <p className="small dim">
                  The code belongs to its members. {summary.joinMode === 'open'
                    ? 'This group is open, so you do not need one.'
                    : 'Ask somebody in it, or use the control below.'}
                </p>
              )}
              <p className="small dim" style={{ marginTop: 'var(--s3)' }}>
                Members see each other’s unit size and that cannot be turned off while you are a
                member. Stakes are never visible, in a group or out of one.
              </p>
            </div>
          </section>

          {summary.youOwn ? (
            <GroupSettings id={summary.id} joinMode={summary.joinMode} showEditAudit={summary.showEditAudit} />
          ) : null}

          <section className="card">
            <h2 className="card__title">{summary.youAreIn ? 'Leaving' : 'Joining'}</h2>
            <p className="small muted" style={{ marginTop: 'var(--s3)' }}>
              {summary.youAreIn
                ? 'Your units are folded from your own ledger, so they were never this group’s to keep. Leaving takes your row off the board and changes no figure of yours.'
                : 'Your units are folded from your own ledger, so joining copies nothing across: it puts your row on this board and takes it off again if you leave.'}
            </p>
            <div style={{ marginTop: 'var(--s4)' }}>
              {/*  An open group joins from here. A code or approval group
                   sends you to the join screen with nothing in the link: the
                   first version put the invite code in the href, which is the
                   same leak as printing it, one click further away. */}
              {summary.youAreIn ? (
                <LeaveGroup id={summary.id} name={summary.name} members={summary.members} youOwn={summary.youOwn} />
              ) : summary.joinMode === 'open' ? (
                <JoinGroupButton id={summary.id} code={summary.inviteCode} name={summary.name} joinMode={summary.joinMode} />
              ) : (
                <Link href="/app/social/group/join" className="btn btn--sm btn--primary">
                  {summary.joinMode === 'approval' ? 'Ask to join with a code' : 'Join with a code'}
                </Link>
              )}
            </div>
          </section>

          <section className="card">
            <h2 className="card__title">Other groups</h2>
            <ul style={{ marginTop: 'var(--s3)' }}>
              {all.filter((g) => g.id !== summary.id).map((g) => (
                <li key={g.id} className="brow">
                  <Link href={`/app/social/group?id=${g.id}`} className="brow__title" style={{ textDecoration: 'none' }}>{g.name}</Link>
                  <span className="small dim">{plural(g.members, 'Slipper')}</span>
                </li>
              ))}
            </ul>
            <div className="card__foot">
              <Link href="/app/social/group/join" className="btn btn--quiet btn--sm">Join with a code</Link>
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
