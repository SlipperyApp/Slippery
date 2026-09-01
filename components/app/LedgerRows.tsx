'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Icon } from '@/components/Icon';
import { BetRow, EmptyState } from './BetRow';
import { BetSheet } from './BetSheet';
import type { DemoBet } from '@/lib/data/demo';
import type { Currency } from '@/lib/domain/types';
import type { OddsFormat } from '@/lib/odds';
import { count } from '@/lib/format';

const PAGE = 25;

/** Cursor pagination, and facets whose counts agree with the rows.
 *
 *  The count line says "N of M shown" rather than leaving two numbers on
 *  screen to disagree with each other. */
export function LedgerRows({
  bets, facets, facetTotal, rowTotal, activeOutcome, search,
  currency, oddsFormat, showProfitIn,
}: {
  bets: DemoBet[];
  facets: { id: string; label: string; count: number }[];
  facetTotal: number;
  rowTotal: number;
  activeOutcome: string | null;
  search: string;
  currency: Currency;
  oddsFormat: OddsFormat;
  showProfitIn: 'currency' | 'units' | 'both';
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [cursor, setCursor] = useState(PAGE);
  const [open, setOpen] = useState<DemoBet | null>(null);
  const [q, setQ] = useState(search);

  const set = (key: string, value: string | null) => {
    const next = new URLSearchParams(params?.toString() ?? '');
    if (!value) next.delete(key); else next.set(key, value);
    const s = next.toString();
    setCursor(PAGE);
    router.replace(s ? `${pathname}?${s}` : pathname, { scroll: false });
  };

  const page = bets.slice(0, cursor);

  return (
    <>
      <form
        className="row"
        style={{ gap: 'var(--s2)', marginBottom: 'var(--s4)' }}
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

      <div className="row row--wrap" style={{ gap: 'var(--s2)', marginBottom: 'var(--s3)' }}>
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

      <p className="small dim" style={{ marginBottom: 'var(--s3)' }}>
        {/* One query behind both numbers, so these cannot disagree. */}
        Showing {count(page.length)} of {count(bets.length)}
        {bets.length !== rowTotal ? <> filtered from {count(rowTotal)}</> : null}. Facets sum to {count(facetTotal)}.
      </p>

      {page.length === 0 ? (
        <div className="card">
          <EmptyState
            title={search || activeOutcome ? 'Nothing matches that filter yet.' : 'Your first slip goes here.'}
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
        <div className="card">
          <ul>
            {page.map((b) => (
              <li key={b.id} style={{ listStyle: 'none' }}>
                <button
                  type="button"
                  onClick={() => setOpen(b)}
                  style={{ width: '100%', textAlign: 'left', cursor: 'pointer', display: 'block' }}
                  aria-label={`Open ${b.legs.length > 1 ? `${b.legs.length} fold` : b.selection}`}
                >
                  <ul style={{ pointerEvents: 'none' }}>
                    <BetRow
                      bet={b}
                      currency={currency}
                      oddsFormat={oddsFormat}
                      showUnits={showProfitIn === 'units'}
                    />
                  </ul>
                </button>
              </li>
            ))}
          </ul>

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
      )}

      {open ? (
        <BetSheet
          bet={open}
          currency={currency}
          oddsFormat={oddsFormat}
          onClose={() => setOpen(null)}
        />
      ) : null}
    </>
  );
}
