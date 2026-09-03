import type { Metadata } from 'next';
import Link from 'next/link';
import { Icon } from '@/components/Icon';
import { demoData } from '@/lib/data/demo';
import { inBalance } from '@/lib/domain/balances';
import {
  select, summarise, byDay, cumulative, offerSplit, buildBreakdowns, DEFAULT_SCOPE, scopeLabel,
  runningTotal, runningRoi,
} from '@/lib/data/analytics';
import { ProfitCurve } from '@/components/app/Charts';
import { MonthCalendar } from '@/components/app/Calendar';
import { Module, Figure } from '@/components/app/Module';
import { Tile } from '@/components/app/Tile';
import { Breakdown } from '@/components/app/Breakdown';
import { ledgerSummary, isImported, heldOutSentence } from '@/lib/data/ledger-shape';
import { summariseClosing } from '@/lib/domain/closing';
import { money, pct, count, plural, longDate, units as fmtUnits } from '@/lib/format';
import { Breadcrumbs } from '@/components/marketing/Breadcrumbs';
import { StickyCta } from '@/components/marketing/StickyCta';
import { EndCard } from '@/components/MarketingChrome';

export const metadata: Metadata = {
  title: 'The example account',
  description:
    'The dashboard itself, on six months of history: the net, the calendar, the record, the curve, the offer split and the breakdown.',
  alternates: { canonical: '/demo' },
  openGraph: {
    title: 'Slippery, the example account',
    description: 'The dashboard itself, on six months of history.',
    url: '/demo',
    images: [{ url: '/og?title=The+example+account&sub=%40tester123', width: 1200, height: 630, alt: 'The Slippery example account' }],
  },
};

/** The dashboard, on the marketing side, module for module.
 *
 *  WHAT THIS PAGE USED TO BE. Six cards of its own choosing, in its own order,
 *  with a "Running now" module the dashboard has not had since that module
 *  moved to the ledger, and a "By sport" list the dashboard draws as one of
 *  six dimensions inside Breakdown. It looked like the product and it was not
 *  the product, so the screen somebody decided on and the screen they got were
 *  two different screens.
 *
 *  Every module below is the dashboard's own component, with the dashboard's
 *  title, note and footer, in the dashboard's order, folded from the same
 *  functions. app/app/page.tsx is the authority; this follows it.
 *
 *  TWO THINGS THE DASHBOARD HAS THAT THIS CANNOT. The net card there carries a
 *  scope bar, a share control and a target you can set, and all three write to
 *  an account. A control on a public page that changed nothing would be worse
 *  than not drawing it, so the net card here is the same card with the tools
 *  left off, and the page says which scope it is fixed at.
 *
 *  ONE BALANCE, AND IT IS THE MAIN ONE. The example account keeps three and
 *  one is in euro. The dashboard reads whichever balance is open and never
 *  sees a second currency; this reads the one the app opens on, which is the
 *  same rule arrived at from the other side. */
