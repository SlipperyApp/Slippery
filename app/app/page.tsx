import type { Metadata } from 'next';
import Link from 'next/link';
import { getViewer } from '@/lib/data/session';
import {
  select, summarise, byDay, cumulative,
  offerSplit, scopeFromParams, scopeLabel, buildBreakdowns,
} from '@/lib/data/analytics';
import { Breakdown } from '@/components/app/Breakdown';
import { NetHero } from '@/components/app/NetHero';
import { Module, Figure } from '@/components/app/Module';
import { MonthCalendar } from '@/components/app/Calendar';
import { ProfitCurve } from '@/components/app/Charts';
import { Icon } from '@/components/Icon';
import { money, pct, count, plural, longDate } from '@/lib/format';

export const metadata: Metadata = {
  title: 'Dashboard',
  description: 'What your record actually says, across every module at once.',
};

export default async function Dashboard({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const { data, now, trial, demo } = await getViewer();
  const scope = scopeFromParams(sp, demo ? 'all' : undefined);
  const { account, bets } = data;

  const rows = select(bets, scope, now, account.weekStart);
  const s = summarise(rows);
  const curve = cumulative(byDay(rows));
  /*  A curve needs two settled days, and on the first of a month a correct
      scope has one. Rather than a module sized for a picture showing a
      sentence, the curve falls back to the whole record and SAYS SO. An
      unlabelled fallback would be worse than the empty box; a labelled one
      is the answer to the question the empty box raises. */
  const allDays = byDay(select(bets, { ...scope, period: 'all' }, now, account.weekStart));
  const wideCurve = cumulative(allDays);
  const curveIsWide = curve.length < 2 && wideCurve.length > 1;
  const shownCurve = curveIsWide ? wideCurve : curve;
  const offers = offerSplit(bets);
  /*  Six dimensions in one module. Odds and stake used to be two more cards
      beside it, drawing the same row with the same bar. */
  const breakdowns = buildBreakdowns(rows, account.unitPence);
  /* Every settled day the account has: the calendar browses months itself,
     so scoping this to the current one would empty every earlier month. */
  const calendarDays = byDay(select(bets, { ...scope, period: 'all' }, now, account.weekStart));
  /*  The best and worst settled DAY, not bet: a tracker's user thinks in
      sessions, and one +£700 day is a different story from one +£700 bet.
      Computed off the scope's own days so the pair moves with the period
      the rest of the module is describing. */
  const dayNets = byDay(rows);
  const best = dayNets.reduce((a, d) => (d.netPence > a.netPence ? d : a), { day: '', netPence: 0 });
  const worst = dayNets.reduce((a, d) => (d.netPence < a.netPence ? d : a), { day: '', netPence: 0 });

  return (
    <>
      {/*  One h1 per page, and it is not worth 49 pixels of the fold: the
           sidebar, the tab bar and the top bar all say where you are, and the
           first thing under it is a figure the size of a headline. */}
      <h1 className="sr-only">Dashboard</h1>

      {/*  Not in the example account. A trial banner there is an offer nobody
           can act on, stacked under a banner that already says this is not
           your account, and the two of them together took 78 pixels of a 900
           pixel screen before the dashboard began. */}
      {trial.active && !demo ? (
        <div className="banner" style={{ marginBottom: 'var(--s4)' }}>
          <Icon name="clock" size={18} className="banner__icon" />
          <span className="grow">Trial: {trial.message}</span>
          <Link href="/app/settings/plan" className="btn btn--ghost btn--sm">See plans</Link>
        </div>
      ) : null}

      <div className="grid">
        {/* ------------------------------------------------ net, the hero */}
        <NetHero
          summary={s}
          scope={scope}
          scopeLabel={scopeLabel(scope)}
          currency={account.currency}
          unitPence={account.unitPence}
          handle={account.handle}
        />

        {/*  THE FIRST SCREEN IS THREE THINGS. The hero, the calendar and
             what is running. On a 1440 by 900 desktop those fit above the
             fold with the scope bar, which is the whole point: a dashboard
             you have to scroll to read is a report.

             Everything under them is analysis rather than status, and it is
             still here for anybody who wants it. It is just no longer in the
             way of the three figures somebody opened the app to see. */}
        <Module
          title="Calendar"
          span={7}
          size="xl"
          id="mod-calendar"
        >
          <MonthCalendar
            days={calendarDays}
            now={now}
            weekStart={account.weekStart}
            show={account.calendarDates ? 'both' : 'amount'}
            currency={account.currency}
          />
        </Module>


        {/*  THE SECOND HALF OF THE FOLD IS A STATISTIC, NOT A BET.
             What was here was "Running now": two open slips and whatever
             settled today, by name, by price, by bookmaker. Every one of
             those is a question about a particular bet, and a particular bet
             has a page that is entirely about particular bets. It moved to
             the ledger, above the rows, where the open positions sit at the
             top of the list they belong to.

             The record took the slot because it is the same shape of thing
             as the calendar beside it: six numbers that describe the whole
             account and change slowly. It was at the very bottom of the page
             before, under three analysis modules, which is a strange place
             for the six figures somebody would most like at a glance. */}
        <Module title="The record" span={5} size="xl" id="mod-record" note="All time">
          <div className="record">
            <Figure value={pct(s.winRate)} label="Win rate" size="md" sub={`${s.wins} won, ${s.losses} lost`} />
            <Figure value={s.avgOdds.toFixed(2)} label="Average price" size="md" sub={`across ${plural(s.count, 'bet')}`} />
            <Figure value={money(s.avgStakePence, account.currency)} label="Average stake" size="md" sub={`${money(account.unitPence, account.currency)} a unit`} />
            <Figure value={money(s.turnoverPence, account.currency)} label="Turnover" size="md" sub="Void stakes excluded" />
            <Figure value={String(s.longestWin)} label="Longest winning run" size="md" sub={`${s.longestLoss} is the longest losing one`} />
            <Figure value={count(s.voids)} label="Void" size="md" sub="Neither won nor lost" />
            {/*  A fourth row, because six figures left a third of a 444px
                 module empty beside a calendar that fills its own. These two
                 are the pair somebody looks for after the averages: the
                 shape of the tail, which an average hides by construction. */}
            <Figure
              value={money(best.netPence, account.currency, { sign: true })}
              label="Best day"
              tone="pos"
              size="md"
              sub={best.day ? longDate(best.day + 'T12:00:00Z') : 'No settled day yet'}
            />
            <Figure
              value={money(worst.netPence, account.currency, { sign: true })}
              label="Worst day"
              tone={worst.netPence < 0 ? 'neg' : ''}
              size="md"
              sub={worst.day ? longDate(worst.day + 'T12:00:00Z') : 'No settled day yet'}
            />
          </div>
        </Module>

        {/*  Below the fold on purpose, and labelled so it reads as a
             deliberate second half rather than as more dashboard. */}
        <div className="col-12 dash__break">
          <h2 className="label">Analysis</h2>
        </div>

        {/* ------------------------------------------------ profit curve */}
        <Module
          title="Profit curve"
          span={8}
          size="l"
          id="mod-curve"
          note={curveIsWide ? 'All time: this scope has one day' : undefined}
          footer={
            <p className="small dim">
              {shownCurve.length > 1
                ? `${shownCurve.length} settled days, best ${money(Math.max(...(curveIsWide ? allDays : byDay(rows)).map((d) => d.netPence), 0), account.currency, { sign: true })} on a day.`
                : 'A curve needs two settled days.'}
            </p>
          }
        >
          <ProfitCurve points={shownCurve} currency={account.currency} />
        </Module>

        {/* --------------------------------------------- offers vs own */}
        <Module
          title="Offers versus own"
          span={4}
          size="l"
          note="All time"
          id="mod-offers"
        >
          {/*  THE NUMBER, THEN WHAT IT MEANS. Two figures side by side
               leave the reader to do the division and then decide whether
               the answer is good news. The bar does the division and the
               sentence says the thing a bettor is actually afraid this
               number means, which is the only reason it is worth showing:
               a tracker that hides where the profit came from is a tracker
               telling you that you are better than you are. */}
          <Figure
            value={money(offers.ownNetPence, account.currency, { sign: true })}
            label="From your own stake"
            tone={offers.ownNetPence >= 0 ? 'pos' : 'neg'}
            size="md"
            sub={`${plural(offers.ownCount, 'bet')}`}
          />
          <div style={{ marginTop: 'var(--s4)' }}>
            <Figure
              value={money(offers.offerNetPence, account.currency, { sign: true })}
              label="From offers and free bets"
              tone={offers.offerNetPence >= 0 ? 'pos' : 'neg'}
              size="md"
              sub={`${plural(offers.offerCount, 'bet')}`}
            />
          </div>
          <div className="split">
            <span
              className="split__bar"
              role="img"
              aria-label={`${pct(offers.offerSharePct)} of the net came from offers`}
            >
              <span className="split__fill" style={{ width: `${Math.max(0, Math.min(100, offers.offerSharePct))}%` }} />
            </span>
            <p className="small dim split__say">
              {offers.offerSharePct >= 50
                ? `${pct(offers.offerSharePct)} of your net came from offers. That is not a criticism, it is the number most trackers leave out.`
                : `${pct(100 - offers.offerSharePct)} of your net came from your own stake.`}
            </p>
          </div>
        </Module>

        {/* --------------------------------------------------- breakdown */}
        <Module
          title="Breakdown"
          span={12}
          size="l"
          id="mod-breakdown"
        >
          <Breakdown rowsByDim={breakdowns} currency={account.currency} />
        </Module>

      </div>
    </>
  );
}

