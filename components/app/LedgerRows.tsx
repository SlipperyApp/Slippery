'use client';

import { useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Icon } from '@/components/Icon';
import { EmptyState } from './BetRow';
import { BetSheet } from './BetSheet';
import { BetTable, FIRST_DIR, sortBets, type Entry, type SortKey } from './BetTable';
import type { DemoBet } from '@/lib/data/demo';
import type { Currency } from '@/lib/domain/types';
import type { OddsFormat } from '@/lib/odds';
import { count, DEFAULT_TZ, type TimeZone } from '@/lib/format';
import { balanceAfterEach, type Movement } from '@/lib/domain/movements';

/*  Fifty, not twenty five. A page of bets is a scan rather than a read, and
    twenty five ran out inside one busy weekend, so the first thing anybody
    did on this screen was press the button. It stays a button: infinite
    scroll takes the footer away from a page whose footer carries the link to
    the change history. */
const PAGE = 50;

/*  THE DETAIL PANE'S BREAKPOINT, and it is not the sidebar's.
 *
 *  A sheet pushed over a list is the right answer on a phone and the wrong
 *  one on a monitor: it hides the thirty rows you were reading to show you
 *  one of them, and closing it is the only way back. Beside the list, the
 *  list stays. The number is measured: the pane wants 300px and the table's
 *  six fixed columns take 526, so under 1400 what is left for a selection
 *  and its fixture is under 200px, and a split that truncates every row to
 *  make space for a panel is worse than the sheet. See .lgr in
 *  components.css, where the same number is written down once more. */
const SPLIT_AT = 1400;
const QUERY = `(min-width: ${SPLIT_AT}px)`;

const subscribe = (cb: () => void) => {
  const m = window.matchMedia(QUERY);
  m.addEventListener('change', cb);
  return () => m.removeEventListener('change', cb);
};
const isWide = () => window.matchMedia(QUERY).matches;
/*  The server has no viewport, so it says no, and nothing is open on first
    paint anyway: this is only ever read after somebody presses a row. */
const notWide = () => false;

/** Cursor pagination, and facets whose counts agree with the rows.
 *
 *  The count line says "N of M shown" rather than leaving two numbers on
 *  screen to disagree with each other. */