export default function Demo() {
  const now = new Date();
  const data = demoData(now);
  const { account } = data;
  const main = data.balances[0];
  const bets = inBalance(data.bets, main.id);

  /*  All time, the period the example account opens on. See scopeFromParams:
      on the first of a month "this month" is one day and every module reads
      empty, which is the product looking broken while working correctly. */
  const scope = { ...DEFAULT_SCOPE, period: 'all' as const };
  const tz = account.timeZone;
  const rows = select(bets, scope, now, account.weekStart, tz);
  const s = summarise(rows);
  const curve = cumulative(byDay(rows, tz));
  const offers = offerSplit(bets);
  const closing = summariseClosing(rows);
  const breakdowns = buildBreakdowns(rows, account.unitPence);
  const L = ledgerSummary(rows, tz);
  const dayNets = byDay(rows.filter((b) => !isImported(b) && !b.arbGroupId), tz);
  const best = dayNets.reduce((a, d) => (d.netPence > a.netPence ? d : a), { day: '', netPence: 0 });
  const worst = dayNets.reduce((a, d) => (d.netPence < a.netPence ? d : a), { day: '', netPence: 0 });

  return (
    <>
      <section className="sect">
        <div className="wrap">
          <Breadcrumbs trail={[{ href: '/', label: 'Slippery' }]} page="The example account" />
          <h1 className="sect__h" style={{ fontSize: 'clamp(30px, 6vw, 48px)' }}>
            <span className="setup">Not a screenshot.</span>
            <span>The dashboard you get, on six months of bets.</span>
          </h1>
          <p className="sect__p">
            <span className="mono">@{account.handle}</span> has {plural(s.count, 'bet')} in their{' '}
            {main.name} balance. Every figure is folded by the function your own ledger uses, from
            the same append only events.
          </p>

          <div className="grid" style={{ marginTop: 'var(--s7)' }}>
            {/*  THE DASHBOARD'S OWN FOUR TILES, and they are the reason this
                 block was rewritten rather than restyled.

                 This was a `hero-net` card, and .hero-net, .hero-net__head,
                 .hero-net__fig, .hero-net__row and .hero-net__stats have no
                 rule anywhere in the stylesheet: the dashboard's hero was
                 replaced by these four tiles and its CSS went with it, while
                 this page kept the markup. What shipped was five unstyled
                 lines in the corner of a full width card, reading "UNITS
                 +94.00u" and "RETURN+40.0%" with the label welded to the
                 figure. It is the page the landing hero sends people to.

                 Using Tile also settles the question this page exists to
                 settle: the screen somebody decides on is the screen they
                 get, module for module, including which figure is filled. */}
            <Tile
              accent
              label={`Net, ${scopeLabel(scope).toLowerCase()}`}
              value={money(s.netPence, main.currency, { sign: true })}
              sub={`${fmtUnits(s.units, { sign: true })} over ${plural(s.count, 'bet')}`}
              spark={curve.map((pt) => pt.netPence)}
              sparkTone="ink"
            />
            <Tile
              label="Turnover"
              value={money(s.turnoverPence, main.currency)}
              sub={`${money(s.avgStakePence, main.currency)} average stake`}
              spark={runningTotal(byDay(rows, tz).map((d) => d.turnoverPence))}
              sparkTone="ink"
            />
            <Tile
              label="Return"
              value={pct(s.roi, { sign: true })}
              tone={s.roi > 0 ? 'pos' : s.roi < 0 ? 'neg' : ''}
              sub={plural(s.settled, 'settled bet')}
              spark={runningRoi(byDay(rows, tz))}
              sparkTone={s.roi >= 0 ? 'pos' : 'neg'}
            />
            <Tile
              label="Bets"
              value={count(s.count)}
              sub={s.open > 0 ? `${count(s.open)} still running` : `${count(s.settled)} settled`}
              spark={runningTotal(byDay(rows, tz).map((d) => d.count))}
              sparkTone="ink"
            />

            <Module title="Calendar" span={7} size="xl" id="demo-calendar">
              <MonthCalendar
                days={byDay(select(bets, scope, now, account.weekStart, tz), tz)}
                now={now}
                weekStart={account.weekStart}
                show={account.calendarDates ? 'both' : 'amount'}
                currency={main.currency}
                tz={tz}
              />
            </Module>

            <Module
              title="The record"
              span={5}
              size="xl"
              id="demo-record"
              note="All time"
              footer={
                <p className="small dim">
                  {heldOutSentence(L.heldOut)}
                  {L.importedBets > 0
                    ? ` Best day, worst day and the run count the ${plural(L.bets - L.importedBets, 'bet')} placed through Slippery, not imported history.`
                    : ''}
                </p>
              }
            >
              <div className="record">
                <div>
                  <p className="label">Win rate</p>
                  <p className="fig">{pct(s.winRate)}</p>
                  <p className="small dim">
                    {s.wins} won, {s.losses} lost
                    {s.voids + s.placed === 0
                      ? '.'
                      : s.placed > 0
                        ? `, ${count(s.voids + s.placed)} void or placed. Neither is a win or a loss.`
                        : `, ${count(s.voids)} void. A void is neither.`}
                  </p>
                </div>

                <div className="record__three">
                  <Figure value={s.avgOdds.toFixed(2)} label="Average price" size="md" />
                  <Figure value={money(s.avgStakePence, main.currency)} label="Average stake" size="md" sub={`${money(main.unitMinor, main.currency)} a unit`} />
                  <Figure value={String(s.longestWin)} label="Longest win run" size="md" sub={`${s.longestLoss} is the longest losing one`} />
                </div>

                <ul className="record__rows">
                  <li className="brow">
                    <span style={{ minWidth: 0 }}>
                      <span className="brow__title">Best day</span>
                      <span className="brow__sub">{best.day ? longDate(best.day + 'T12:00:00Z', 'UTC') : 'No settled day yet'}</span>
                    </span>
                    <span className="fig fig--s tnum pos">{money(best.netPence, main.currency, { sign: true })}</span>
                  </li>
                  <li className="brow">
                    <span style={{ minWidth: 0 }}>
                      <span className="brow__title">Worst day</span>
                      <span className="brow__sub">{worst.day ? longDate(worst.day + 'T12:00:00Z', 'UTC') : 'No settled day yet'}</span>
                    </span>
                    <span className={`fig fig--s tnum ${worst.netPence < 0 ? 'neg' : ''}`}>
                      {money(worst.netPence, main.currency, { sign: true })}
                    </span>
                  </li>
                </ul>
              </div>
            </Module>

            <div className="col-12 dash__break spread" style={{ flexWrap: 'wrap' }}>
              <h2 className="label">Analysis</h2>
            </div>

            <Module
              title="Profit curve"
              span={12}
              size="l"
              id="demo-curve"
              footer={
                <p className="small dim">
                  {curve.length > 1
                    ? `${curve.length} settled days, best ${money(Math.max(...byDay(rows, tz).map((d) => d.netPence), 0), main.currency, { sign: true })} on a day.`
                    : 'A curve needs two settled days.'}
                </p>
              }
            >
              <ProfitCurve points={curve} currency={main.currency} />
            </Module>

            <Module title="Offers versus own" span={12} size="auto" note="All time" id="demo-offers">
              <div className="offsplit">
                <Figure
                  value={money(offers.ownNetPence, main.currency, { sign: true })}
                  label="From your own stake"
                  tone={offers.ownNetPence >= 0 ? 'pos' : 'neg'}
                  size="md"
                  sub={`${plural(offers.ownCount, 'bet')}`}
                />
                <Figure
                  value={money(offers.offerNetPence, main.currency, { sign: true })}
                  label="From offers and free bets"
                  tone={offers.offerNetPence >= 0 ? 'pos' : 'neg'}
                  size="md"
                  sub={`${plural(offers.offerCount, 'bet')}`}
                />
                <div className="offsplit__read">
                  <span
                    className="split__bar"
                    role="img"
                    aria-label={`${pct(offers.offerSharePct)} of the net came from offers`}
                  >
                    <span className="split__fill" style={{ width: `${Math.max(0, Math.min(100, offers.offerSharePct))}%` }} />
                  </span>
                  <p className="small dim split__say">
                    {offers.offerSharePct >= 50
                      ? `${pct(offers.offerSharePct)} of this net came from offers. That is not a criticism, it is the number most trackers leave out.`
                      : `${pct(100 - offers.offerSharePct)} of this net came from their own stake.`}
                  </p>
                </div>
              </div>
            </Module>

            {closing.recorded > 0 && closing.meanPct !== null ? (
              <Module
                title="Closing price"
                span={12}
                size="auto"
                id="demo-closing"
                note="Prices they recorded"
                footer={
                  <p className="small dim">
                    A plus means the price taken was the longer of the two. On a lay it is worked
                    out the other way round, because a layer wants the shorter price. Nothing in
                    Slippery works a closing price out: every one of these came from the account
                    holder.
                  </p>
                }
              >
                <div className="clvmod">
                  <Figure
                    value={`${closing.recorded} of ${closing.of}`}
                    label="Bets with a price recorded"
                    size="md"
                    sub="The rest are not counted as level"
                  />
                  <Figure
                    value={pct(closing.meanPct, { sign: true })}
                    label="Average against the close"
                    tone={closing.meanPct > 0 ? 'pos' : closing.meanPct < 0 ? 'neg' : ''}
                    size="md"
                    sub={`across the ${plural(closing.recorded, 'bet')} that carry one`}
                  />
                  <Figure
                    value={count(closing.beat)}
                    label="Ahead of the close"
                    size="md"
                    sub={`${closing.matched} level, ${closing.missed} behind`}
                  />
                  <Figure
                    value={closing.bestPct === null ? '' : pct(closing.bestPct, { sign: true })}
                    label="Widest gap in their favour"
                    size="md"
                    sub={closing.worstPct === null ? '' : `${pct(closing.worstPct, { sign: true })} is the widest against`}
                  />
                </div>
              </Module>
            ) : null}

            <Module title="Breakdown" span={12} size="auto" id="demo-breakdown">
              <Breakdown rowsByDim={breakdowns} currency={main.currency} />
            </Module>
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
              The ledger, the slips, the groups and every setting, in the product itself.
            </EndCard>
          </div>
        </div>
      </section>

      <StickyCta />
    </>
  );
}
