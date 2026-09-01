import type { Metadata } from 'next';
import Link from 'next/link';
import { getViewer } from '@/lib/data/session';
import {
  select, summarise, byDay, cumulative, runningNow, settledToday,
  offerSplit, scopeFromParams, scopeLabel, buildBreakdowns,
} from '@/lib/data/analytics';
import { Breakdown } from '@/components/app/Breakdown';
import { NetHero } from '@/components/app/NetHero';
import { Module, ModuleLink, Figure } from '@/components/app/Module';
import { MonthCalendar } from '@/components/app/Calendar';
import { ProfitCurve } from '@/components/app/Charts';
import { BetRow, EmptyState } from '@/components/app/BetRow';
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
  const running = runningNow(bets);
  const today = settledToday(bets, now);
  const offers = offerSplit(bets);
  /*  Six dimensions in one module. Odds and stake used to be two more cards
      beside it, drawing the same row with the same bar. */
  const breakdowns = buildBreakdowns(rows, account.unitPence);
  /* Every settled day the account has: the calendar browses months itself,
     so scoping this to the current one would empty every earlier month. */
  const calendarDays = byDay(select(bets, { ...scope, period: 'all' }, now, account.weekStart));

  return (
    <>
      <div className="spread" style={{ marginBottom: 'var(--s4)', flexWrap: 'wrap' }}>
        <h1>Dashboard</h1>
      </div>

      {trial.active ? (
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

        {/* --------------------------------------------------- calendar */}
        <Module
          title="Calendar"
          span={6}
          size="xxl"
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


        {/* ------------------------------------------------ running now */}
        <Module
          title="Running now"
          span={6}
          size="xxl"
          note="Ignores the scope"
          id="mod-running"
          footer={<ModuleLink href="/app/ledger">Open the ledger</ModuleLink>}
        >
          {running.length === 0 && today.length === 0 ? (
            <EmptyState
              title="Nothing running. Forward a slip and it lands here."
              action="Add a bet"
              href="/app/import"
              ghost={<ul><li className="brow"><span className="brow__title">Arsenal to win</span><span className="fig fig--s">£38.25</span></li></ul>}
            />
          ) : (
            <div
              className="grow"
              style={{ overflowY: 'auto', minHeight: 0 }}
              tabIndex={0}
              role="region"
              aria-label="Running now and settled today, scrollable"
            >
              {running.length > 0 ? (
                <>
                  <p className="label" style={{ marginBottom: 4 }}>
                    {running.length} open · {money(s.openStakePence, account.currency)} exposure
                  </p>
                  <ul>
                    {running.slice(0, 5).map((b) => <BetRow key={b.id} bet={b} currency={account.currency} />)}
                  </ul>
                </>
              ) : null}
              {today.length > 0 ? (
                <>
                  <p className="label" style={{ marginTop: 'var(--s4)', marginBottom: 4 }}>Settled today</p>
                  <ul>
                    {today.slice(0, 3).map((b) => <BetRow key={b.id} bet={b} currency={account.currency} settling />)}
                  </ul>
                </>
              ) : null}
            </div>
          )}
        </Module>

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

        {/* -------------------------------------------------- all time */}
        <Module title="The record" span={12} size="s" id="mod-record">
          <div className="row row--wrap" style={{ gap: 'var(--s7)' }}>
            <Figure value={pct(s.winRate)} label="Win rate" size="sm" sub={`${s.wins} won, ${s.losses} lost`} />
            <Figure value={s.avgOdds.toFixed(2)} label="Average price" size="sm" />
            <Figure value={money(s.avgStakePence, account.currency)} label="Average stake" size="sm" />
            <Figure value={String(s.longestWin)} label="Longest winning run" size="sm" />
            <Figure value={String(s.longestLoss)} label="Longest losing run" size="sm" />
            <Figure value={count(s.voids)} label="Void" size="sm" sub="Excluded from turnover" />
          </div>
        </Module>
      </div>
    </>
  );
}

