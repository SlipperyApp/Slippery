import type { Metadata } from 'next';
import Link from 'next/link';
import { Icon } from '@/components/Icon';
import { demoData } from '@/lib/data/demo';
import { select, summarise, byDay, cumulative, offerSplit, runningNow, breakdown, DEFAULT_SCOPE } from '@/lib/data/analytics';
import { ProfitCurve } from '@/components/app/Charts';
import { MonthCalendar } from '@/components/app/Calendar';
import { BetRow } from '@/components/app/BetRow';
import { money, pct, count, units as fmtUnits, MONTH_LONG, londonParts } from '@/lib/format';
import { Breadcrumbs } from '@/components/marketing/Breadcrumbs';
import { StickyCta } from '@/components/marketing/StickyCta';

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
  const { account, bets } = data;

  const all = select(bets, { ...DEFAULT_SCOPE, period: 'all' }, now);
  const s = summarise(all);
  const curve = cumulative(byDay(all));
  const offers = offerSplit(bets);
  const running = runningNow(bets);
  const bySport = breakdown(all, 'sport');
  const p = londonParts(now);

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
          <span className="mono">@{account.handle}</span> has {count(s.count)} bets across six
          months. Every figure below is folded by the function your own ledger uses, from the same append only events. Nothing here can flatter itself.
        </p>

        <div className="grid" style={{ marginTop: 'var(--s7)' }}>
          <div className="card col-4">
            <p className="label">All time</p>
            <p className={`fig ${s.netPence >= 0 ? 'pos' : 'neg'}`}>{money(s.netPence, account.currency, { sign: true })}</p>
            <p className="small dim" style={{ marginTop: 4 }}>{fmtUnits(s.units, { sign: true })} on a {money(account.unitPence)} unit</p>
            <div className="row" style={{ marginTop: 'var(--s5)', gap: 'var(--s5)' }}>
              <div><p className="label">Return</p><p className={`fig fig--s ${s.roi >= 0 ? 'pos' : 'neg'}`}>{pct(s.roi, { sign: true })}</p></div>
              <div><p className="label">Turnover</p><p className="fig fig--s tnum">{money(s.turnoverPence)}</p></div>
            </div>
          </div>

          <div className="card col-8">
            <div className="card__head">
              <p className="card__title">Profit curve</p>
              <p className="card__note">{curve.length} settled days</p>
            </div>
            <ProfitCurve points={curve} currency={account.currency} />
          </div>

          <div className="card col-4">
            <div className="card__head">
              <p className="card__title">{MONTH_LONG[p.month - 1]}</p>
              <p className="card__note">Europe/London days</p>
            </div>
            <MonthCalendar days={byDay(all)} now={now} weekStart={account.weekStart} currency={account.currency} />
          </div>

          <div className="card col-4">
            <div className="card__head">
              <p className="card__title">Money you won</p>
              <p className="card__note">All time</p>
            </div>
            <p className={`fig fig--m ${offers.ownNetPence >= 0 ? 'pos' : 'neg'}`}>{money(offers.ownNetPence, account.currency, { sign: true })}</p>
            <p className="small dim">{count(offers.ownCount)} bets with your own stake</p>
            <p className="label" style={{ marginTop: 'var(--s5)' }}>Money they gave you</p>
            <p className="fig fig--m">{money(offers.offerNetPence, account.currency, { sign: true })}</p>
            <p className="small dim">{pct(offers.offerSharePct)} of the total, from {count(offers.offerCount)} offers</p>
          </div>

          <div className="card col-4">
            <div className="card__head">
              <p className="card__title">By sport</p>
              <p className="card__note">Count beside each</p>
            </div>
            <ul>
              {bySport.map((r) => (
                <li key={r.key} className={`brow${r.thin ? ' brow--faded' : ''}`}>
                  <span className="brow__title">{r.label} <span className="small dim tnum">{r.count}</span></span>
                  <span className={`fig fig--s tnum ${r.netPence >= 0 ? 'pos' : 'neg'}`}>{money(r.netPence, account.currency, { sign: true })}</span>
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
              <ul>{running.slice(0, 5).map((b) => <BetRow key={b.id} bet={b} currency={account.currency} />)}</ul>
            ) : (
              <p className="small dim">Nothing running at this exact moment. The example account settles as the day goes on.</p>
            )}
          </div>
        </div>

        <div className="card" style={{ marginTop: 'var(--s6)', alignItems: 'flex-start' }}>
          <p className="card__title">Walk around it properly</p>
          <p className="small muted" style={{ marginTop: 'var(--s2)', maxWidth: '56ch' }}>
            The example account is open in the product itself. Every module, the ledger, the
            groups and every setting, with a note at the top saying it is an example.
          </p>
          <div className="row" style={{ marginTop: 'var(--s5)', gap: 'var(--s4)' }}>
            <Link href="/app" className="btn btn--primary">Open the example account <Icon name="arrowRight" size={16} /></Link>
            <Link href="/signup" className="btn btn--link">Start your own</Link>
          </div>
        </div>
      </div>
    </section>

    <StickyCta />
    </>
  );
}
