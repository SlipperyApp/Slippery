import type { Metadata } from 'next';
import Link from 'next/link';
import { Icon } from '@/components/Icon';
import { getViewer } from '@/lib/data/session';
import { groupByCode } from '@/lib/data/social';
import { JoinGroupButton } from '@/components/app/JoinGroupButton';
import { plural } from '@/lib/format';

export const metadata: Metadata = {
  title: 'Join a group',
  description: 'Six characters from whoever invited you. Open, by code and by approval each behave differently.',
};

/** Matching the code happens HERE, on the server.
 *
 *  The obvious version hands the browser every group and its code and does
 *  the comparison in a click handler, and that ships a directory of every
 *  group's key to anybody who opens the page. The form is a plain GET, so it
 *  works before any JavaScript arrives, and the only code the browser ever
 *  holds is the one somebody typed into it. */
export default async function JoinGroup({
  searchParams,
}: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const { now, source } = await getViewer();
  /*  The groups behind this lookup are the example account's. A real account
      is in none of them and cannot join one, so a code typed by somebody
      signed in matches nothing rather than offering them a seat in a table
      that does not exist. The form itself still works: a real group, once
      groups are real, is found the same way. */
  const knownGroups = source === 'example';
  const typed = (typeof sp.code === 'string' ? sp.code : '').trim().toUpperCase().replace(/[\s-]+/g, '');
  const match = typed && knownGroups ? groupByCode(typed, now) : undefined;

  return (
    <>
      <div className="row" style={{ marginBottom: 'var(--gap-block)' }}>
        <Link href="/app/social" className="btn btn--quiet btn--sm">
          <Icon name="chevronLeft" size={16} /> Social
        </Link>
      </div>

      <h1>Join a group</h1>
      <p className="muted" style={{ marginTop: 'var(--s2)' }}>
        Six characters from whoever invited you. What happens next depends on how the group is
        set up, and the group says which before you press anything.
      </p>

      {/*  Measured at 1440 by 900 with a code in the box: 887 pixels
           against the 824 the window leaves. */}
      <div className="column column--narrow fitcol fitcol--scroll" style={{ marginTop: 'var(--gap-block)', marginInline: 0 }}>
        <form className="card" method="get" action="/app/social/group/join">
          <div className="field field--tight">
            <label className="field__label" htmlFor="join-code">The code</label>
            <input
              id="join-code"
              name="code"
              className="input mono"
              defaultValue={typed}
              maxLength={8}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              placeholder="K7QM2X"
              aria-describedby="join-code-hint"
            />
            <p className="field__hint" id="join-code-hint">
              Case does not matter and the spaces people put in it are ignored.
            </p>
          </div>
          <div className="row" style={{ gap: 'var(--s3)', marginTop: 'var(--s4)', flexWrap: 'wrap' }}>
            <button type="submit" className="btn btn--primary">Find the group</button>
            <Link href="/app/social/discover" className="btn btn--quiet">Browse instead</Link>
          </div>
        </form>

        {typed && !match ? (
          <div className="card" style={{ marginTop: 'var(--s4)' }}>
            <h2 className="card__title">No group has that code</h2>
            <p className="small muted" style={{ marginTop: 'var(--s3)' }}>
              <span className="mono">{typed}</span> does not match anything. A code never contains a
              zero, a one, an O, an I or an L, because those are the four characters people read
              back wrong: a typed O is a zero and a typed l is a one. Ask whoever sent it to copy
              it rather than read it out.
            </p>
            <div className="row" style={{ gap: 'var(--s3)', marginTop: 'var(--s4)', flexWrap: 'wrap' }}>
              <Link href="/app/social/discover" className="btn btn--ghost btn--sm">Find an open group</Link>
              <Link href="/app/social/group/new" className="btn btn--quiet btn--sm">Start your own</Link>
            </div>
          </div>
        ) : null}

        {match ? (
          <div className="card" style={{ marginTop: 'var(--s4)' }}>
            <div className="card__head">
              <h2 className="card__title">{match.name}</h2>
              <span className="pill pill--accent">{match.division}</span>
            </div>
            <p className="small muted" style={{ marginTop: 'var(--s3)' }}>{match.blurb}</p>
            <ul style={{ marginTop: 'var(--s4)' }}>
              <li className="brow"><span className="brow__title">Members</span><span className="small dim">{plural(match.members, 'Slipper')}</span></li>
              <li className="brow"><span className="brow__title">Ranks on</span><span className="small dim">Units, {match.rankingPeriod === 'month' ? 'this month' : match.rankingPeriod === 'year' ? 'this year' : 'all time'}</span></li>
              <li className="brow"><span className="brow__title">Counts</span><span className="small dim">{match.slipBackedOnly ? 'Slip backed only' : 'Every bet'}</span></li>
            </ul>

            {/*  Three modes, three sentences, said before the button rather
                 than after it. "Join" and "Ask to join" are different events
                 and a screen that prints the first when the second happened
                 has put somebody in a table they are not in.

                 Not shown to a member: telling somebody what pressing this
                 will do, above a button saying they are already in, is the
                 screen arguing with itself. */}
            <p className="small muted" style={{ marginTop: 'var(--s4)' }}>
              {match.youAreIn
                ? 'You are already a member, so there is nothing to press. Your units have been in its table since you joined.'
                : match.joinMode === 'open'
                  ? 'This group is open. Pressing this puts you in it now.'
                  : match.joinMode === 'code'
                    ? 'This group is joined by code. You have the code, so pressing this puts you in it now.'
                    : 'This group approves each request. Pressing this sends one to the admin, and you are not in the table until they say yes.'}
            </p>

            <div style={{ marginTop: 'var(--s4)' }}>
              {match.youAreIn ? (
                <Link href={`/app/social/group?id=${match.id}`} className="btn btn--primary">
                  <Icon name="check" size={15} /> You are already in {match.name}
                </Link>
              ) : (
                <JoinGroupButton id={match.id} code={match.inviteCode} name={match.name} joinMode={match.joinMode} />
              )}
            </div>
          </div>
        ) : null}

        {!typed ? (
          <p className="small dim" style={{ marginTop: 'var(--s4)' }}>
            Nothing about you is shown to a group until you are in it, and a group never sees a
            stake. What it sees is units, a record and a return.
          </p>
        ) : null}
      </div>
    </>
  );
}
