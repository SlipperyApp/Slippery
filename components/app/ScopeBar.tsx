'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { PERIODS, type Scope } from '@/lib/data/analytics';
import { Seg } from '@/components/app/Seg';
import { SPORTS, ALL_BOOKMAKERS } from '@/lib/data/reference';

/** One global scope bar above the grid governs every module.
 *
 *  Scope persists per account and rides in the URL as a query parameter, so
 *  a shared link carries it. Exactly three modules ignore it and say so in
 *  their own header. */
export function ScopeBar({ scope, books }: { scope: Scope; books?: string[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const set = (key: string, value: string) => {
    const next = new URLSearchParams(params?.toString() ?? '');
    if (value === 'all' || (key === 'period' && value === 'month')) next.delete(key);
    else next.set(key, value);
    const q = next.toString();
    router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
  };

  const bookList = books
    ? ALL_BOOKMAKERS.filter((b) => books.includes(b.id))
    : ALL_BOOKMAKERS;

  return (
    <div className="scopebar" role="group" aria-label="Scope for every module below">
      <Seg label="Period">
        {PERIODS.map((p) => (
          <button
            key={p.id}
            type="button"
            className="seg__btn"
            aria-pressed={scope.period === p.id}
            onClick={() => set('period', p.id)}
          >
            {p.label}
          </button>
        ))}
      </Seg>

      <label className="sr-only" htmlFor="scope-book">Bookmaker</label>
      <select
        id="scope-book"
        className="select"
        style={{ width: 'auto', minWidth: '150px', minHeight: '40px' }}
        value={scope.bookmakerId}
        onChange={(e) => set('book', e.target.value)}
      >
        <option value="all">Every bookmaker</option>
        {bookList.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
      </select>

      <label className="sr-only" htmlFor="scope-sport">Sport</label>
      <select
        id="scope-sport"
        className="select"
        style={{ width: 'auto', minWidth: '130px', minHeight: '40px' }}
        value={scope.sportId}
        onChange={(e) => set('sport', e.target.value)}
      >
        <option value="all">Every sport</option>
        {SPORTS.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
      </select>
    </div>
  );
}
