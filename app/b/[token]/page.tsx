import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { sharedView } from '@/lib/data/share';
import { MonthCalendar } from '@/components/app/Calendar';
import { ProfitCurve } from '@/components/app/Charts';
import { Icon } from '@/components/Icon';
import { pct, plural, units as fmtUnits } from '@/lib/format';

export const dynamic = 'force-dynamic';

/*  ONE HUNDRED HUNDREDTHS MAKE A UNIT.
 *
 *  lib/data/share.ts hands this page its figures in hundredths of a unit and
 *  never in money, so there is no currency on this page to get wrong. The
 *  calendar and the curve both take a `unitMinor`, which is how many of the
 *  numbers they were given make one unit, and format accordingly: with a
 *  hundred here they draw units, and money() is not reached on any path
 *  through either of them. */
const HUNDREDTHS = 100;

export async function generateMetadata(
  { params }: { params: Promise<{ token: string }> },
): Promise<Metadata> {
  const { token } = await params;
  const view = sharedView(token);
  return {
    title: view ? `${view.name}, shared by @${view.handle}` : 'Not found',
    description: 'A read only view of one balance, in units. No stakes, no money and nothing else about the account.',
    /*  NEVER INDEXED. The whole security of this page is that its address
        cannot be guessed, and a search engine that has crawled it has made
        it guessable. It is also in robots.txt; this is the belt to that
        page's braces, because a crawler that ignores one may honour the
        other. */
    robots: { index: false, follow: false, nocache: true },
  };
}

export default async function SharedBalance(
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const view = sharedView(token);

  /*  A token that was never issued, one that has been revoked and a string
      that is not a token all get the same 404. Telling a stranger which of
      the three they hit tells them something, and the difference between
      "wrong" and "switched off" is the account holder's business. */
  if (!view) notFound();

  const days = view.days.map((d) => ({ day: d.day, netPence: d.units100, count: d.count }));
  const curve = view.curve.map((p) => ({ day: p.day, netPence: p.units100 }));

  return (
    <section className="sect">
      <div className="wrap column column--wide">
        <p className="label">Shared balance</p>
        <h1 className="sect__h" style={{ fontSize: 'clamp(28px, 5vw, 40px)' }}>{view.name}</h1>
        <p className="sect__p">
          Kept by <span className="mono">@{view.handle}</span> and shared with a link. Read only,
          and in units: this page carries no stakes, no balance and no money of any kind.
        </p>

        <div className="grid" style={{ marginTop: 'var(--s7)' }}>
          <div className="card col-6">
            <p className="label">Net, all time</p>
            <p className={`fig ${view.units >= 0 ? 'pos' : 'neg'}`}>{fmtUnits(view.units, { sign: true })}</p>
            <p className="small dim" style={{ marginTop: 4 }}>
              A unit is one normal bet on this balance. What it is worth in money is not on this
              page.
            </p>
          </div>

          <div className="card col-6">
            <div className="row row--wrap" style={{ gap: 'var(--s6)' }}>
              <div>
                <p className="label">Return</p>
                <p className={`fig fig--s tnum ${view.roi >= 0 ? 'pos' : 'neg'}`}>{pct(view.roi, { sign: true })}</p>
              </div>
              <div>
                <p className="label">Bets</p>
                <p className="fig fig--s tnum">{view.bets}</p>
              </div>
              <div>
                <p className="label">Win rate</p>
                <p className="fig fig--s tnum">{pct(view.winRate)}</p>
              </div>
            </div>
            <p className="small dim" style={{ marginTop: 'var(--s4)' }}>
              {view.wins} won, {view.losses} lost, across {plural(view.settled, 'settled bet')}.
              Return is profit over turnover, with voided stakes out of both.
            </p>
          </div>

          <div className="card col-7">
            <div className="card__head">
              <p className="card__title">Calendar</p>
              <p className="card__note">Each day in units</p>
            </div>
            <MonthCalendar
              days={days}
              now={new Date()}
              weekStart={view.weekStart}
              show="both"
              unitMinor={HUNDREDTHS}
              tz={view.timeZone}
            />
          </div>

          <div className="card col-5">
            <div className="card__head">
              <p className="card__title">Profit curve</p>
              <p className="card__note">{view.curve.length} settled days</p>
            </div>
            <ProfitCurve points={curve} unitMinor={HUNDREDTHS} />
          </div>
        </div>

        {/*  WHAT IS NOT HERE, said out loud. A shared record is somebody
             handing a stranger a link, and the first question the stranger's
             own instinct raises is what else they gave away. */}
        <div className="card" style={{ marginTop: 'var(--gap-block)' }}>
          <p className="card__title">What this link does not show</p>
          <ul className="small muted" style={{ marginTop: 'var(--s3)' }}>
            <li>No stakes, no returns and no balance. Every figure here is in units or per cent.</li>
            <li>Nothing about any other balance on this account, and nothing about the account itself beyond the handle above.</li>
            <li>No email address, no individual bets, no bookmakers and no bets that are still running.</li>
            <li>
              Nothing can be changed from this page. The person who owns it can turn the link off
              whenever they like, and it stops working immediately.
            </li>
          </ul>
        </div>

        <div className="row row--wrap" style={{ gap: 'var(--s3)', marginTop: 'var(--gap-block)' }}>
          <Link href="/signup" className="btn btn--primary">
            <Icon name="plus" size={16} /> Keep a record like this
          </Link>
          <Link href="/how" className="btn btn--quiet">How Slippery works</Link>
        </div>
      </div>
    </section>
  );
}
