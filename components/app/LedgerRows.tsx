'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Icon } from '@/components/Icon';
import { EmptyState } from './BetRow';
import { BetSheet } from './BetSheet';
import { BetTable, FIRST_DIR, sortBets, type Entry, type SortKey } from './BetTable';
import { SPORTS, ALL_BOOKMAKERS } from '@/lib/data/reference';
import type { Scope } from '@/lib/data/analytics';
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

/** The list, one filter control, and the bet beside it.
 *
 *  ONE FILTER CONTROL, NOT THREE ROWS AND A SENTENCE. This screen carried a
 *  search form, then a row of outcome pills with their counts, then a row of
 *  source pills with their counts, then a line reading "Showing 50 of 218
 *  filtered from 218. Facets sum to 218." Four rows of chrome, about 170
 *  pixels, before the first bet, on a page that is a list of bets. They are
 *  one row of controls now: what you are looking for, then four questions
 *  about which bets, each a dropdown carrying its own counts.
 *
 *  THE COUNTS DID NOT GO, THEY MOVED INTO THE OPTIONS. Every count still
 *  derives from one query and the facet total still equals the row total,
 *  which is rule 5 of this codebase; what went is the sentence asserting it
 *  to the reader. A person who wants to know how many won reads "Won 99" in
 *  the list they choose it from.
 *
 *  THE SORT INSTRUCTION WENT. "Your bets, newest first. Press a column
 *  heading to sort by it, or a row to open the bet." A table with sort
 *  arrows in its headings is a table anybody has pressed a heading on
 *  before. */
