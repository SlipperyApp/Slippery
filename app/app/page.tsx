import type { Metadata } from 'next';
import Link from 'next/link';
import { getViewer } from '@/lib/data/session';
import {
  select, summarise, byDay, cumulative, periodSeries,
  scopeFromParams, scopeLabel, buildBreakdowns,
} from '@/lib/data/analytics';
import { Breakdown } from '@/components/app/Breakdown';
import { Onboarding } from '@/components/app/Onboarding';
import { Module } from '@/components/app/Module';
import { Tile } from '@/components/app/Tile';
import { Radial } from '@/components/app/Radial';
import { MonthCalendar } from '@/components/app/Calendar';
import { ProfitCurve, PeriodBars } from '@/components/app/Charts';
import { ScopePicker } from '@/components/app/ScopeBar';
import { Icon } from '@/components/Icon';
import { money, pct, plural, count, units as fmtUnits } from '@/lib/format';
import { EmptyDashboard } from '@/components/app/EmptyDashboard';
import { emptyReason } from '@/lib/data/viewer';

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

  /*  Six dimensions in one module. Odds and stake used to be two more cards
      beside it, drawing the same row with the same bar. */
  const breakdowns = buildBreakdowns(rows, account.unitPence);
  /* Every settled day the account has: the calendar browses months itself,
     so scoping this to the current one would empty every earlier month. */
  const calendarDays = allDays;

  /*  SIX OF WHATEVER IS SELECTED, which replaced both the By month list and
      the trend bars that used to run under the four tiles. See periodSeries
      in lib/data/analytics.ts for the one rule it follows. */
  const bars = periodSeries(bets, scope, now, account.weekStart, tz);

  return (
    <>
      {/*  One h1 per page, and it is not worth 49 pixels of the fold: the
           rail, the tab bar and the selector under it all say where you are,
           and the first thing on the page is a row of figures. */}
      <h1 className="sr-only">Dashboard</h1>

      {/*  Not in the example account. A trial banner there is an offer nobody
           can act on, and it took 78 pixels of a 900 pixel screen before the
           dashboard began. */}
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
           sent anywhere. See lib/domain/onboarding.ts. */}
      <div className="dash__onb">
        <Onboarding signals={onboarding} trial={trial} demo={demo} />
      </div>

      {/*  THE PERIOD, ONCE, CENTRED, ABOVE EVERYTHING IT GOVERNS.
           It used to be a strip inside the curve card's own header, on the
           argument that it belongs on the module about time. It does not: it
           governs the tiles, the bars, the calendar, the breakdown and the
           curve, and a control that changes six modules cannot live inside
           one of them. Narrow and centred, because it is the only control on
           the page and a full width bar of chips reads as a toolbar. */}
      <ScopePicker scope={scope} />

      {/*  THREE ROWS AND NO SCROLLBAR. See .dash in layout.css: the grid is
           the window less the header and its own padding, so the breakdown
           ends where the screen does. */}
      <div className="grid dash">
        {/* ------------------------------------- net, return, six periods */}
        <Tile
          accent
          label={`Net, ${scopeLabel(scope).toLowerCase()}`}
          value={money(s.netPence, cur, { sign: true })}
          sub={`${fmtUnits(s.units, { sign: true })} over ${plural(s.count, 'bet')}`}
        />
        <Tile
          label="Return"
          value={pct(s.roi, { sign: true })}
          tone={s.roi > 0 ? 'pos' : s.roi < 0 ? 'neg' : ''}
          sub={`${plural(s.settled, 'settled bet')}`}
        />

        <Module title={BAR_TITLE[scope.period]} span={6} size="auto" id="mod-periods">
          <PeriodBars bars={bars} currency={cur} />
        </Module>

        {/* ------------------------------------------ calendar, breakdown */}
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

        {/*  Seven columns, not twelve. The rows carry a name, a count, a
             sparkline, a figure, a bar and a return caption, which is what
             the width is for; beyond about 950 the bar simply got longer,
             which is more pixels for a number the figure beside it already
             states. The calendar takes the rest of the row. */}
        <Breakdown
          rowsByDim={breakdowns}
          currency={cur}
          card={{ title: 'Breakdown', span: 7, id: 'mod-breakdown' }}
        />

        {/* ---------------------------------------- cumulative, win rate */}
        {/*  "Cumulative net", not "Profit curve". What it draws is the net
             added up day by day, which is what the axis says and what the
             figure at its right hand end is; "profit curve" names a shape
             rather than a quantity, and the shape is on screen. */}
        <Module
          title="Cumulative net"
          span={8}
          size="auto"
          id="mod-curve"
          note={curveIsWide ? 'All time: this scope has one day' : undefined}
        >
          <ProfitCurve points={shownCurve} currency={cur} height={60} />
        </Module>

        <Module title="Win rate" span={4} size="auto" id="mod-rate">
          <Radial
            value={s.winRate}
            figure={pct(s.winRate)}
            label="Win rate"
            caption={
              /*  The denominator, every time. A rate with no denominator is
                  the oldest way to make a record look like something it is
                  not, and a void is in neither half of this one. */
              `${s.wins} won, ${s.losses} lost${s.voids + s.placed === 0
                ? ''
                : `, ${count(s.voids + s.placed)} neither`}`
            }
          />
        </Module>
      </div>
    </>
  );
}

/** What the six bars are six of, said once, on the card. The chart follows
 *  the selector and the title has to follow it too, or a reader counting
 *  months is looking at weeks. */
const BAR_TITLE: Record<string, string> = {
  today: 'Last six days',
  week: 'Last six weeks',
  month: 'Last six months',
  year: 'Last six years',
  all: 'All time, in six',
};
