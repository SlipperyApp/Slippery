import type { Metadata } from 'next';
import Link from 'next/link';
import { getViewer } from '@/lib/data/session';
import {
  select, summarise, byDay, cumulative, byMonth, runningNow, settledToday,
  offerSplit, orderedBreakdown, scopeFromParams, scopeLabel, buildBreakdowns,
} from '@/lib/data/analytics';
import { Breakdown } from '@/components/app/Breakdown';
import { ScopeBar } from '@/components/app/ScopeBar';
import { Module, ModuleLink, Figure } from '@/components/app/Module';
import { MonthCalendar } from '@/components/app/Calendar';
import { ProfitCurve, MonthBars, Sparkline } from '@/components/app/Charts';
import { BetRow, EmptyState } from '@/components/app/BetRow';
import { Icon } from '@/components/Icon';
import { money, pct, units as fmtUnits, count, MONTH_LONG, londonParts, TZ_LABEL } from '@/lib/format';

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
  const { data, now, trial } = await getViewer();
  const scope = scopeFromParams(sp);
  const { account, bets } = data;

  const rows = select(bets, scope, now, account.weekStart);
  const s = summarise(rows);
  const curve = cumulative(byDay(rows));
  const months = byMonth(bets);
  const running = runningNow(bets);
  const today = settledToday(bets, now);
  const offers = offerSplit(bets);
  const oddsBands = orderedBreakdown(rows, 'odds', account.unitPence);
  const stakeBands = orderedBreakdown(rows, 'stake', account.unitPence);
  const breakdowns = buildBreakdowns(rows);
  const monthDays = byDay(select(bets, { ...scope, period: 'month' }, now, account.weekStart));
  const p = londonParts(now);

  return (
    <>
      <div className="spread" style={{ marginBottom: 'var(--s4)', flexWrap: 'wrap' }}>
        <h1>Dashboard</h1>
        <p className="small dim">{TZ_LABEL}</p>
      </div>

      {trial.active ? (
        <div className="banner" style={{ marginBottom: 'var(--s4)' }}>
          <Icon name="clock" size={18} className="banner__icon" />
          <span className="grow">Trial: {trial.message}</span>
          <Link href="/app/settings/plan" className="btn btn--ghost btn--sm">See plans</Link>
        </div>
      ) : null}

      <ScopeBar scope={scope} />

      <div className="grid">
        {/* -------------------------------------------------------- net */}
        <Module
          title="Net"
          span={4}
          size="l"
          id="mod-net"
          footer={
            <p className="small dim">
              {s.voidedStakePence > 0
                ? `Turnover and ROI exclude ${money(s.voidedStakePence, account.currency)} of voided stakes.`
                : `${scopeLabel(scope)}.`}
            </p>
          }
        >
          <Figure
            value={money(s.netPence, account.currency, { sign: true })}
            label={scopeLabel(scope)}
            tone={s.netPence > 0 ? 'pos' : s.netPence < 0 ? 'neg' : ''}
            sub={`${fmtUnits(s.units, { sign: true })} on a ${money(account.unitPence, account.currency)} unit`}
          />
          <div className="row row--wrap" style={{ marginTop: 'var(--s4)', gap: 'var(--s5)' }}>
            <Figure value={pct(s.roi, { sign: true })} label="Return" size="sm" tone={s.roi > 0 ? 'pos' : s.roi < 0 ? 'neg' : ''} />
            <Figure value={money(s.turnoverPence, account.currency)} label="Turnover" size="sm" />
            <Figure value={count(s.count)} label="Bets" size="sm" />
          </div>
          {curve.length > 2 ? (
            <div style={{ marginTop: 'auto', paddingTop: 'var(--s5)' }}>
              <p className="label" style={{ marginBottom: 6 }}>The last {Math.min(14, curve.length)} settled days</p>
              <Sparkline values={curve.slice(-14).map((c) => c.netPence)} height={44} />
            </div>
          ) : null}
        </Module>

        {/* ------------------------------------------------ running now */}
        <Module
          title="Running now"
          span={4}
          size="l"
          note="Live, so it ignores the scope"
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
            <div className="grow" tabIndex={0} aria-label="Running now and settled today, scrollable"
              style={{ overflowY: 'auto', minHeight: 0 }}>
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

        {/* --------------------------------------------------- calendar */}
        <Module
          title={`${MONTH_LONG[p.month - 1]} ${p.year}`}
          span={4}
          size="l"
          note="Always the month shown"
          id="mod-calendar"
          footer={<p className="small dim">Days are Europe/London, so a 23:00 bet lands on the right one.</p>}
        >
          <MonthCalendar
            days={monthDays}
            now={now}
            weekStart={account.weekStart}
            show={account.calendarDates ? 'both' : 'amount'}
            currency={account.currency}
          />
        </Module>

        {/* ------------------------------------------------ profit curve */}
        <Module
          title="Profit curve"
          span={8}
          size="m"
          id="mod-curve"
          footer={
            <p className="small dim">
              {curve.length > 1
                ? `${curve.length} settled days, best ${money(Math.max(...byDay(rows).map((d) => d.netPence), 0), account.currency, { sign: true })} on a day.`
                : 'A curve needs two settled days.'}
            </p>
          }
        >
          <ProfitCurve points={curve} currency={account.currency} />
        </Module>

        {/* --------------------------------------------- offers vs own */}
        <Module
          title="Offers versus own"
          span={4}
          size="m"
          note="Always all time"
          id="mod-offers"
          footer={<p className="small dim">Free bets, bonus funds and boosts are flagged when the slip is read.</p>}
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
        <Module title="Breakdown" span={8} size="l" id="mod-breakdown">
          <Breakdown rowsByDim={breakdowns} currency={account.currency} />
        </Module>

        {/* -------------------------------------------------- odds band */}
        <Module
          title="Odds band"
          span={4}
          size="l"
          id="mod-odds"
          footer={<p className="small dim">Ordered by price, never by profit: the order is the read.</p>}
        >
          <BandList rows={oddsBands} currency={account.currency} />
        </Module>

        {/* ---------------------------------------------- month by month */}
        <Module
          title="Month by month"
          span={8}
          size="m"
          id="mod-months"
          footer={<p className="small dim">Bars under five bets are faded. Volume outranks luck.</p>}
        >
          <MonthBars months={months} currency={account.currency} />
        </Module>

        {/* ------------------------------------------------ stake range */}
        <Module
          title="Stake range"
          span={4}
          size="m"
          id="mod-stakes"
          footer={<p className="small dim">Buckets are in units, not pounds, so changing your unit cannot break them.</p>}
        >
          <BandList rows={stakeBands} currency={account.currency} />
        </Module>

        {/* -------------------------------------------------- all time */}
        <Module title="The record" span={12} size="s" id="mod-record">
          <div className="row row--wrap" style={{ gap: 'var(--s7)' }}>
            <Figure value={pct(s.winRate)} label="Win rate" size="sm" sub={`${s.wins} won, ${s.losses} lost`} />
            <Figure value={s.avgOdds.toFixed(2)} label="Average price" size="sm" sub="Settled bets only" />
            <Figure value={money(s.avgStakePence, account.currency)} label="Average stake" size="sm" />
            <Figure value={String(s.longestWin)} label="Longest run of winners" size="sm" />
            <Figure value={String(s.longestLoss)} label="Longest run of losers" size="sm" />
            <Figure value={count(s.voids)} label="Void" size="sm" sub="Excluded from turnover" />
          </div>
        </Module>
      </div>
    </>
  );
}

