import type { Metadata } from 'next';
import Link from 'next/link';
import { getViewer } from '@/lib/data/session';
import {
  select, summarise, byDay, byMonth, cumulative, runningTotal, runningRoi,
  scopeFromParams, scopeLabel, buildBreakdowns,
} from '@/lib/data/analytics';
import { Breakdown } from '@/components/app/Breakdown';
import { Onboarding } from '@/components/app/Onboarding';
import { Module } from '@/components/app/Module';
import { Tile } from '@/components/app/Tile';
import { Radial } from '@/components/app/Radial';
import { MonthCalendar } from '@/components/app/Calendar';
import { ProfitCurve } from '@/components/app/Charts';
import { PeriodSeg, ScopeFilters } from '@/components/app/ScopeBar';
import { ModuleMenu } from '@/components/app/ModuleMenu';
import { Icon } from '@/components/Icon';
import { money, pct, count, plural, longDate, units as fmtUnits } from '@/lib/format';
import { summariseClosing, closingRunning } from '@/lib/domain/closing';
import { EmptyDashboard } from '@/components/app/EmptyDashboard';
import { emptyReason } from '@/lib/data/viewer';

export const metadata: Metadata = {
  title: 'Dashboard',
  description: 'What your record actually says, across every module at once.',
};

/** How many months the list beside the curve draws. MEASURED, not chosen:
 *  the card is one row of a grid sized to the window, which at 1440 by 900
 *  leaves it 164 pixels of list, and a month row is 35 of them. Five put the
 *  last one under the card's own edge, where overflow:hidden ate it. */
const MONTHS_SHOWN = 4;

