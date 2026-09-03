'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { PERIODS, type Scope } from '@/lib/data/analytics';
import { Seg } from '@/components/app/Seg';
import { SPORTS, ALL_BOOKMAKERS } from '@/lib/data/reference';

/** One scope governs every module on the page it is on.
 *
 *  Scope rides in the URL as a query parameter, so a shared link carries it.
 *
 *  IT COMES APART INTO TWO PIECES because the period and the filters are
 *  asked in different places. The period is the one control at the top of the
 *  dashboard and the top of the ledger, above everything it governs; the
 *  bookmaker and the sport are questions about WHICH bets rather than about
 *  when, so they sit in the ledger's own filter row beside the outcome and
 *  the source. The docstring here used to say the period was the chart card's
 *  own selector and the filters were in that card's corner menu, which is the
 *  arrangement this branch removed: a control that changes six modules cannot
 *  live inside one of them.
 *
 *  ONE WRITER OF THE QUERY. Both pieces set through the same function, or
 *  "clear the period" and "clear the bookmaker" drift into two rules about
 *  what a default means. */
function useScopeWriter() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  return (key: string, value: string) => {
    const next = new URLSearchParams(params?.toString() ?? '');
    if (value === 'all' || (key === 'period' && value === 'month')) next.delete(key);
    else next.set(key, value);
    const q = next.toString();
    router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
  };
}

/** The five periods, on their own. */
export function PeriodSeg({ scope, label = 'Period for every module' }: { scope: Scope; label?: string }) {
  const set = useScopeWriter();
  return (
    <Seg label={label} className="seg--tight">
      {PERIODS.map((p) => (
        <button
          key={p.id}
          type="button"
          className="seg__btn"
          aria-pressed={scope.period === p.id}
          onClick={() => set('period', p.id)}
        >
          {p.chip}
        </button>
      ))}
    </Seg>
  );
}

/** The two filters, on their own.
 *
 *  The selects carried an inline minHeight of 40, which beat the 44px floor
 *  .select declares and which nothing written in a stylesheet could have put
 *  back: an inline style wins over every rule in floors.css. They are a class
 *  now, and they share a row on a phone rather than taking one each. */
export function ScopeFilters({ scope, books, id = 'scope' }: { scope: Scope; books?: string[]; id?: string }) {
  const set = useScopeWriter();
  const bookList = books
    ? ALL_BOOKMAKERS.filter((b) => books.includes(b.id))
    : ALL_BOOKMAKERS;

  return (
    <>
      <label className="sr-only" htmlFor={`${id}-book`}>Bookmaker</label>
      <select
        id={`${id}-book`}
        className="select scopebar__sel scopebar__sel--book"
        value={scope.bookmakerId}
        onChange={(e) => set('book', e.target.value)}
      >
        <option value="all">Every bookmaker</option>
        {bookList.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
      </select>

      <label className="sr-only" htmlFor={`${id}-sport`}>Sport</label>
      <select
        id={`${id}-sport`}
        className="select scopebar__sel scopebar__sel--sport"
        value={scope.sportId}
        onChange={(e) => set('sport', e.target.value)}
      >
        <option value="all">Every sport</option>
        {SPORTS.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
      </select>
    </>
  );
}

/** THE PERIOD, ON ITS OWN, CENTRED AND NARROW.
 *
 *  One control, above everything it governs, and every module on the page
 *  under it reads from it: the two figures, the six bars, the calendar, the
 *  breakdown and the curve, labels included. It was inside the curve card's
 *  own header on the argument that the period belongs on the module about
 *  time, and that is exactly backwards: a control that changes six modules
 *  cannot live inside one of them, and a reader looking for why the
 *  breakdown changed had to find it in a card two rows away.
 *
 *  Narrow and centred rather than a bar across the top, because it is the
 *  only control on the screen and a full width strip of chips reads as a
 *  toolbar, which is a row of controls where the dashboard puts a row of
 *  figures. */
export function ScopePicker({ scope }: { scope: Scope }) {
  return (
    <div className="scopepick">
      <PeriodSeg scope={scope} label="Period for every module" />
    </div>
  );
}

export function ScopeBar({ scope, books }: { scope: Scope; books?: string[] }) {
  return (
    <div className="scopebar" role="group" aria-label="Scope for every module below">
      <PeriodSeg scope={scope} label="Period" />
      <ScopeFilters scope={scope} books={books} />
    </div>
  );
}
