import type { Metadata } from 'next';
import Link from 'next/link';
import { getViewer } from '@/lib/data/session';
import {
  select, summarise, facets, filterByOutcome, scopeFromParams, scopeLabel,
  settledToday, bankroll, scopeToQuery,
} from '@/lib/data/analytics';
import { ScopeBar } from '@/components/app/ScopeBar';
import { LedgerRows } from '@/components/app/LedgerRows';
import { RunningNow } from '@/components/app/RunningNow';
import { attention, needsFromParam, filterByNeeds, NEEDS_LABEL } from '@/lib/data/attention';
import { Icon } from '@/components/Icon';
import { money, pct, plural } from '@/lib/format';

export const metadata: Metadata = {
  title: 'Ledger',
  description: 'Every bet, with facets whose counts agree with the rows they promise.',
};

export default async function Ledger({
  searchParams,
}: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const { data, now, demo } = await getViewer();
  const scope = scopeFromParams(sp, demo ? 'all' : undefined);
  const { account, bets } = data;

  // ONE query. Everything below counts what this returns, which is why the
  // facet total equals the row total.
  const rows = select(bets, scope, now, account.weekStart);
  const outcome = typeof sp.outcome === 'string' ? sp.outcome : null;
  /*  The sidebar's "Needs you" counts link here. A count that goes nowhere
      is a count nobody trusts, so the same split that produced it filters
      the rows: one function, one definition of running and waiting. */
  const needs = needsFromParam(sp.needs);
  const search = typeof sp.q === 'string' ? sp.q.trim().toLowerCase() : '';

  const facetSet = facets(rows);
  let shown = filterByNeeds(filterByOutcome(rows, outcome), needs, now);
  if (search) {
    shown = shown.filter((b) =>
      `${b.selection} ${b.eventName} ${b.marketRaw} ${b.competition ?? ''} ${b.course ?? ''}`
        .toLowerCase().includes(search));
  }
  shown = [...shown].sort((a, b) => new Date(b.eventAt).getTime() - new Date(a.eventAt).getTime());

  const s = summarise(shown);
  /*  Off the whole book, not off `rows`: a bet that is running right now is
      running whatever scope is selected, and hiding one because it was
      placed last month is not a filter anybody means. */
  const att = attention(bets, now);
  const today = settledToday(bets, now);

  return (
    <>
      <div className="spread" style={{ marginBottom: 'var(--s4)', flexWrap: 'wrap' }}>
        <h1>Ledger</h1>
        <div className="row" style={{ gap: 'var(--s3)' }}>
          <Link href="/app/history" className="btn btn--quiet btn--sm">
            <Icon name="clipboard" size={16} /> Change history
          </Link>
          <Link href="/app/import" className="btn btn--primary btn--sm">
            <Icon name="plus" size={16} /> Add a bet
          </Link>
        </div>
      </div>

      <ScopeBar scope={scope} />

      {/*  ARRIVING FILTERED, AND SAYING SO. The sidebar's counts link here
           with ?needs=, and a list that has silently dropped four fifths of
           its rows with nothing on screen to explain it is the most
           disorienting thing a page can do. The chip names the filter and
           removes it. */}
      {needs ? (
        <div className="filterchip" role="status">
          <Icon name={needs === 'waiting' ? 'alert' : 'clock'} size={16} className="filterchip__i" />
          <span>Showing <strong>{NEEDS_LABEL[needs].toLowerCase()}</strong> · {shown.length} of {rows.length}</span>
          <Link href={`/app/ledger${scopeToQuery(scope) ? `?${scopeToQuery(scope)}` : ''}`} className="filterchip__x">
            Show everything
          </Link>
        </div>
      ) : null}

      {/*  Four boxes, not five figures on one line. A row of numbers reads as
           a sentence and has to be parsed left to right; four bordered cells
           can be looked at in any order, which is how somebody actually
           reads a summary. Bets moved into the footer because it is a count
           of the rows below, not a fifth statistic about money. */}
      <div className="statgrid" style={{ marginBottom: 'var(--s4)' }}>
        <div className="stat">
          <p className="label">Staked</p>
          <p className="fig fig--m tnum">{money(s.stakedPence, account.currency)}</p>
        </div>
        <div className="stat">
          <p className="label">Returned</p>
          <p className="fig fig--m tnum">{money(s.returnedPence, account.currency)}</p>
        </div>
        <div className="stat">
          <p className="label">Net</p>
          <p className={`fig fig--m tnum ${s.netPence > 0 ? 'pos' : s.netPence < 0 ? 'neg' : ''}`}>
            {money(s.netPence, account.currency, { sign: true })}
          </p>
        </div>
        <div className="stat">
          <p className="label">Return</p>
          <p className={`fig fig--m tnum ${s.roi > 0 ? 'pos' : s.roi < 0 ? 'neg' : ''}`}>
            {pct(s.roi, { sign: true })}
          </p>
        </div>
        <p className="statgrid__foot small dim">
          {plural(s.count, 'bet')} · {scopeLabel(scope)}.
          {s.voidedStakePence > 0
            ? ` Turnover and return exclude ${money(s.voidedStakePence, account.currency)} of voided stakes.`
            : ''}
        </p>
      </div>

      {/*  Open positions first, then the rows. This module was on the
           dashboard, which is for statistics; a named bet at a named price
           with a named bookmaker is not a statistic. */}
      <RunningNow
        att={att}
        today={today}
        currency={account.currency}
        bankrollPence={bankroll(bets, account.bankrollStartPence)}
      />

      <LedgerRows
        bets={shown}
        facets={facetSet.list}
        facetTotal={facetSet.total}
        rowTotal={rows.length}
        activeOutcome={outcome}
        search={search}
        currency={account.currency}
        oddsFormat={account.oddsFormat}
        showProfitIn={account.showProfitIn}
      />
    </>
  );
}
