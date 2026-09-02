import Link from 'next/link';
import { Icon } from '@/components/Icon';
import { EmptyState } from '@/components/app/BetRow';
import { money, type Currency } from '@/lib/format';

/** The ledger before the first slip.
 *
 *  ONE COMPONENT, TWO CALLERS, for the reason given on EmptyDashboard: the
 *  screen a new account is shown and the screen under /app/states have to be
 *  the same screen or one of them is fiction.
 *
 *  THE FIVE FIGURES ARE REAL AND THEY ARE ZERO. That is the sentence under
 *  them, and it is the whole difference between this and what shipped before
 *  it, which was somebody else's £2,631.37 with the word Example taken off
 *  the top. The rows behind the glass are ghosts and say so. */
export function EmptyLedger({ reason, currency = 'GBP' }: { reason: string; currency?: Currency }) {
  const zero = money(0, currency);
  return (
    <>
      <div className="spread" style={{ marginBottom: 'var(--gap-block)', flexWrap: 'wrap' }}>
        <h1>Ledger</h1>
        <Link href="/app/import" className="btn btn--primary btn--sm">
          <Icon name="plus" size={16} /> Add a bet
        </Link>
      </div>

      <p className="muted" style={{ marginBottom: 'var(--gap-block)', maxWidth: '62ch' }}>{reason}</p>

      <div className="card" style={{ marginBottom: 'var(--gap-block)' }}>
        <div className="row row--wrap" style={{ gap: 'var(--s7)' }}>
          {[['Staked', zero], ['Returned', zero], ['Net', money(0, currency, { sign: true })], ['Return', '+0.0%'], ['Bets', '0']].map(([l, v]) => (
            <div key={l}><p className="label">{l}</p><p className="fig fig--s tnum dim">{v}</p></div>
          ))}
        </div>
      </div>

      <div className="card">
        <EmptyState
          title="Your first slip goes here, the moment you place it"
          action="Add a bet"
          href="/app/import"
          secondary={{ label: 'Import a history', href: '/app/import/history' }}
          note="The rows behind this are an example. Your figures above are real, and they are zero."
          ghost={
            <ul>
              {[
                ['Arsenal to win', 'Arsenal v Brentford · Match result', '+£38.25'],
                ['4 fold', 'Napoli / Inter / Celtic / Leeds', '-£25.00'],
                ['State Man', '15:05 Leopardstown · Win', '+£112.50'],
                ['Over 2.25 goals', 'Real Sociedad v Girona', '-£12.50'],
              ].map(([a, b, c]) => (
                <li key={a} className="brow">
                  <span>
                    <span className="brow__title">{a}</span>
                    <span className="brow__sub">{b}</span>
                  </span>
                  <span className={`fig fig--s ${c.startsWith('+') ? 'pos' : 'neg'}`}>{c}</span>
                </li>
              ))}
            </ul>
          }
        />
      </div>
    </>
  );
}
