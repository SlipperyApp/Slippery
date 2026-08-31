import type { Metadata } from 'next';
import Link from 'next/link';
import { Icon } from '@/components/Icon';
import { EmptyState } from '@/components/app/BetRow';

export const metadata: Metadata = {
  title: 'No groups yet',
  description: 'Social before you have joined anything: the leaderboard ghosted, with the action on top.',
};

export default function NewSocial() {
  return (
    <>
      <div className="spread" style={{ marginBottom: 'var(--s4)', flexWrap: 'wrap' }}>
        <h1>Social</h1>
        <Link href="/app/social/discover" className="btn btn--ghost btn--sm">
          <Icon name="search" size={16} /> Find Slippers
        </Link>
      </div>

      <div className="grid">
        <section className="card col-8">
          <p className="card__title">Your groups</p>
          <EmptyState
            title="A group takes about a minute to start"
            action="Find a group"
            href="/app/social/discover"
            ghost={
              <ul>
                {[['Rowan', '+18.4u', 1], ['Priya', '+11.2u', 2], ['You', '+6.9u', 3], ['Dev', '-2.1u', 4]].map(([n, u, p]) => (
                  <li key={String(n)} className="brow" style={{ gridTemplateColumns: '24px 1fr auto' }}>
                    <span className="small dim tnum">{p}</span>
                    <span className="brow__title">{n}</span>
                    <span className={`fig fig--s ${String(u).startsWith('-') ? 'neg' : 'pos'}`}>{u}</span>
                  </li>
                ))}
              </ul>
            }
          />
        </section>

        <section className="card col-4">
          <p className="card__title">Why units</p>
          <p className="small muted" style={{ marginTop: 'var(--s3)' }}>
            A Slipper staking £5 and a Slipper staking £500 are directly comparable in units, and a
            bigger bankroll stops being a bigger score. Outside a group only units are visible,
            never stakes.
          </p>
          <div className="card__foot">
            <Link href="/social" className="btn btn--quiet btn--sm">How groups work</Link>
          </div>
        </section>
      </div>
    </>
  );
}
