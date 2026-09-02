import type { Metadata } from 'next';
import Link from 'next/link';
import { Icon } from '@/components/Icon';
import { getViewer } from '@/lib/data/session';
import { EmptySocial, SOCIAL_EXAMPLE_NOTE } from '@/components/app/EmptySocial';
import { LEAGUE_PERIODS, YOU, league, slippers, type LeaguePeriod } from '@/lib/data/social';
import { LeagueBoard } from '@/components/app/LeagueTable';
import { Podium } from '@/components/app/Podium';
import { position as fmtPosition, plural } from '@/lib/format';

export const metadata: Metadata = {
  title: 'Leaderboard',
  description: 'Every Slipper you can see, ranked in units over the month, the year or all time.',
};

/*  ALL TIME IS THE DEFAULT, and This month is a tab.
 *
 *  A monthly table on the second of a month is a table of two days: almost
 *  every row reads no bets and 0.0u, which is true and is also a screen that
 *  looks broken twelve times a year for reasons that have nothing to do with
 *  the person reading it. The month is still one tap away and a group still
 *  ranks over whatever period it chose, so nothing is hidden; what changes is
 *  which table somebody arrives at. */
function periodFrom(v: string | string[] | undefined): LeaguePeriod {
  const s = Array.isArray(v) ? v[0] : v;
  return LEAGUE_PERIODS.some((p) => p.id === s) ? (s as LeaguePeriod) : 'all';
}

export default async function Leaderboard({
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
    return <EmptySocial title="Leaderboard" note={SOCIAL_EXAMPLE_NOTE} />;
  }

  const period = periodFrom(sp.period);
  const board = league(slippers(now), period);
  const you = board.find((r) => r.handle === YOU);
  const label = LEAGUE_PERIODS.find((p) => p.id === period)!.label.toLowerCase();

  return (
    <>
      <div className="row" style={{ marginBottom: 'var(--gap-block)' }}>
        <Link href="/app/social" className="btn btn--quiet btn--sm">
          <Icon name="chevronLeft" size={16} /> Social
        </Link>
      </div>

      <h1>Leaderboard</h1>
      <p className="muted" style={{ marginTop: 'var(--s2)' }}>
        Ranked in units, so a Slipper staking £5 and a Slipper staking £500 sit in the same table.
        Nobody&rsquo;s stake appears here, and no figure on this page is money.
      </p>

      <div className="seg seg--gap" role="group" aria-label="Period" style={{ marginTop: 'var(--s5)' }}>
        {LEAGUE_PERIODS.map((p) => (
          <Link
            key={p.id}
            href={`/app/social/leaderboard?period=${p.id}`}
            className="seg__btn"
            aria-current={p.id === period ? 'page' : undefined}
          >
            {p.label}
          </Link>
        ))}
      </div>

      {/*  ONE CARD, the way a group's board is one card. The podium and the
           table are the same board read two ways, and two page wide cards
           for them put a heading and a border between the three names at the
           top and the twelve rows those three names came out of. */}
      <div className="grid" style={{ marginTop: 'var(--s4)' }}>
        <section className="card col-12">
          <div className="card__head">
            <h2 className="card__title">The table, {label}</h2>
            <p className="card__note">{plural(board.length, 'Slipper')}, units to 1dp</p>
          </div>
          <LeagueBoard
            rows={board}
            you={YOU}
            period={label}
            now={now.toISOString()}
            podium={<Podium rows={board} you={YOU} period={label} />}
          />
          <p className="small dim card__foot">
            {you
              ? `You are ${fmtPosition(you.position, board.length)} ${label}. `
              : ''}
            {/*  A division moves at the end of a month and the sentence states
                 the move and stops. There is no word here for going down,
                 because a table that shouts at somebody for a bad month is a
                 table that asks them to bet their way out of it. */}
            Divisions are set on the last day of the month.
          </p>
        </section>
      </div>
    </>
  );
}
