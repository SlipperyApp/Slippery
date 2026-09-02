import type { Metadata } from 'next';
import Link from 'next/link';
import { Icon } from '@/components/Icon';
import { demoData } from '@/lib/data/demo';
import { inBalance } from '@/lib/domain/balances';
import { select, summarise, byDay, cumulative, offerSplit, runningNow, breakdown, DEFAULT_SCOPE } from '@/lib/data/analytics';
import { ProfitCurve } from '@/components/app/Charts';
import { MonthCalendar } from '@/components/app/Calendar';
import { timeZoneLabel } from '@/lib/data/reference';
import { BetRow } from '@/components/app/BetRow';
import { money, pct, count, plural, units as fmtUnits } from '@/lib/format';
import { Breadcrumbs } from '@/components/marketing/Breadcrumbs';
import { StickyCta } from '@/components/marketing/StickyCta';
import { EndCard } from '@/components/MarketingChrome';

export const metadata: Metadata = {
  title: 'The example account',
  description:
    'A real, working account with six months of history: the ledger, the calendar, the curve and the split between money you won and money they gave you.',
  alternates: { canonical: '/demo' },
  openGraph: {
    title: 'Slippery, the example account',
    description: 'Six months of history, every figure folded by the same code your own ledger would use.',
    url: '/demo',
    images: [{ url: '/og?title=The+example+account&sub=%40tester123', width: 1200, height: 630, alt: 'The Slippery example account' }],
  },
};

export default function Demo() {
  const now = new Date();
  const data = demoData(now);
  const { account } = data;
  /*  ONE BALANCE, and it is the main one.
   *
   *  The example account keeps three, and one of them is in euro. This page
   *  prints money, so showing "the account" would mean adding a euro account
   *  to two sterling ones for a headline figure. It shows the balance the
   *  app opens on and names it, which is the same thing the product does. */
  const main = data.balances[0];
  const bets = inBalance(data.bets, main.id);

  const all = select(bets, { ...DEFAULT_SCOPE, period: 'all' }, now, account.weekStart, account.timeZone);
  const s = summarise(all);
  const curve = cumulative(byDay(all, account.timeZone));
  const offers = offerSplit(bets);
  const running = runningNow(bets);
  const bySport = breakdown(all, 'sport');

  return (
    <>
    <section className="sect">
      <div className="wrap">
        <Breadcrumbs trail={[{ href: '/', label: 'Slippery' }]} page="The example account" />
        <h1 className="sect__h" style={{ fontSize: 'clamp(30px, 6vw, 48px)' }}>
          <span className="setup">Not a screenshot.</span>
          <span>The account, running, right now.</span>
        </h1>
        <p className="sect__p">
          <span className="mono">@{account.handle}</span> has {plural(s.count, 'bet')} in
          their {main.name} balance across six months. Every figure below is folded by the function your own ledger uses, from the same append only events. Nothing here can flatter itself.
        </p>

        <div className="grid" style={{ marginTop: 'var(--s7)' }}>
          <div className="card col-4">
            <p className="label">All time</p>
            <p className={`fig ${s.netPence >= 0 ? 'pos' : 'neg'}`}>{money(s.netPence, main.currency, { sign: true })}</p>
            <p className="small dim" style={{ marginTop: 4 }}>{fmtUnits(s.units, { sign: true })} on a {money(main.unitMinor, main.currency)} unit</p>
            {/*  At the foot, because the profit curve beside this is taller
                 and every card in a grid row stretches to the tallest. Under
                 the figure these two left ninety pixels of empty card; at
                 the bottom they close it. */}
            <div className="row card__foot" style={{ gap: 'var(--s5)' }}>
              <div><p className="label">Return</p><p className={`fig fig--s ${s.roi >= 0 ? 'pos' : 'neg'}`}>{pct(s.roi, { sign: true })}</p></div>
              <div><p className="label">Turnover</p><p className="fig fig--s tnum">{money(s.turnoverPence)}</p></div>
            </div>
          </div>

          <div className="card col-8">
            <div className="card__head">
              <p className="card__title">Profit curve</p>
              <p className="card__note">{curve.length} settled days</p>
            </div>
            <ProfitCurve points={curve} currency={main.currency} />
          </div>

          <div className="card col-4">
            <div className="card__head">
              {/*  "Calendar", not the month's own name: the control directly
                   under this prints "September 2026" and a card headed
                   September above it is the same word twice, one line apart,
                   one of them without the year. The dashboard names this
                   module the same way. */}
              <p className="card__title">Calendar</p>
              {/*  The account's own zone, not a literal. Every day boundary in the
                   product takes it, and a caption that names one zone while the
                   account keeps another is the disagreement the field exists
                   to end. */}
              <p className="card__note">{timeZoneLabel(account.timeZone)} days</p>
            </div>
            <MonthCalendar days={byDay(all, account.timeZone)} now={now} weekStart={account.weekStart} currency={main.currency} tz={account.timeZone} />
          </div>

          <div className="card col-4">
            <div className="card__head">
              <p className="card__title">Money you won</p>
              <p className="card__note">All time</p>
            </div>
            <p className={`fig fig--m ${offers.ownNetPence >= 0 ? 'pos' : 'neg'}`}>{money(offers.ownNetPence, main.currency, { sign: true })}</p>
            <p className="small dim">{plural(offers.ownCount, 'bet')} with your own stake</p>
            <p className="label" style={{ marginTop: 'var(--s5)' }}>Money they gave you</p>
            <p className="fig fig--m">{money(offers.offerNetPence, main.currency, { sign: true })}</p>
            <p className="small dim">{pct(offers.offerSharePct)} of the total, from {count(offers.offerCount)} offers</p>
          </div>

          <div className="card col-4">
            <div className="card__head">
              {/*  The count IS beside each, in the rows below, so the note
                   saying so was describing the layout to somebody looking
                   straight at it. */}
              <p className="card__title">By sport</p>
            </div>
            <ul>
              {bySport.map((r) => (
                <li key={r.key} className={`brow${r.thin ? ' brow--faded' : ''}`}>
                  <span className="brow__title">{r.label} <span className="small dim tnum">{r.count}</span></span>
                  <span className={`fig fig--s tnum ${r.netPence >= 0 ? 'pos' : 'neg'}`}>{money(r.netPence, main.currency, { sign: true })}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="card col-12">
            <div className="card__head">
              <p className="card__title">Running now</p>
              <p className="card__note">{running.length} open</p>
            </div>
            {running.length ? (
              <ul>{running.slice(0, 5).map((b) => <BetRow key={b.id} bet={b} currency={main.currency} tz={account.timeZone} />)}</ul>
            ) : (
              <p className="small dim">Nothing running at this exact moment. The example account settles as the day goes on.</p>
            )}
          </div>
        </div>

        <div style={{ marginTop: 'var(--s6)' }}>
          <EndCard
            title="Walk around it properly"
            actions={
              <>
                <Link href="/app" className="btn btn--primary">Open the example account <Icon name="arrowRight" size={16} /></Link>
                <Link href="/signup" className="btn btn--link">Start your own</Link>
              </>
            }
          >
            Every module, the ledger, the groups and every setting, in the product itself.
          </EndCard>
        </div>
      </div>
    </section>

    <StickyCta />
    </>
  );
}
