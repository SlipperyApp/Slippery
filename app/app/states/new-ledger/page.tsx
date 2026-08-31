import type { Metadata } from 'next';
import Link from 'next/link';
import { Icon } from '@/components/Icon';
import { EmptyState } from '@/components/app/BetRow';

export const metadata: Metadata = {
  title: 'An empty ledger',
  description: 'The ledger before the first slip: the rows ghosted, with the action on top.',
};

export default function NewLedger() {
  return (
    <>
      <div className="spread" style={{ marginBottom: 'var(--s4)', flexWrap: 'wrap' }}>
        <h1>Ledger</h1>
        <Link href="/app/import" className="btn btn--primary btn--sm">
          <Icon name="plus" size={16} /> Add a bet
        </Link>
      </div>

      <div className="card" style={{ marginBottom: 'var(--s4)' }}>
        <div className="row row--wrap" style={{ gap: 'var(--s7)' }}>
          {[['Staked', '£0.00'], ['Returned', '£0.00'], ['Net', '+£0.00'], ['Return', '+0.0%'], ['Bets', '0']].map(([l, v]) => (
            <div key={l}><p className="label">{l}</p><p className="fig fig--s tnum dim">{v}</p></div>
          ))}
        </div>
      </div>

      <div className="card">
        <EmptyState
          title="Your first slip goes here, the moment you place it"
          action="Add a bet"
          href="/app/import"
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
                    <span className="brow__title" style={{ display: 'block' }}>{a}</span>
                    <span className="brow__sub">{b}</span>
                  </span>
                  <span className={`fig fig--s ${c.startsWith('+') ? 'pos' : 'neg'}`}>{c}</span>
                </li>
              ))}
            </ul>
          }
        />
      </div>

      <p className="small dim" style={{ marginTop: 'var(--s4)' }}>
        Capture at placement is the whole idea: a record written afterwards is a record of the bets
        you felt like writing down.
      </p>
    </>
  );
}
