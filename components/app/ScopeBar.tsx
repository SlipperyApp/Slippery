'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { PERIODS, type Scope } from '@/lib/data/analytics';
import { Seg } from '@/components/app/Seg';
import { SPORTS, ALL_BOOKMAKERS } from '@/lib/data/reference';

/** One scope governs every module on the page it is on.
 *
 *  Scope persists per account and rides in the URL as a query parameter, so
 *  a shared link carries it. Exactly three modules ignore it and say so in
 *  their own header.
 *
 *  IT COMES APART INTO TWO PIECES because the dashboard needs them in two
 *  places. The period is the chart card's own selector, sitting on the module
 *  whose whole subject is time; the two filters are in that card's corner
 *  menu, which is where anything a module can be adjusted by lives. The
 *  ledger still takes the pair as one bar, which is what it always was.
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

export function ScopeBar({ scope, books }: { scope: Scope; books?: string[] }) {
  return (
    <div className="scopebar" role="group" aria-label="Scope for every module below">
      <PeriodSeg scope={scope} label="Period" />
      <ScopeFilters scope={scope} books={books} />
    </div>
  );
}