export default async function Dashboard({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const { data, now, trial, demo, onboarding, source, storeReady } = await getViewer();

  /*  NOTHING TO SHOW IS ITS OWN SCREEN, and it is reached the moment the
      account has no rows. What used to happen here is that the example
      account's 259 bets were folded into this page for anybody holding a
      session cookie, so a new customer's first dashboard was a stranger's
      record with the "Example" label removed. See lib/data/viewer.ts. */
  if (source === 'empty') {
    return <EmptyDashboard signals={onboarding} trial={trial} reason={emptyReason(storeReady)} />;
  }

  const scope = scopeFromParams(sp, demo ? 'all' : undefined);
  const { account, bets } = data;
  const cur = account.currency;

  const tz = account.timeZone;
  const rows = select(bets, scope, now, account.weekStart, tz);
  const s = summarise(rows);
  const days = byDay(rows, tz);
  const curve = cumulative(days);
  /*  A curve needs two settled days, and on the first of a month a correct
      scope has one. Rather than a module sized for a picture showing a
      sentence, the curve falls back to the whole record and SAYS SO. An
      unlabelled fallback would be worse than the empty box; a labelled one
      is the answer to the question the empty box raises. */
  const allRows = select(bets, { ...scope, period: 'all' }, now, account.weekStart, tz);
  const allDays = byDay(allRows, tz);
  const wideCurve = cumulative(allDays);
  const curveIsWide = curve.length < 2 && wideCurve.length > 1;
  const shownCurve = curveIsWide ? wideCurve : curve;

  /*  THE CLOSING PRICE, over only the bets that carry one.
   *
   *  Not every account will ever have one of these, which is the whole
   *  reason the tile below is conditional: the version of this that shipped
   *  and was deleted printed "Not measured" on every account every day
   *  because no price feed existed, and a module that exists to say it has
   *  nothing to say is worse than no module. Now the number comes from the
   *  account holder, so an account that has recorded none simply does not
   *  draw it, and the fourth tile counts bets instead.
   *
   *  IT IS A SHAPE NOW AND NOT A PARAGRAPH. It was four figures and two
   *  sentences across a full width module. What a reader wants from it is
   *  whether they are consistently ahead of the closing price, which is a
   *  line, and the coverage, which is the caption. Both fit in a tile. */
  const closing = summariseClosing(rows);
  const closingLine = closingRunning(
    [...rows].sort((a, b) => Date.parse(a.eventAt) - Date.parse(b.eventAt)),
  );

  /*  Six dimensions in one module. Odds and stake used to be two more cards
      beside it, drawing the same row with the same bar. */
  const breakdowns = buildBreakdowns(rows, account.unitPence);
  /* Every settled day the account has: the calendar browses months itself,
     so scoping this to the current one would empty every earlier month. */
  const calendarDays = allDays;

  /*  THE MONTHS, and they take the same fallback the curve does. On the
      default scope, which is this month, byMonth over the scope returns one
      row, and a list card with one row in it is a card with nothing to
      compare. Where the scope holds fewer than two the list widens to the
      whole record and the module's own note says so. */
  const scopeMonths = byMonth(rows, tz);
  const allMonths = byMonth(allRows, tz);
  const monthsAreWide = scopeMonths.length < 2 && allMonths.length > 1;
  const months = (monthsAreWide ? allMonths : scopeMonths).slice(-MONTHS_SHOWN).reverse();

  /*  The best settled DAY, not bet: a tracker's user thinks in sessions, and
      one +£700 day is a different story from one +£700 bet. Computed off the
      scope's own days so it moves with the period the card describes.

      NO ZERO STANDING IN FOR A DAY. This used to seed the fold with
      { netPence: 0 }, so an account whose every settled day lost money
      reported a best day of +£0.00 in the profit colour, next to a caption
      saying there was no settled day at all. There either is a best day, and
      it is the best of the real ones however it went, or there is none. */
  const best = days.length ? days.reduce((a, d) => (d.netPence > a.netPence ? d : a)) : null;
  /*  What share of the period's profit came out of that one day. It is the
      caution the curve raises and cannot answer: a line that ends up is the
      same line whether it climbed or jumped. Drawn only where it is a share
      of something: with the net at or below zero, or a day bigger than the
      whole net, there is no proportion to state and the date is the more
      useful thing to say. */
  const bestShare = best && s.netPence > 0 && best.netPence > 0 && best.netPence <= s.netPence
    ? (best.netPence / s.netPence) * 100
    : null;
  /*  The sign of the figure picks the colour, which is the only thing the
      two result colours are ever allowed to be picked by. */
  const roiTone = s.roi >= 0 ? 'pos' : 'neg';

  return (
    <>
      {/*  One h1 per page, and it is not worth 49 pixels of the fold: the
           rail, the tab bar and the greeting all say where you are, and the
           first thing under it is a row of figures. */}
      <h1 className="sr-only">Dashboard</h1>

      {/*  Not in the example account. A trial banner there is an offer nobody
           can act on, stacked under a banner that already says this is not
           your account, and the two of them together took 78 pixels of a 900
           pixel screen before the dashboard began. */}
      {trial.active && !demo ? (
        <div className="banner" style={{ marginBottom: 'var(--gap-block)' }}>
          <Icon name="clock" size={18} className="banner__icon" />
          <span className="grow">Trial: {trial.message}</span>
          <Link href="/app/settings/plan" className="btn btn--ghost btn--sm">See plans</Link>
        </div>
      ) : null}

      {/*  GETTING STARTED, above the figures, while there are four things to
           do and no figures yet. It draws nothing at all once they are done,
           so it is never in the way of a working account, and it is never
           sent anywhere. See lib/domain/onboarding.ts.

           ABOVE THE GRID AND NOT IN IT. The grid has three rows and they are
           assigned in order, so a full width card as its first child took
           the tiles' row, pushed the curve into the calendar's and left the
           calendar in an implicit fourth. Here it is a block like the trial
           banner, and the grid keeps its three rows and takes what is left
           of the window. */}
      <div className="dash__onb">
        <Onboarding signals={onboarding} trial={trial} demo={demo} />
      </div>

      {/*  THREE ROWS AND NO SCROLLBAR. See .dash in layout.css: the grid is
           the window less the header and its own padding, so the breakdown
           ends where the screen does. It ran 2,665 pixels at 1440 by 900,
           which is a report rather than a dashboard.

           There is no break line any more. It ruled the first screen off
           from the analysis below it, and on a page that is one screen there
           is nothing on the other side of it to divide. */}
      <div className="grid dash">
        {/* ------------------------------------------------- the four tiles */}
        <Tile
          accent
          label={`Net, ${scopeLabel(scope).toLowerCase()}`}
          value={money(s.netPence, cur, { sign: true })}
          sub={`${fmtUnits(s.units, { sign: true })} over ${plural(s.count, 'bet')}`}
          spark={shownCurve.map((p) => p.netPence)}
          sparkTone="ink"
        />
        <Tile
          label="Turnover"
          value={money(s.turnoverPence, cur)}
          sub={`${money(s.avgStakePence, cur)} average stake`}
          spark={runningTotal(days.map((d) => d.turnoverPence))}
          sparkTone="ink"
        />
        <Tile
          label="Return"
          value={pct(s.roi, { sign: true })}
          tone={s.roi > 0 ? 'pos' : s.roi < 0 ? 'neg' : ''}
          sub={`${plural(s.settled, 'settled bet')}`}
          spark={runningRoi(days)}
          sparkTone={s.roi >= 0 ? 'pos' : 'neg'}
        />
        {closing.recorded > 0 && closing.meanPct !== null ? (
          <Tile
            label="Against the close"
            value={pct(closing.meanPct, { sign: true })}
            tone={closing.meanPct > 0 ? 'pos' : closing.meanPct < 0 ? 'neg' : ''}
            sub={`${closing.recorded} of ${closing.of} carry a price you recorded`}
            spark={closingLine}
            sparkTone={closing.meanPct >= 0 ? 'pos' : 'neg'}
          />
        ) : (
          <Tile
            label="Bets"
            value={count(s.count)}
            sub={s.open > 0 ? `${count(s.open)} still running` : `${count(s.settled)} settled`}
            spark={runningTotal(days.map((d) => d.count))}
            sparkTone="ink"
          />
        )}

        {/* ------------------------------------------------- the wide chart */}
        <Module
          title="Profit curve"
          span={6}
          size="auto"
          id="mod-curve"
          note={curveIsWide ? 'All time: this scope has one day' : undefined}
          tools={
            <>
              {/*  THE PERIOD SELECTOR IS ON THE CARD ABOUT TIME, and it
                   governs every module on the page, which is what the group's
                   own name says out loud. It was a bar of its own inside the
                   hero card above the grid; the hero is gone and a strip
                   across the top of a one screen dashboard is a row of
                   controls where a row of figures should be.

                   The two filters are in the corner menu beside it rather
                   than in the head, because a bookmaker and a sport are
                   asked for once in a session and the period is changed four
                   times a minute. */}
              <PeriodSeg scope={scope} />
              <ModuleMenu label="Scope">
                <div className="modmenu__row">
                  <p className="label">Filter every module</p>
                  <ScopeFilters scope={scope} id="dash" />
                </div>
              </ModuleMenu>
            </>
          }
        >
          {/*  THE SUB METRICS: a value and the signed percentage that belongs
               to it. Net carries the return, because a profit without the
               turnover it came off is half a fact. The best day carries its
               share of the net, which is the one thing the line above cannot
               say: a curve that ends up looks the same whether it climbed or
               jumped. */}
          <div className="submets">
            <div className="submet">
              <p className="label">Net</p>
              <p className="submet__row">
                <span className={`fig fig--s tnum ${s.netPence > 0 ? 'pos' : s.netPence < 0 ? 'neg' : ''}`}>
                  {money(s.netPence, cur, { sign: true })}
                </span>
                <span className={`pill pill--asis tnum pill--${roiTone}`}>
                  {pct(s.roi, { sign: true })}
                </span>
              </p>
            </div>
            <div className="submet">
              <p className="label">Best day</p>
              <p className="submet__row">
                {best ? (
                  <span className={`fig fig--s tnum ${best.netPence >= 0 ? 'pos' : 'neg'}`}>
                    {money(best.netPence, cur, { sign: true })}
                  </span>
                ) : (
                  <span className="small dim">No settled day yet</span>
                )}
                {bestShare !== null ? (
                  /*  A PLAIN PILL, NOT A GREEN ONE. The share is not a
                      result: a third of the profit arriving on one afternoon
                      is a caution about variance, and painting it in the
                      profit colour would read as a compliment. Green and red
                      mean money won and money lost, and this is neither. */
                  <span className="pill pill--asis tnum">{pct(bestShare)} of the net</span>
                ) : best ? (
                  <span className="small dim">{longDate(best.day + 'T12:00:00Z', 'UTC')}</span>
                ) : null}
              </p>
            </div>
          </div>

          {/*  60 is the FLOOR, not the height: the curve fills the box the
               card has left, and the floor only matters on the pages that
               draw this outside a sized module. It was 96, which is more
               than the box at 1440 by 900, and a chart that insists on being
               taller than its card is a chart the card clips. */}
          <ProfitCurve points={shownCurve} currency={cur} height={60} />
        </Module>

        {/* ------------------------------------------------------ win rate */}
        <Module title="Win rate" span={3} size="auto" id="mod-rate">
          <Radial
            value={s.winRate}
            figure={pct(s.winRate)}
            label="Win rate"
            caption={
              /*  The denominator, every time. A rate with no denominator is
                  the oldest way to make a record look like something it is
                  not, and a void is in neither half of this one. */
              `${s.wins} won, ${s.losses} lost${s.voids + s.placed === 0
                ? '.'
                : s.placed > 0
                  ? `, ${count(s.voids + s.placed)} void or placed. Neither is a win or a loss.`
                  : `, ${count(s.voids)} void. A void is neither.`}`
            }
          />
        </Module>

        {/* -------------------------------------------------- month by month */}
        <Module
          title="By month"
          span={3}
          size="auto"
          id="mod-months"
          note={monthsAreWide ? 'All time: this scope has one month' : undefined}
        >
          {months.length === 0 ? (
            <p className="small dim">Nothing settled in this scope yet.</p>
          ) : (
            <ul className="mlist">
              {months.map((m) => (
                <li key={m.key} className="mlist__row">
                  <span className="mlist__k">
                    {m.label} {m.key.slice(0, 4)} <span className="mlist__n tnum">{plural(m.count, 'bet')}</span>
                  </span>
                  <span className={`fig fig--s tnum ${m.netPence >= 0 ? 'pos' : 'neg'}`}>
                    {money(m.netPence, cur, { sign: true })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Module>

        {/* ------------------------------------------------------- calendar */}
        <Module title="Calendar" span={5} size="auto" id="mod-calendar">
          <MonthCalendar
            fit
            days={calendarDays}
            now={now}
            weekStart={account.weekStart}
            show={account.calendarDates ? 'both' : 'amount'}
            currency={cur}
            tz={tz}
          />
        </Module>

        {/* ------------------------------------------------------ breakdown */}
        {/*  Seven columns, not twelve. The rows carry a name, a count, a
             sparkline, a figure, a bar and a return caption, which is what
             the width is for; beyond about 950 the bar simply got longer,
             which is more pixels for a number the figure beside it already
             states. The calendar takes the rest of the row. */}
        <Module title="Breakdown" span={7} size="auto" id="mod-breakdown">
          <Breakdown rowsByDim={breakdowns} currency={cur} />
        </Module>
      </div>
    </>
  );
}