function BandList({ rows, currency }: { rows: { key: string; label: string; count: number; netPence: number; thin: boolean }[]; currency: 'GBP' | 'EUR' }) {
  const peak = Math.max(1, ...rows.map((r) => Math.abs(r.netPence)));
  return (
    <ul className="grow" tabIndex={0} aria-label="Bands, scrollable" style={{ overflowY: 'auto', minHeight: 0 }}>
      {rows.map((r) => (
        <li key={r.key} className={`brow${r.thin ? ' brow--faded' : ''}`} style={{ gridTemplateColumns: 'minmax(0,1fr) auto', gap: '4px var(--s3)' }}>
          <span className="brow__title" style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
            <span className="nowrap">{r.label}</span>
            <span className="small dim tnum">{r.count}</span>
          </span>
          <span className={`fig fig--s tnum ${r.netPence > 0 ? 'pos' : r.netPence < 0 ? 'neg' : ''}`}>
            {money(r.netPence, currency, { sign: true })}
          </span>
          <span style={{ gridColumn: '1 / -1' }}>
            <span className="meter" style={{ display: 'block' }}>
              <span className={`meter__fill ${r.netPence >= 0 ? 'meter__fill--pos' : 'meter__fill--neg'}`}
                style={{ width: `${(Math.abs(r.netPence) / peak) * 100}%` }} />
            </span>
          </span>
        </li>
      ))}
    </ul>
  );
}
