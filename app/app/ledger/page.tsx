import type { Metadata } from 'next';
import Link from 'next/link';
import { getViewer } from '@/lib/data/session';
import {
  select, facets, filterByOutcome, scopeFromParams,
  scopeToQuery, sourceFacets, filterBySource,
} from '@/lib/data/analytics';
import { ScopePicker } from '@/components/app/ScopeBar';
import { LedgerRows } from '@/components/app/LedgerRows';
import { OpenBar } from '@/components/app/OpenBar';
import { attention, needsFromParam, filterByNeeds, NEEDS_LABEL } from '@/lib/data/attention';
import { Icon } from '@/components/Icon';
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
  const { data, now, demo, source: viewerSource, storeReady } = await getViewer();

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
  /*  The rail's Open bets row and the sidebar's counts both link here with
      ?needs=. A count that goes nowhere is a count nobody trusts, so the
      same split that produced it filters the rows: one function, one
      definition of running and waiting. */
  const needs = needsFromParam(sp.needs);
  const search = typeof sp.q === 'string' ? sp.q.trim().toLowerCase() : '';
  /*  Shown, hidden or shown alone. No parameter is every bet, ?source=own
      hides imported history and ?source=imported shows only it. */
  const source = typeof sp.source === 'string' ? sp.source : null;
  /*  The rail's search row lands here with ?find=1, which opens with the
      cursor in the search box. A row that says Search and lands somebody on
      an unfiltered list with nothing focused is a row that did nothing. */
  const focusSearch = sp.find === '1';

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

  /*  Off the whole book, not off `rows`: a bet that is running right now is
      running whatever scope is selected, and hiding one because it was
      placed last month is not a filter anybody means. */
  const att = attention(bets, now);

  /*  THE OTHER HALF OF AN EACH WAY BET, keyed by the id of the half it
      belongs to. The sheet shows both halves of the sum, and it has to find
      the sibling in the WHOLE book rather than in the rows on screen: the
      win half usually loses while the place half pays, so any outcome facet
      splits the pair, and a place half claiming to be the whole bet is the
      one figure on that screen a reader cannot check. */
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
      {/*  THE FOUR STAT TILES ARE GONE. Staked, Returned, Net and Return were
           the dashboard's own figures printed a second time, one screen away,
           over a different denominator: the dashboard reports the scope and
           this reported the scope with the outcome facet and the search box
           applied, so the two pages disagreed about an account's net whenever
           anything on this one was filtered. The dashboard owns them.

           THE BALANCE BLOCK IS GONE TOO, to /app/balances, which is the page
           that already exists for exactly this and reads every balance rather
           than the one that happens to be open. What went with it: the three
           figures and their plus and equals signs, the paragraph explaining
           that deposits are not in your return, and Record a deposit. */}
      {/*  ONE HEADER ROW: the name, the period every figure under it is
           scoped by, and what else this screen can reach. Three rows of
           chrome above a list of bets is three rows the list does not have,
           and on a screen that ends where the window does that is about
           thirty rows against twenty three. It wraps to three lines under
           1000, which is a phone and has the height for it. */}
      <div className="spread lgr__top">
        <h1>Ledger</h1>

        {/*  THE SHARED SELECTOR, NOT A LOCAL COPY. This page drew its own bar
             holding the period and two filters, and the dashboard drew the
             period alone inside a card, so the same five chips were two
             controls in two shapes on two screens. Both call ScopePicker now.
             The bookmaker and the sport moved into the filter row below,
             because they are questions about which bets rather than about
             when. */}
        <ScopePicker scope={scope} />

        <div className="row row--wrap" style={{ gap: 'var(--s3)' }}>
          <Link href="/app/balances" className="btn btn--quiet btn--sm">
            <Icon name="bank" size={16} /> Balances
          </Link>
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

      {/*  ARRIVING FILTERED, AND SAYING SO. The rail's Open bets row links
           here with ?needs=, and a list that has silently dropped four fifths
           of its rows with nothing on screen to explain it is the most
           disorienting thing a page can do. */}
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
               and the scope is silently dropped. */}
          <Link href={`/app/ledger${scopeToQuery(scope)}`} className="filterchip__x">
            Show everything
          </Link>
        </div>
      ) : null}

      {/*  OPEN BETS AS ONE ROW. It was a card with two large figures, three
           headed groups, a paragraph under the first of them and up to twelve
           named bets, above a list of the same bets. See OpenBar. */}
      <OpenBar
        count={att.openCount}
        waiting={att.waiting.length}
        atRiskMinor={att.openStakePence}
        currency={account.currency}
        scope={scope}
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
        focusSearch={focusSearch}
        scope={scope}
        currency={account.currency}
        oddsFormat={account.oddsFormat}
        showProfitIn={account.showProfitIn}
        tz={tz}
      />
    </>
  );
}
