import type { Metadata } from 'next';
import Link from 'next/link';
import { Icon } from '@/components/Icon';
import { getViewer } from '@/lib/data/session';
import { select, summarise, byMonth, DEFAULT_SCOPE } from '@/lib/data/analytics';
import { groupSummaries, slippers } from '@/lib/data/social';
import { SETTINGS_GROUPS } from '@/lib/data/settings';
import { money, units as fmtUnits, pct, count, initials, position as fmtPosition } from '@/lib/format';

export const metadata: Metadata = {
  title: 'You',
  description: 'Your profile, your form, your division, your badges and your settings.',
};

/** "You" holds profile, form, division, badges and settings, because settings
 *  is rarely visited and does not earn a permanent slot of its own. */
export default async function You() {
  const { data, now, trial } = await getViewer();
  const { account, bets } = data;

  const all = summarise(select(bets, { ...DEFAULT_SCOPE, period: 'all' }, now));
  const month = summarise(select(bets, { ...DEFAULT_SCOPE, period: 'month' }, now));
  const months = byMonth(bets).slice(-6);
  const groups = groupSummaries(now);
  const me = slippers(now).find((p) => p.handle === account.handle);

  const badges = [
    { t: 'Capture streak', s: '30 days of logging a slip on the day you placed it', got: true },
    { t: 'Slip backed', s: 'Nine in ten of your bets came from a slip', got: (me?.slipBackedPct ?? 0) >= 90 },
    { t: 'First import', s: 'Brought a history in from somewhere else', got: true },
    { t: 'A full year', s: 'Twelve months of records on Slippery', got: false },
    { t: 'Every bet type', s: 'Logged a single, a multiple, an each way and a permed bet', got: true },
    { t: 'Group founder', s: 'Started a group somebody else joined', got: false },
  ];

  return (
    <>
      <h1>You</h1>

      <div className="grid" style={{ marginTop: 'var(--s4)' }}>
        <section className="card col-8">
          <div className="row" style={{ gap: 'var(--s4)', alignItems: 'flex-start' }}>
            <span className="avatar avatar--lg" aria-hidden="true">{initials(account.displayName)}</span>
            <div className="grow" style={{ minWidth: 0 }}>
              <p className="card__title">{account.displayName}</p>
              <p className="small dim mono">@{account.handle}</p>
              <p className="small muted" style={{ marginTop: 'var(--s2)' }}>
                Unit {money(account.unitPence, account.currency)} · {account.currency} · week starts{' '}
                {account.weekStart === 1 ? 'Monday' : 'Sunday'}
              </p>
            </div>
            <Link href="/app/settings" className="btn btn--ghost btn--sm">
              <Icon name="settings" size={15} /> Settings
            </Link>
          </div>

          <div className="row row--wrap" style={{ gap: 'var(--s7)', marginTop: 'var(--s6)' }}>
            <div><p className="label">All time</p><p className={`fig fig--m ${all.netPence >= 0 ? 'pos' : 'neg'}`}>{money(all.netPence, account.currency, { sign: true })}</p></div>
            <div><p className="label">Units</p><p className="fig fig--m tnum">{fmtUnits(all.units, { sign: true })}</p></div>
            <div><p className="label">Return</p><p className={`fig fig--m ${all.roi >= 0 ? 'pos' : 'neg'}`}>{pct(all.roi, { sign: true })}</p></div>
            <div><p className="label">Bets</p><p className="fig fig--m tnum">{count(all.count)}</p></div>
          </div>
        </section>

        <section className="card col-4">
          <h2 className="card__title">Form</h2>
          <p className="small muted" style={{ marginTop: 'var(--s2)' }}>The last six months, by net.</p>
          <ul style={{ marginTop: 'var(--s3)' }}>
            {months.map((m) => (
              <li key={m.key} className="brow">
                <span className="brow__title">{m.label}</span>
                <span className="row" style={{ gap: 'var(--s3)' }}>
                  <span className="small dim tnum">{m.count}</span>
                  <span className={`fig fig--s tnum ${m.netPence >= 0 ? 'pos' : 'neg'}`}>
                    {money(m.netPence, account.currency, { sign: true })}
                  </span>
                </span>
              </li>
            ))}
          </ul>
          <p className="small dim card__foot">
            This month: {money(month.netPence, account.currency, { sign: true })} from {count(month.count)} bets.
          </p>
        </section>

        <section className="card col-6">
          <h2 className="card__title">Divisions</h2>
          <ul style={{ marginTop: 'var(--s3)' }}>
            {groups.map((g) => (
              <li key={g.id} className="brow">
                <span style={{ minWidth: 0 }}>
                  <Link href={`/app/social/group?id=${g.id}`} className="brow__title" style={{ textDecoration: 'none' }}>{g.name}</Link>
                  <span className="brow__sub" style={{ display: 'block' }}>{g.division}</span>
                </span>
                <span className="pill">{fmtPosition(g.yourPosition, g.members)}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="card col-6">
          <h2 className="card__title">Badges</h2>
          <ul style={{ marginTop: 'var(--s3)' }}>
            {badges.map((b) => (
              <li key={b.t} className={`brow${b.got ? '' : ' brow--faded'}`} style={{ gridTemplateColumns: '20px minmax(0,1fr)', gap: 'var(--s3)' }}>
                <Icon name={b.got ? 'check' : 'minus'} size={16} className={b.got ? 'readmark readmark--ok' : 'dim'} />
                <span>
                  <span className="brow__title" style={{ display: 'block' }}>{b.t}</span>
                  <span className="brow__sub">{b.s}</span>
                </span>
              </li>
            ))}
          </ul>
          <p className="small dim card__foot">
            Every badge is for something you did, never for winning a bet.
          </p>
        </section>

        <section className="card col-8">
          <h2 className="card__title">Settings</h2>
          <ul style={{ marginTop: 'var(--s3)' }}>
            {SETTINGS_GROUPS.map((g) => (
              <li key={g.id} className="brow" style={{ gridTemplateColumns: '20px minmax(0,1fr) auto', gap: 'var(--s3)' }}>
                <Icon name={g.icon} size={16} className="dim" />
                <span style={{ minWidth: 0 }}>
                  <Link href="/app/settings" className="brow__title" style={{ textDecoration: 'none' }}>{g.label}</Link>
                  <span className="brow__sub" style={{ display: 'block' }}>{g.blurb}</span>
                </span>
                <Icon name="chevronRight" size={16} className="dim" />
              </li>
            ))}
          </ul>
        </section>

        <section className="card col-4">
          <h2 className="card__title">Plan</h2>
          <p className="fig fig--m" style={{ marginTop: 'var(--s3)' }}>
            {trial.active ? 'Free trial' : 'Trial over'}
          </p>
          <p className="small muted" style={{ marginTop: 'var(--s2)' }}>{trial.message}</p>
          <div className="card__foot row row--wrap" style={{ gap: 'var(--s2)' }}>
            <Link href="/app/settings/plan" className="btn btn--primary btn--sm">Plans</Link>
            <Link href="/app/settings/referrals" className="btn btn--ghost btn--sm">Referrals</Link>
            <form action="/api/auth/logout" method="post">
              <button type="submit" className="btn btn--quiet btn--sm">Sign out</button>
            </form>
          </div>
        </section>
      </div>
    </>
  );
}
