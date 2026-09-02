import type { Metadata } from 'next';
import Link from 'next/link';
import { getViewer } from '@/lib/data/session';
import {
  select, summarise, byDay, cumulative,
  offerSplit, scopeFromParams, scopeLabel, buildBreakdowns,
} from '@/lib/data/analytics';
import { Breakdown } from '@/components/app/Breakdown';
import { NetHero } from '@/components/app/NetHero';
import { Onboarding } from '@/components/app/Onboarding';
import { Module, Figure } from '@/components/app/Module';
import { MonthCalendar } from '@/components/app/Calendar';
import { ProfitCurve } from '@/components/app/Charts';
import { Icon } from '@/components/Icon';
import { money, pct, count, plural, longDate } from '@/lib/format';
import { ledgerSummary, isImported, heldOutSentence } from '@/lib/data/ledger-shape';
import { summariseClosing } from '@/lib/domain/closing';
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

  const tz = account.timeZone;
  const rows = select(bets, scope, now, account.weekStart, tz);
  const s = summarise(rows);
  const curve = cumulative(byDay(rows, tz));
  /*  A curve needs two settled days, and on the first of a month a correct
      scope has one. Rather than a module sized for a picture showing a
      sentence, the curve falls back to the whole record and SAYS SO. An
      unlabelled fallback would be worse than the empty box; a labelled one
      is the answer to the question the empty box raises. */
  const allDays = byDay(select(bets, { ...scope, period: 'all' }, now, account.weekStart, tz), tz);
  const wideCurve = cumulative(allDays);
  const curveIsWide = curve.length < 2 && wideCurve.length > 1;
  const shownCurve = curveIsWide ? wideCurve : curve;
  const offers = offerSplit(bets);
  /*  THE CLOSING PRICE, over only the bets that carry one.
   *
   *  Not every account will ever have one of these, which is the whole
   *  reason the module below is conditional: the version of this that
   *  shipped and was deleted printed "Not measured" on every account every
   *  day because no price feed existed, and a module that exists to say it
   *  has nothing to say is worse than no module. Now the number comes from
   *  the account holder, so an account that has recorded none simply does
   *  not draw it. */
  const closing = summariseClosing(rows);
  /*  Six dimensions in one module. Odds and stake used to be two more cards
      beside it, drawing the same row with the same bar. */
  const breakdowns = buildBreakdowns(rows, account.unitPence);
  /* Every settled day the account has: the calendar browses months itself,
     so scoping this to the current one would empty every earlier month. */
  const calendarDays = byDay(select(bets, { ...scope, period: 'all' }, now, account.weekStart, tz), tz);
  /*  The best and worst settled DAY, not bet: a tracker's user thinks in
      sessions, and one +£700 day is a different story from one +£700 bet.
      Computed off the scope's own days so the pair moves with the period
      the rest of the module is describing. */
  /*  Through the backend's own shape, not computed here. The ingestion
      handoff is explicit that every figure comes from one selection and
      none of them is computed client side, so the screens read the
      contract's names and lib/data/ledger-shape.ts supplies them until
      that branch merges. */
  const L = ledgerSummary(rows, tz);
  const dayNets = byDay(rows.filter((b) => !isImported(b) && !b.arbGroupId), tz);
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
        <div className="banner" style={{ marginBottom: 'var(--gap-block)' }}>
          <Icon name="clock" size={18} className="banner__icon" />
          <span className="grow">Trial: {trial.message}</span>
          <Link href="/app/settings/plan" className="btn btn--ghost btn--sm">See plans</Link>
        </div>
      ) : null}

      <div className="grid">
        {/*  GETTING STARTED, above the figures, while there are four things
             to do and no figures yet. It draws nothing at all once they are
             done, so it is never in the way of a working account, and it is
             never sent anywhere. See lib/domain/onboarding.ts. */}
        <Onboarding signals={onboarding} trial={trial} demo={demo} />

        {/* ------------------------------------------------ net, the hero */}
        <NetHero
          summary={s}
          scope={scope}
          scopeLabel={scopeLabel(scope)}
          currency={account.currency}
          handle={account.handle}
        />

        {/*  THE FIRST SCREEN IS THE HERO, THE CALENDAR AND THE RECORD, and
             the comment here used to say "and what is running", which is
             where that module was before it moved to the ledger. On a 1440 by
             900 desktop the three of them fit above the fold with the scope
             bar, which is the whole point: a dashboard you have to scroll to
             read is a report.

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
            tz={tz}
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
             as the calendar beside it: figures that describe the whole
             account and change slowly. It was at the very bottom of the page
             before, under three analysis modules, which is a strange place
             for the numbers somebody would most like at a glance. */}
        <Module
          title="The record"
          span={5}
          size="xl"
          id="mod-record"
          note="All time"
          footer={
            /*  THE CONDITIONS, in the module's own footer rather than after
                its grid. Appended inside the body they were laid out by the
                grid's own flow and, at 1024 where the module is a fixed
                444px and the grid had grown to eight figures, the sweep
                caught four of them painted straight over this sentence.
                card__foot is margin-top:auto, so it is pinned to the bottom
                and the grid gets what is left. */
            <p className="small dim">
              {heldOutSentence(L.heldOut)}
              {L.importedBets > 0
                ? ` Best day, worst day and the run count the ${plural(L.bets - L.importedBets, 'bet')} placed through Slippery, not imported history.`
                : ''}
            </p>
          }
        >
          {/*  A HIERARCHY, NOT A WALL.
               This was eight peer figures, each a label, a 24px number and a
               caption: twenty two lines of near identical treatment in one
               card, and the densest thing on the dashboard. Eight things at
               one size is eight things with no order, so the reader has to
               read all of them to find out which one they wanted.

               Three levels now. The win rate leads at the full figure size
               because it is the one number somebody means by "my record".
               Three averages sit under it at the middle size. The two days
               are rows rather than figures: they are the shape of the tail,
               which is worth having and is not what anybody opens the
               dashboard for.

               Turnover went. It is on the ledger's own summary strip and in
               the analyser's Staked column, and a third printing of it here
               was the least looked at figure in the densest module. Void and
               placed went into the win rate's own caption, where it belongs:
               it is the rest of the denominator, not a fact of its own. */}
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
              {/*  No caption. It said "across 385 bets", and the hero
                   directly above this module already prints Bets 385: a
                   figure that has to be checked against itself on the same
                   screen. */}
              <Figure value={s.avgOdds.toFixed(2)} label="Average price" size="md" />
              <Figure value={money(s.avgStakePence, account.currency)} label="Average stake" size="md" sub={`${money(account.unitPence, account.currency)} a unit`} />
              <Figure value={String(s.longestWin)} label="Longest win run" size="md" sub={`${s.longestLoss} is the longest losing one`} />
            </div>

            {/*  Pinned to the bottom of the module rather than floating in
                 the middle of what is left over. A fixed height row exists
                 so that the modules beside each other line up, and the cost
                 of it is paid here: the space goes between the tiers, where
                 it separates them, instead of under everything. */}
            <ul className="record__rows">
              <li className="brow">
                <span style={{ minWidth: 0 }}>
                  <span className="brow__title">Best day</span>
                  <span className="brow__sub">{best.day ? longDate(best.day + 'T12:00:00Z', 'UTC') : 'No settled day yet'}</span>
                </span>
                <span className="fig fig--s tnum pos">{money(best.netPence, account.currency, { sign: true })}</span>
              </li>
              <li className="brow">
                <span style={{ minWidth: 0 }}>
                  <span className="brow__title">Worst day</span>
                  <span className="brow__sub">{worst.day ? longDate(worst.day + 'T12:00:00Z', 'UTC') : 'No settled day yet'}</span>
                </span>
                <span className={`fig fig--s tnum ${worst.netPence < 0 ? 'neg' : ''}`}>
                  {money(worst.netPence, account.currency, { sign: true })}
                </span>
              </li>
            </ul>
          </div>
        </Module>

        {/*  Below the fold on purpose, and labelled so it reads as a
             deliberate second half rather than as more dashboard. */}
        <div className="col-12 dash__break spread" style={{ flexWrap: 'wrap' }}>
          <h2 className="label">Analysis</h2>
          {/*  The way into the analyser, at the top of the half of the page
               that is analysis. Not a sixth row in the sidebar: five
               destinations is a design decision with a comment on it, and a
               cross tab is a tool you reach for from the modules it goes
               deeper than rather than a place you live. */}
          <Link href="/app/analyser" className="btn btn--quiet btn--sm">
            <Icon name="sliders" size={16} /> Open the analyser
          </Link>
        </div>

        {/* ------------------------------------------------ profit curve */}
        {/*  FULL WIDTH, AND SO IS EVERYTHING UNDER IT.
             A grid row takes its tallest card and stretches the rest, and
             the cost of that was on screen: "Offers versus own" was 367 by
             408 with two figures and a bar in it, so roughly 140px of the
             module was nothing at all, sitting beside a curve that filled
             its own. Nothing below the fold is a pair any more. The curve
             wants the width, the offer split reads as a strip across it,
             and neither is stretched to match the other. */}
        <Module
          title="Profit curve"
          span={12}
          size="l"
          id="mod-curve"
          note={curveIsWide ? 'All time: this scope has one day' : undefined}
          footer={
            <p className="small dim">
              {shownCurve.length > 1
                ? `${shownCurve.length} settled days, best ${money(Math.max(...(curveIsWide ? allDays : byDay(rows, tz)).map((d) => d.netPence), 0), account.currency, { sign: true })} on a day.`
                : 'A curve needs two settled days.'}
            </p>
          }
        >
          <ProfitCurve points={shownCurve} currency={account.currency} />
        </Module>

        {/* --------------------------------------------- offers vs own */}
        <Module
          title="Offers versus own"
          span={12}
          size="auto"
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
          <div className="offsplit">
            <Figure
              value={money(offers.ownNetPence, account.currency, { sign: true })}
              label="From your own stake"
              tone={offers.ownNetPence >= 0 ? 'pos' : 'neg'}
              size="md"
              sub={`${plural(offers.ownCount, 'bet')}`}
            />
            <Figure
              value={money(offers.offerNetPence, account.currency, { sign: true })}
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
                  ? `${pct(offers.offerSharePct)} of your net came from offers. That is not a criticism, it is the number most trackers leave out.`
                  : `${pct(100 - offers.offerSharePct)} of your net came from your own stake.`}
              </p>
            </div>
          </div>
        </Module>

        {/* ----------------------------------------------- closing price */}
        {/*  Drawn only when something has been recorded. See the note above
             `closing`: an empty version of this module is the exact thing
             that got its predecessor deleted. */}
        {closing.recorded > 0 && closing.meanPct !== null ? (
          <Module
            title="Closing price"
            span={12}
            size="auto"
            id="mod-closing"
            note="Prices you recorded"
            footer={
              /*  ONE LINE, NOT TWO PARAGRAPHS.
                  This module had four figures, four captions and then two
                  paragraphs, the second of which restated the first caption
                  at length: "79 of 259 bets carry a closing price you
                  recorded. The other 180 bets here are not counted as
                  level: nobody recorded a price for them, so there is
                  nothing to compare." The first figure already says 79 of
                  259 and its own caption already says the rest are not
                  counted as level. On a phone the module was nearly two
                  full screens, and SPEC.md is explicit that a module shows
                  a figure and a label: definition survives, interpretation
                  dies. What survives is the one sentence that is not
                  written anywhere else, which is what a plus means. */
              <p className="small dim">
                A plus means the price you took was the longer of the two. On a lay it is worked
                out the other way round, because a layer wants the shorter price. Nothing in
                Slippery works a closing price out: every one of these came from you.
              </p>
            }
          >
            <div className="clvmod">
              {/*  THE COVERAGE IS A FIGURE, not a caption under one. It is
                   the number that decides whether any of the other three
                   means anything, so it is the same size as they are. */}
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
                label="Widest gap in your favour"
                size="md"
                sub={closing.worstPct === null ? '' : `${pct(closing.worstPct, { sign: true })} is the widest against`}
              />
            </div>
          </Module>
        ) : null}

        {/* --------------------------------------------------- breakdown */}
        {/*  FULL WIDTH. A breakdown row carries six things across it: the
             name, the count, a sparkline, the figure, a bar and a return
             caption. At eight columns the name column was the one that gave
             way, so "Both teams to score" and "Goals over/under" both
             truncated at the exact width where the module became the widest
             thing on the page. The other two analysis modules make a full
             row between them, so this takes the next one whole rather than
             sitting beside four columns of nothing. */}
        <Module
          title="Breakdown"
          span={12}
          size="auto"
          id="mod-breakdown"
        >
          <Breakdown rowsByDim={breakdowns} currency={account.currency} />
        </Module>

      </div>
    </>
  );
}