export function LedgerRows({
  bets, facets, facetTotal, sourceFacets, activeSource, ewSiblings,
  rowTotal, activeOutcome, search,
  currency, oddsFormat, showProfitIn, tz = DEFAULT_TZ,
  movements = [], allBets = [], balanceStartMinor = 0,
}: {
  bets: DemoBet[];
  facets: { id: string; label: string; count: number }[];
  facetTotal: number;
  sourceFacets: { id: string; label: string; count: number }[];
  activeSource: string | null;
  /** The other half of an each way bet, by the id of the half it belongs to. */
  ewSiblings: Record<string, DemoBet>;
  rowTotal: number;
  activeOutcome: string | null;
  search: string;
  currency: Currency;
  oddsFormat: OddsFormat;
  showProfitIn: 'currency' | 'units' | 'both';
  tz?: TimeZone;
  /*  MONEY IN AND MONEY OUT, in the ledger with the bets, because that is
      where somebody looks for what happened to their money and a deposit is
      one of the things that happened to it.

      They are NOT in any count on this screen. The facets count outcomes and
      a deposit has none, and the promise that the facet total equals the row
      total is the one thing on this page that has to stay true, so the two
      totals are stated apart and neither is a sum of the other. */
  movements?: Movement[];
  /** The whole book, for the running balance. A balance computed off the
   *  filtered rows would be a different number from the one in the top bar. */
  allBets?: DemoBet[];
  balanceStartMinor?: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [cursor, setCursor] = useState(PAGE);
  const [open, setOpen] = useState<DemoBet | null>(null);
  const [q, setQ] = useState(search);
  /*  Sort lives in component state rather than in the URL. A period, a facet
      and a search all change WHICH bets are on the page and belong in a link
      somebody can send; which column they are stacked by does not, and
      putting it in the query string would make every sort a new history
      entry to press Back through. */
  const [sort, setSort] = useState<SortKey>('when');
  const [dir, setDir] = useState<'asc' | 'desc'>('desc');
  const wide = useSyncExternalStore(subscribe, isWide, notWide);

  const set = (key: string, value: string | null) => {
    const next = new URLSearchParams(params?.toString() ?? '');
    if (!value) next.delete(key); else next.set(key, value);
    const s = next.toString();
    setCursor(PAGE);
    router.replace(s ? `${pathname}?${s}` : pathname, { scroll: false });
  };

  const sorted = sort === 'when' && dir === 'desc' ? bets : sortBets(bets, sort, dir);
  const page = sorted.slice(0, cursor);
  const sorting = sort !== 'when' || dir !== 'desc';

  const pressSort = (key: SortKey) => {
    setCursor(PAGE);
    if (key === sort) { setDir(dir === 'asc' ? 'desc' : 'asc'); return; }
    setSort(key);
    setDir(FIRST_DIR[key]);
  };

  /*  A movement is shown when nothing is filtering the bets, and hidden the
      moment something is. Every filter on this page is a question about
      bets: an outcome a deposit does not have, a source it did not come
      from, a search over selections it has none of. Leaving them in under a
      filter would put rows in a list that the filter above says are not
      there.

      Inside the page's own window, so the load-more button governs them the
      way it governs the rows: a deposit from March has no business at the
      top of fifty August bets. */
  /*  A sort takes them out too, for the same reason and one more: a deposit
      has no stake, no price and no result, so under any column but the date
      it would file at whichever end the blanks land, which is a row in the
      list that the heading above it cannot explain. */
  const filtered = Boolean(activeOutcome || activeSource || search);
  const oldestShown = page.length ? page[page.length - 1].eventAt : null;
  const shownMovements = filtered || sorting || !oldestShown
    ? []
    : movements.filter((m) => Date.parse(m.occurredAt) >= Date.parse(oldestShown));
  const balanceAfter = balanceAfterEach(balanceStartMinor, movements, allBets);

  /*  One list, newest first, the way a bank statement reads. The two shapes
      are told apart by the row, not by the order. */
  const entries: Entry[] = [
    ...page.map((b) => ({ kind: 'bet' as const, at: b.eventAt, bet: b })),
    ...shownMovements.map((m) => ({ kind: 'movement' as const, at: m.occurredAt, movement: m })),
  ];
  if (!sorting) entries.sort((a, b) => Date.parse(b.at) - Date.parse(a.at));

  return (
    <>
      <form
        className="row"
        style={{ gap: 'var(--s2)', marginBottom: 'var(--gap-block)' }}
        onSubmit={(e) => { e.preventDefault(); set('q', q || null); }}
      >
        <label className="sr-only" htmlFor="ledger-q">Search your bets</label>
        <input
          id="ledger-q" className="input grow" value={q} autoComplete="off"
          onChange={(e) => setQ(e.target.value)}
          placeholder="Selection, fixture, market, course"
        />
        <button type="submit" className="btn btn--ghost" aria-label="Search your bets">
          <Icon name="search" size={18} />
        </button>
        {search ? (
          <button type="button" className="btn btn--quiet" onClick={() => { setQ(''); set('q', null); }}>
            Clear
          </button>
        ) : null}
      </form>

      <div
        className="row row--wrap" style={{ gap: 'var(--s2)', marginBottom: 'var(--s3)' }}
        role="group" aria-label="Filter by outcome"
      >
        {/*  .pill--accent, not an inline colour. These carried
             color: var(--accent) written by hand, which is the exact thing
             .pill--accent exists to stop: --accent is the button GROUND
             colour and measured 4.38:1 as text on a card, which axe found
             and called serious. The class uses --accent-2, which is the one
             of the two accents made for text. */}
        <button
          type="button" className={`pill pill--lg${activeOutcome ? '' : ' pill--accent'}`}
          aria-pressed={!activeOutcome}
          onClick={() => set('outcome', null)}
          style={{ cursor: 'pointer' }}
        >
          All <span className="tnum">{facetTotal}</span>
        </button>
        {facets.map((f) => (
          <button
            key={f.id} type="button"
            className={`pill pill--lg${activeOutcome === f.id ? ' pill--accent' : ''}`}
            aria-pressed={activeOutcome === f.id}
            onClick={() => set('outcome', activeOutcome === f.id ? null : f.id)}
            style={{ cursor: 'pointer' }}
          >
            {f.label} <span className="tnum">{f.count}</span>
          </button>
        ))}
      </div>

      {/*  WHERE THE BET CAME FROM. Only drawn when the record actually holds
           both kinds: a chip that filters nothing away is a control that
           teaches somebody the filter does not work.

           Three states out of two chips, which is what "show them, hide them
           or show them alone" needs: neither pressed is every bet, Imported
           is imported alone, Placed here hides them. Pressing the one that
           is already on clears it, so there is no fourth state to get stuck
           in and no separate reset. */}
      {sourceFacets.length > 1 ? (
        <div
          className="row row--wrap" style={{ gap: 'var(--s2)', marginBottom: 'var(--s3)' }}
          role="group" aria-label="Filter by where the bet came from"
        >
          <span className="label" style={{ marginRight: 'var(--s1)' }}>Source</span>
          {sourceFacets.map((f) => (
            <button
              key={f.id} type="button"
              className={`pill pill--lg${activeSource === f.id ? ' pill--accent' : ''}`}
              aria-pressed={activeSource === f.id}
              onClick={() => set('source', activeSource === f.id ? null : f.id)}
              style={{ cursor: 'pointer' }}
            >
              {f.label} <span className="tnum">{f.count}</span>
            </button>
          ))}
        </div>
      ) : null}

      <p className="small dim" style={{ marginBottom: 'var(--s3)' }}>
        {/* One query behind both numbers, so these cannot disagree. */}
        Showing {count(page.length)} of {count(bets.length)}
        {bets.length !== rowTotal ? <> filtered from {count(rowTotal)}</> : null}. Facets sum to {count(facetTotal)}.
        {/*  Counted apart and never added to the bets. A deposit has no
             outcome, so it is in no facet, and rolling it into the row total
             would break the one promise this line makes. */}
        {shownMovements.length > 0
          ? <> Plus {count(shownMovements.length)} money {shownMovements.length === 1 ? 'movement' : 'movements'}, which are in no count above.</>
          : null}
        {(filtered || sorting) && movements.length > 0
          ? <> Deposits and withdrawals are hidden while a {sorting && !filtered ? 'column is sorting' : 'filter is on'}.</>
          : null}
      </p>

      {page.length === 0 ? (
        <div className="card">
          <EmptyState
            title={search || activeOutcome || activeSource ? 'Nothing matches that filter yet.' : 'Your first slip goes here.'}
            action="Add a bet"
            href="/app/import"
            ghost={
              <ul>
                {[1, 2, 3].map((i) => (
                  <li key={i} className="brow">
                    <span className="brow__title">Arsenal to win</span>
                    <span className="fig fig--s">+£38.25</span>
                  </li>
                ))}
              </ul>
            }
          />
        </div>
      ) : (
        /*  THE LIST AND THE BET, SIDE BY SIDE FROM 1280.
             A wide screen can hold both, and holding both is the difference
             between a ledger and a phone screen with more air in it: the
             thirty rows you were reading stay on screen while you read one
             of them. Under 1280 the pane is not drawn at all and the bet
             opens as the sheet it always was. */
        <div className="lgr">
          <div className="lgr__list">
            <div className="card card--table">
              <BetTable
                entries={entries}
                currency={currency}
                oddsFormat={oddsFormat}
                showUnits={showProfitIn === 'units'}
                tz={tz}
                sort={sort}
                dir={dir}
                onSort={pressSort}
                onOpen={setOpen}
                openId={open?.id ?? null}
                balanceAfter={balanceAfter}
              />

              {cursor < bets.length ? (
                <div className="card__foot center">
                  <button type="button" className="btn btn--ghost" onClick={() => setCursor(cursor + PAGE)}>
                    Load {Math.min(PAGE, bets.length - cursor)} more
                  </button>
                </div>
              ) : (
                <p className="small dim card__foot">
                  That is all {count(bets.length)}. <Link href="/app/history">Change history</Link> shows
                  every correction, with the ones made after a result was known flagged.
                </p>
              )}
            </div>
          </div>

          {/*  The pane. It is in the document at every width and CSS decides
               whether there is room for it, so nothing about the list has to
               know: the bet inside it is only ever mounted once, in one of
               the two places, which is what keeps the sheet's own ids from
               appearing twice on the page. */}
          <aside className="lgr__side" aria-label="The bet you have open">
            {open && wide ? (
              <BetSheet
                key={open.id}
                mode="pane"
                bet={open}
                ewSibling={ewSiblings[open.id] ?? null}
                currency={currency}
                oddsFormat={oddsFormat}
                tz={tz}
                onClose={() => setOpen(null)}
              />
            ) : (
              <div className="dpane dpane--rest">
                <Icon name="slip" size={22} className="dpane__mark" />
                <p className="card__title">Press a bet</p>
                <p className="small dim">
                  Every figure on it is folded from its settlement events, and the working opens
                  here beside the list rather than over it.
                </p>
              </div>
            )}
          </aside>
        </div>
      )}

      {open && !wide ? (
        <BetSheet
          bet={open}
          ewSibling={ewSiblings[open.id] ?? null}
          currency={currency}
          oddsFormat={oddsFormat}
          tz={tz}
          onClose={() => setOpen(null)}
          /*  A settlement was written, so the rows behind the sheet are a
              fold ago. router.refresh re-renders the server component with
              the new bet_state rather than patching a copy of it in the
              browser, which is what keeps one fold in the build. */
          onChanged={() => router.refresh()}
        />
      ) : null}
    </>
  );
}
