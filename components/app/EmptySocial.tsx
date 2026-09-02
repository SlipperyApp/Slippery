import Link from 'next/link';
import { Icon } from '@/components/Icon';
import { EmptyState } from '@/components/app/BetRow';

/** Social before you have joined anything.
 *
 *  THE GROUPS, THE LEAGUE AND THE FEED ARE THE EXAMPLE ACCOUNT'S. Every
 *  figure on the social screens comes out of lib/data/social.ts, which folds
 *  the example account and the invented Slippers around it. That is the right
 *  thing to show a signed-out visitor on the marketing site and it is not a
 *  signed-in account's social graph, so a signed-in account is shown this
 *  instead of being placed first in a league of 385 bets it never placed.
 *
 *  One component, rendered by the real hub and by the state page under
 *  /app/states, so the two cannot drift. */
export function EmptySocial({ title = 'Social', note }: { title?: string; note?: string }) {
  return (
    <>
      <div className="spread" style={{ marginBottom: 'var(--gap-block)', flexWrap: 'wrap' }}>
        <h1>{title}</h1>
        <Link href="/app/social/discover" className="btn btn--ghost btn--sm">
          <Icon name="search" size={16} /> Find Slippers
        </Link>
      </div>

      {note ? <p className="muted" style={{ marginBottom: 'var(--gap-block)', maxWidth: '62ch' }}>{note}</p> : null}

      <div className="grid">
        <section className="card col-8">
          <p className="card__title">Your groups</p>
          <EmptyState
            title="A group takes about a minute to start"
            action="Start a group"
            href="/app/social/group/new"
            secondary={{ label: 'Find one instead', href: '/app/social/discover' }}
            note="The table behind this is an example month."
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
            A Slipper staking £5 and a Slipper staking £500 are directly comparable in units.
          </p>
          <div className="card__foot">
            <Link href="/social" className="btn btn--quiet btn--sm">How groups work</Link>
          </div>
        </section>
      </div>
    </>
  );
}

/** The sentence every social screen prints to a signed-in account, because
 *  the alternative is a stranger's league table with no label on it. */
export const SOCIAL_EXAMPLE_NOTE =
  'Groups and leagues are the example account’s. Yours appear here once you have started or joined a group.';
