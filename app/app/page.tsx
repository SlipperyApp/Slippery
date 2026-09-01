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
import { money, pct, count } from '@/lib/format';

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
            <Figure value={s.avgOdds.toFixed(2)} label="Average price" size="md" sub={`across ${count(s.count)} bets`} />
            <Figure value={money(s.avgStakePence, account.currency)} label="Average stake" size="md" sub={`${money(account.unitPence, account.currency)} a unit`} />
            <Figure value={money(s.turnoverPence, account.currency)} label="Turnover" size="md" sub="Void stakes excluded" />
            <Figure value={String(s.longestWin)} label="Longest winning run" size="md" sub={`${s.longestLoss} is the longest losing one`} />
            <Figure value={count(s.voids)} label="Void" size="md" sub="Neither won nor lost" />
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
          size="m"
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
          size="m"
          note="All time"
          id="mod-offers"
        >
          <Figure
            value={money(offers.ownNetPence, account.currency, { sign: true })}
            label="Money you won"
            tone={offers.ownNetPence >= 0 ? 'pos' : 'neg'}
            size="md"
            sub={`${count(offers.ownCount)} bets with your own stake`}
          />
          <div style={{ marginTop: 'var(--s4)' }}>
            <Figure
              value={money(offers.offerNetPence, account.currency, { sign: true })}
              label="Money they gave you"
              size="md"
              sub={`${count(offers.offerCount)} bets, ${pct(offers.offerSharePct)} of the total`}
            />
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

