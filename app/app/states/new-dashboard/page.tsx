import type { Metadata } from 'next';
import Link from 'next/link';
import { Icon } from '@/components/Icon';
import { EmptyState } from '@/components/app/BetRow';

export const metadata: Metadata = {
  title: 'A new dashboard',
  description: 'What the dashboard looks like before there is anything in it: the thing ghosted, with the action on top.',
};

const CHECKLIST = [
  { t: 'Link the Telegram bot', s: 'One code, once. Then a slip takes four seconds.', href: '/app/import/linked', done: false },
  { t: 'Log your first bet', s: 'Forward it, upload it or type it in.', href: '/app/import', done: false },
  { t: 'Set your unit', s: 'One unit is one normal bet for you.', href: '/app/settings', done: true },
  { t: 'Pick a theme', s: 'Eight, all dark.', href: '/app/settings', done: true },
  { t: 'Join a group', s: 'Ranked in units, never in pounds.', href: '/app/social/discover', done: false },
];

export default function NewDashboard() {
  const done = CHECKLIST.filter((c) => c.done).length;
  return (
    <>
      <h1>Dashboard</h1>
      <p className="muted" style={{ marginTop: 'var(--s2)' }}>
        Every module is here. They fill in as bets do.
      </p>

      <div className="card" style={{ marginTop: 'var(--s5)' }}>
        <div className="spread">
          <p className="card__title">Getting started</p>
          <span className="small dim tnum">{done} of {CHECKLIST.length}</span>
        </div>
        <div className="meter" style={{ marginTop: 'var(--s3)' }}>
          <span className="meter__fill" style={{ width: `${(done / CHECKLIST.length) * 100}%` }} />
        </div>
        <ul style={{ marginTop: 'var(--s4)' }}>
          {CHECKLIST.map((c) => (
            <li key={c.t} className="brow" style={{ gridTemplateColumns: '20px minmax(0,1fr) auto', gap: 'var(--s3)' }}>
              <Icon name={c.done ? 'check' : 'minus'} size={16} className={c.done ? 'pos' : 'dim'} />
              <span style={{ minWidth: 0 }}>
                <Link href={c.href} className="brow__title" style={{ textDecoration: 'none' }}>{c.t}</Link>
                <span className="brow__sub" style={{ display: 'block' }}>{c.s}</span>
              </span>
              {!c.done ? <Icon name="chevronRight" size={16} className="dim" /> : null}
            </li>
          ))}
        </ul>
      </div>

      <div className="grid" style={{ marginTop: 'var(--s4)' }}>
        <section className="card col-4 h-m">
          <p className="card__title">Net</p>
          <EmptyState
            title="Your first figure lands here"
            action="Add a bet"
            href="/app/import"
            ghost={<><p className="label">This month</p><p className="fig pos">+£1,240.00</p><p className="small dim">+49.60u on a £25.00 unit</p></>}
          />
        </section>

        <section className="card col-4 h-m">
          <p className="card__title">Running now</p>
          <EmptyState
            title="Nothing running yet"
            action="Forward a slip"
            href="/app/import/linked"
            ghost={
              <ul>
                {['Arsenal to win', 'Over 2.5 goals', 'State Man'].map((s) => (
                  <li key={s} className="brow"><span className="brow__title">{s}</span><span className="fig fig--s">£38.25</span></li>
                ))}
              </ul>
            }
          />
        </section>

        <section className="card col-4 h-m">
          <p className="card__title">This month</p>
          <EmptyState
            title="Days fill in as bets settle"
            action="Add a bet"
            href="/app/import"
            ghost={
              <div className="cal" aria-hidden="true">
                {Array.from({ length: 35 }).map((_, i) => (
                  <span key={i} className="cal__cell">
                    {i % 5 === 0 ? <span className="cal__fill" style={{ background: 'var(--pos)', opacity: 0.4 }} /> : null}
                  </span>
                ))}
              </div>
            }
          />
        </section>
      </div>

      <p className="small dim" style={{ marginTop: 'var(--s5)' }}>
        Nothing here says &ldquo;no bets yet&rdquo;. The module is shown for what it will be, with
        the one action that fills it on top.
      </p>
    </>
  );
}