export function LedgerRows({
  bets, facets, facetTotal, sourceFacets, activeSource, ewSiblings,
  rowTotal, activeOutcome, search, focusSearch = false, scope,
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
  /** Arrived from the rail's search row, so the cursor goes in the box. */
  focusSearch?: boolean;
  /** The bookmaker and the sport are part of the scope, and their dropdowns
   *  are in this row rather than in a bar of their own. The period is the
   *  shared selector above and is not repeated here. */
  scope: Scope;
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
  const box = useRef<HTMLInputElement>(null);
  /*  Sort lives in component state rather than in the URL. A period, a facet
      and a search all change WHICH bets are on the page and belong in a link
      somebody can send; which column they are stacked by does not, and
      putting it in the query string would make every sort a new history
      entry to press Back through. */
  const [sort, setSort] = useState<SortKey>('when');
  const [dir, setDir] = useState<'asc' | 'desc'>('desc');
  const wide = useSyncExternalStore(subscribe, isWide, notWide);

  /*  The rail's Search row lands on /app/ledger?find=1, and a row labelled
      Search that leaves the cursor at the top of the document has not
      searched anything. Once, on arrival: it is not re-run when the list
      re-renders, or every filter change would steal the focus back. */
  useEffect(() => {
    if (focusSearch) box.current?.focus();
  }, [focusSearch]);

  const set = (key: string, value: string | null) => {
    const next = new URLSearchParams(params?.toString() ?? '');
    if (!value) next.delete(key); else next.set(key, value);
    /*  Off with the first filter change, or the box takes the focus back on
        every navigation this component makes. */
    next.delete('find');
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

      A sort takes them out too, for the same reason and one more: a deposit
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

  const paneOpen = Boolean(open) && wide;

  return (
    <>
      <form
        className="lgrfilt"
        role="search"
        onSubmit={(e) => { e.preventDefault(); set('q', q || null); }}
      >
        <label className="sr-only" htmlFor="ledger-q">Search your bets</label>
        <span className="lgrfilt__find">
          <input
            id="ledger-q" ref={box} className="input" value={q} autoComplete="off" type="search"
            onChange={(e) => setQ(e.target.value)}
            placeholder="Selection, fixture, market, course"
          />
          <button type="submit" className="roundbtn lgrfilt__go" aria-label="Search your bets">
            <Icon name="search" size={16} />
          </button>
        </span>

        {/*  THE FACET COUNTS ARE IN THE OPTIONS. Two rows of pills carrying
             the same numbers took 96 pixels above the list and could not be
             read as a set: eight outcomes wrapped to two lines at 1440 and
             the eye had to find the pressed one among them. A select says
             which is on in one word. */}
        <label className="sr-only" htmlFor="ledger-outcome">Outcome</label>
        <select
          id="ledger-outcome"
          className="select lgrfilt__sel"
          value={activeOutcome ?? 'all'}
          onChange={(e) => set('outcome', e.target.value === 'all' ? null : e.target.value)}
        >
          <option value="all">Every outcome ({facetTotal})</option>
          {facets.map((f) => (
            <option key={f.id} value={f.id}>{f.label} ({f.count})</option>
          ))}
        </select>

        {/*  Only where the record actually holds both kinds. A control that
             filters nothing away teaches somebody the filter does not work. */}
        {sourceFacets.length > 1 ? (
          <>
            <label className="sr-only" htmlFor="ledger-source">Where the bet came from</label>
            <select
              id="ledger-source"
              className="select lgrfilt__sel"
              value={activeSource ?? 'all'}
              onChange={(e) => set('source', e.target.value === 'all' ? null : e.target.value)}
            >
              <option value="all">Placed here and imported</option>
              {sourceFacets.map((f) => (
                <option key={f.id} value={f.id}>{f.label} ({f.count})</option>
              ))}
            </select>
          </>
        ) : null}

        <label className="sr-only" htmlFor="ledger-book">Bookmaker</label>
        <select
          id="ledger-book"
          className="select lgrfilt__sel"
          value={scope.bookmakerId}
          onChange={(e) => set('book', e.target.value === 'all' ? null : e.target.value)}
        >
          <option value="all">Every bookmaker</option>
          {ALL_BOOKMAKERS.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>

        <label className="sr-only" htmlFor="ledger-sport">Sport</label>
        <select
          id="ledger-sport"
          className="select lgrfilt__sel"
          value={scope.sportId}
          onChange={(e) => set('sport', e.target.value === 'all' ? null : e.target.value)}
        >
          <option value="all">Every sport</option>
          {SPORTS.map((sp) => <option key={sp.id} value={sp.id}>{sp.name}</option>)}
        </select>

        {search ? (
          <button type="button" className="btn btn--quiet btn--sm" onClick={() => { setQ(''); set('q', null); }}>
            Clear
          </button>
        ) : null}
      </form>

      {page.length === 0 ? (
        <div className="card">
          {/*  WHICH EMPTY THIS IS, decided by whether the ACCOUNT has rows
               rather than by which of three controls is set. rowTotal is the
               count before any filter, so one condition covers every way in,
               and the action is the way out of the filter rather than an
               invitation to add a bet: /app/ledger with no query clears every
               one of them, including the ones this component does not own. */}
          <EmptyState
            title={rowTotal > 0 ? 'Nothing matches this filter.' : 'Your first slip goes here.'}
            action={rowTotal > 0 ? 'Show everything' : 'Add a bet'}
            icon={rowTotal > 0 ? 'close' : 'plus'}
            href={rowTotal > 0 ? '/app/ledger' : '/app/import'}
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
        /*  THE LIST AND THE BET, SIDE BY SIDE FROM 1400.
             A wide screen can hold both, and holding both is the difference
             between a ledger and a phone screen with more air in it: the
             rows you were reading stay on screen while you read one of them.

             THE PANE IS ONLY IN THE DOCUMENT WHEN A BET IS OPEN. It used to
             draw a resting state, a slip icon over "Press a bet" and two
             sentences about where the working opens, in a 400 pixel column
             beside the list on every visit. That is a third of a wide window
             spent telling somebody to press something, and the list is one
             press wide. With nothing open the grid is one column and the
             rows take the width. */
        <div className={`lgr fitcol${paneOpen ? ' lgr--open' : ''}`}>
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
                    Load {Math.min(PAGE, bets.length - cursor)} more of {count(bets.length)}
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

          {paneOpen && open ? (
            <aside className="lgr__side" aria-label="The bet you have open">
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
            </aside>
          ) : null}
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
