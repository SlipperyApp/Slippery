import type { Metadata } from 'next';
import Link from 'next/link';
import { getViewer } from '@/lib/data/session';
import {
  select, summarise, facets, filterByOutcome, scopeFromParams, scopeLabel,
  settledToday, balance, realisedPence, scopeToQuery, sourceFacets, filterBySource,
} from '@/lib/data/analytics';
import { ScopeBar } from '@/components/app/ScopeBar';
import { LedgerRows } from '@/components/app/LedgerRows';
import { RunningNow } from '@/components/app/RunningNow';
import { MoneyUp, PctUp } from '@/components/app/CountUp';
import { MoneyMoved } from '@/components/app/MoneyMoved';
import { attention, needsFromParam, filterByNeeds, NEEDS_LABEL } from '@/lib/data/attention';
import { Icon } from '@/components/Icon';
import { money, plural } from '@/lib/format';
import { EmptyLedger } from '@/components/app/EmptyLedger';
import { emptyReason } from '@/lib/data/viewer';

export const metadata: Metadata = {
  title: 'Ledger',
  description: 'Every bet, with facets whose counts agree with the rows they promise.',
};

export default async function Ledger({
  searchParams,
}: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const { data, now, demo, balance: bal, source: viewerSource, storeReady } = await getViewer();

  /*  An account with nothing in it gets the empty ledger, whose five figures
      are real and are zero, rather than the example account's rows. */
  if (viewerSource === 'empty') {
    return <EmptyLedger reason={emptyReason(storeReady)} currency={data.account.currency} />;
  }

  const scope = scopeFromParams(sp, demo ? 'all' : undefined);
  const { account, bets, movements } = data;

  // ONE query. Everything below counts what this returns, which is why the
  // facet total equals the row total.
  const tz = account.timeZone;
  const rows = select(bets, scope, now, account.weekStart, tz);
  const outcome = typeof sp.outcome === 'string' ? sp.outcome : null;
  /*  The sidebar's "Needs you" counts link here. A count that goes nowhere
      is a count nobody trusts, so the same split that produced it filters
      the rows: one function, one definition of running and waiting. */
  const needs = needsFromParam(sp.needs);
  const search = typeof sp.q === 'string' ? sp.q.trim().toLowerCase() : '';
  /*  Shown, hidden or shown alone. No parameter is every bet, ?source=own
      hides imported history and ?source=imported shows only it. */
  const source = typeof sp.source === 'string' ? sp.source : null;

  const facetSet = facets(rows);
  /*  Counted off the same array the outcome facets are counted off, which is
      the array the rows come from. Both sets sum to the row total for the
      same reason: one query, counted twice. */
  const sourceSet = sourceFacets(rows);
  let shown = filterBySource(filterByNeeds(filterByOutcome(rows, outcome), needs, now), source);
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
  const today = settledToday(bets, now, tz);

  /*  THE OTHER HALF OF AN EACH WAY BET, keyed by the id of the half it
      belongs to. The sheet shows both halves of the sum, and it has to find
      the sibling in the WHOLE book rather than in the rows on screen: the
      win half usually loses while the place half pays, so any outcome facet
      splits the pair, and a place half claiming to be the whole bet is the
      one figure on that screen a reader cannot check.

      Each way bets are a small fraction of the record and carry no legs, so
      this is a short map rather than a second copy of the ledger. */
  const ewSiblings: Record<string, typeof bets[number]> = {};
  const byGroup = new Map<string, typeof bets>();
  for (const b of bets) {
    if (!b.ewGroupId) continue;
    byGroup.set(b.ewGroupId, [...(byGroup.get(b.ewGroupId) ?? []), b]);
  }
  for (const pair of byGroup.values()) {
    if (pair.length !== 2) continue;
    ewSiblings[pair[0].id] = pair[1];
    ewSiblings[pair[1].id] = pair[0];
  }

  return (
    <>
      <div className="spread" style={{ marginBottom: 'var(--gap-block)', flexWrap: 'wrap' }}>
        <h1>Ledger</h1>
        {/*  row--wrap, or three buttons beside a heading are 329px inside
             a 320px phone and the whole page scrolls sideways. The parent
             wraps the heading away from the buttons; this wraps the buttons
             away from each other. */}
        <div className="row row--wrap" style={{ gap: 'var(--s3)' }}>
          <Link href="/app/gallery" className="btn btn--quiet btn--sm">
            <Icon name="camera" size={16} /> Slips
          </Link>
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
          <Icon
            name={needs === 'waiting' ? 'alert' : needs === 'resting' ? 'calendar' : 'clock'}
            size={16}
            className="filterchip__i"
          />
          <span>Showing <strong>{NEEDS_LABEL[needs].toLowerCase()}</strong> · {shown.length} of {rows.length}</span>
          {/*  scopeToQuery already returns its own leading ?, so adding one
               produced /app/ledger??period=all. The key parses as "?period"
               and the scope is silently dropped: latent today only because
               the demo defaults to all time, wrong for every real account
               that has changed period. */}
          <Link href={`/app/ledger${scopeToQuery(scope)}`} className="filterchip__x">
            Show everything
          </Link>
        </div>
      ) : null}

      {/*  Four boxes, not five figures on one line. A row of numbers reads as
           a sentence and has to be parsed left to right; four bordered cells
           can be looked at in any order, which is how somebody actually
           reads a summary. Bets moved into the footer because it is a count
           of the rows below, not a fifth statistic about money. */}
      <div className="statgrid" style={{ marginBottom: 'var(--gap-block)' }}>
        {/*  The four count, and they count again from where they were every
             time a facet or a period changes the answer. These are the
             figures the page is for and they are the only thing on it that
             genuinely moves. */}
        <div className="stat">
          <p className="label">Staked</p>
          <p className="fig fig--m tnum"><MoneyUp minor={s.stakedPence} currency={account.currency} /></p>
        </div>
        <div className="stat">
          <p className="label">Returned</p>
          <p className="fig fig--m tnum"><MoneyUp minor={s.returnedPence} currency={account.currency} /></p>
        </div>
        <div className="stat">
          <p className="label">Net</p>
          <p className={`fig fig--m tnum ${s.netPence > 0 ? 'pos' : s.netPence < 0 ? 'neg' : ''}`}>
            <MoneyUp minor={s.netPence} currency={account.currency} sign />
          </p>
        </div>
        <div className="stat">
          <p className="label">Return</p>
          <p className={`fig fig--m tnum ${s.roi > 0 ? 'pos' : s.roi < 0 ? 'neg' : ''}`}>
            <PctUp value={s.roi} sign />
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
        balancePence={balance(bets, movements, account.balanceStartPence)}
        tz={tz}
      />

      {/*  THE BALANCE, AND THE HALF OF IT THAT IS THEIRS. It sits above the
           rows and below the open positions, because it is the answer to
           the question the summary strip raises: the strip says what the
           betting did and this says what is actually in there. */}
      <MoneyMoved
        balanceName={bal.name}
        movements={movements}
        startMinor={account.balanceStartPence}
        realisedMinor={realisedPence(bets)}
        currency={account.currency}
      />

      <LedgerRows
        bets={shown}
        movements={movements}
        allBets={bets}
        balanceStartMinor={account.balanceStartPence}
        facets={facetSet.list}
        facetTotal={facetSet.total}
        sourceFacets={sourceSet.list}
        activeSource={source}
        ewSiblings={ewSiblings}
        rowTotal={rows.length}
        activeOutcome={outcome}
        search={search}
        currency={account.currency}
        oddsFormat={account.oddsFormat}
        showProfitIn={account.showProfitIn}
        tz={tz}
      />
    </>
  );
}
