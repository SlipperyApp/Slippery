import type { Metadata } from 'next';
import Link from 'next/link';
import { Icon } from '@/components/Icon';
import { getViewer } from '@/lib/data/session';
import { select, summarise, byMonth, DEFAULT_SCOPE } from '@/lib/data/analytics';
import { groupSummaries } from '@/lib/data/social';
import { SETTINGS_GROUPS } from '@/lib/data/settings';
import { money, units as fmtUnits, pct, count, initials, position as fmtPosition, zonedParts } from '@/lib/format';
import { isImported } from '@/lib/data/ledger-shape';

export const metadata: Metadata = {
  title: 'You',
  description: 'Your profile, your form, your division, your badges and your settings.',
};

/** "You" holds profile, form, division, badges and settings, because settings
 *  is rarely visited and does not earn a permanent slot of its own. */
export default async function You() {
  const { data, now, trial, source } = await getViewer();
  const { account, bets } = data;

  const all = summarise(select(bets, { ...DEFAULT_SCOPE, period: 'all' }, now));

  /*  The foot of the Form card and the last row of the Form card are the same
   *  month, so they come from the same call.
   *
   *  They did not. The list came from byMonth, which is a fold over SETTLED
   *  bets, and the foot came from summarise over the month scope, which counts
   *  everything in the period. September had three settled bets and one still
   *  running, so the row read "Sep 3 +£134.50" and the line under it read
   *  "+£134.50 from 4 bets": the same net attributed to a different number of
   *  bets, four inches apart. One of the two had to be a lie and it was the
   *  foot, because an open bet contributed nothing to that net. */
  const allMonths = byMonth(bets, account.timeZone);
  const months = allMonths.slice(-6);
  const p = zonedParts(now, account.timeZone);
  const thisMonth = allMonths.find((m) => m.key === `${p.year}-${String(p.month).padStart(2, '0')}`);
  /*  GROUPS AND SLIPPERS ARE THE EXAMPLE ACCOUNT'S, so they are read only
   *  when this IS the example account. A real account was previously shown
   *  three divisions it is not in and a position in each of them. */
  const groups = source === 'example' ? groupSummaries(now) : [];

  /*  EVERY BADGE IS COMPUTED OFF THIS ACCOUNT'S OWN BETS, AND NOTHING HERE
   *  COUNTS CONSECUTIVE DAYS.
   *
   *  Two defects met on this list. Four of the six badges were a literal
   *  `got: true`, so a brand new account with nothing in it was congratulated
   *  for an import it never ran and every bet type it had never placed: the
   *  product telling somebody about their own record and being wrong. And the
   *  first of them was a capture streak, thirty days of logging a slip on the
   *  day you placed it, drawn as earned and broadcast into other people's
   *  feed. That one cannot be held without placing a bet on thirty
   *  consecutive days, so it is a reward for volume, which the brief forbids.
   *
   *  So: every badge folds this account's own bets, and what they measure is
   *  COMPLETENESS rather than frequency. The share of your bets that came off
   *  a slip rises when you record better and cannot be moved by betting more,
   *  because betting more without capturing lowers it. */
  const slipBackedCount = bets.filter((b) => b.slipBacked).length;
  const slipBackedShare = bets.length > 0 ? slipBackedCount / bets.length : 0;
  const badges = [
    { t: 'Mostly slip backed', s: 'Three in four of your bets came off a slip rather than a keyboard', got: bets.length > 0 && slipBackedShare >= 0.75 },
    { t: 'Slip backed', s: 'Nine in ten of your bets came from a slip', got: bets.length > 0 && slipBackedShare >= 0.9 },
    { t: 'First import', s: 'Brought a history in from somewhere else', got: bets.some(isImported) },
    { t: 'A full year', s: 'Twelve months of records on Slippery', got: allMonths.length >= 12 },
    { t: 'Every bet type', s: 'Logged a single, a multiple and an each way', got: ['single', 'each_way'].every((sh) => bets.some((b) => b.shape === sh)) && bets.some((b) => b.legs.length > 1) },
    { t: 'Group founder', s: 'Started a group somebody else joined', got: groups.some((g) => g.youOwn && g.members > 1) },
  ];

  return (
    <>
      <h1>You</h1>

      <div className="grid" style={{ marginTop: 'var(--s4)' }}>
        <section className="card col-8">
          <div className="row" style={{ gap: 'var(--s4)', alignItems: 'flex-start' }}>
            {/*  An account that has not been named yet gets neither an empty
                 avatar nor a bare at sign. Both appeared the day a signed-in
                 account stopped being handed the example account's name, and
                 a card headed with nothing above "@" reads as a load
                 failure rather than as a profile waiting to be filled in. */}
            <span className="avatar avatar--lg" aria-hidden="true">
              {account.displayName ? initials(account.displayName) : ''}
            </span>
            <div className="grow" style={{ minWidth: 0 }}>
              <p className="card__title">{account.displayName || 'Your profile'}</p>
              {account.handle
                ? <p className="small dim mono">@{account.handle}</p>
                : <p className="small dim"><Link href="/app/settings?pane=account">Choose a name and a handle</Link></p>}
              <p className="small muted" style={{ marginTop: 'var(--s2)' }}>
                Unit {money(account.unitPence, account.currency)} · {account.currency} · week starts{' '}
                {account.weekStart === 1 ? 'Monday' : 'Sunday'}
              </p>
            </div>
            <Link href="/app/settings" className="btn btn--ghost btn--sm">
              <Icon name="settings" size={15} /> Settings
            </Link>
          </div>

          {/*  At the FOOT of the card, not under the name.
               The row this sits in takes the height of the form card beside
               it, which is six months of rows and a footnote, so the profile
               ended a screen-inch of content in and left two hundred and
               fifty pixels of empty card under it. margin-top:auto turns
               that hole into the space between who you are and what you have
               done, which is where it belongs. */}
          <div className="row row--wrap profile__figs">
            <div><p className="label">All time</p><p className={`fig fig--m ${all.netPence >= 0 ? 'pos' : 'neg'}`}>{money(all.netPence, account.currency, { sign: true })}</p></div>
            <div><p className="label">Units</p><p className="fig fig--m tnum">{fmtUnits(all.units, { sign: true })}</p></div>
            <div><p className="label">Return</p><p className={`fig fig--m ${all.roi >= 0 ? 'pos' : 'neg'}`}>{pct(all.roi, { sign: true })}</p></div>
            <div><p className="label">Bets</p><p className="fig fig--m tnum">{count(all.count)}</p></div>
          </div>
        </section>

        <section className="card col-4">
          {/*  "The last six months, by net" under a card titled Form, above
               six rows labelled Apr to Sep with a money figure on each: the
               months are on screen and only "by net" was carrying anything.
               It goes where every other module puts its caveat. */}
          <div className="card__head">
            <h2 className="card__title">Form</h2>
            <p className="card__note">Net, by month</p>
          </div>
          {months.length === 0 ? (
            <p className="small muted" style={{ marginTop: 'var(--s3)' }}>
              Nothing has settled yet, so there is no month to draw. The first settled bet puts a
              row here.
            </p>
          ) : null}
          <ul>
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
          {thisMonth ? (
            <p className="small dim card__foot">
              This month: {money(thisMonth.netPence, account.currency, { sign: true })} from{' '}
              {count(thisMonth.count)} settled.
            </p>
          ) : null}
        </section>

        <section className="card col-6">
          <h2 className="card__title">Divisions</h2>
          {groups.length ? (
            <ul style={{ marginTop: 'var(--s3)' }}>
              {groups.map((g) => (
                <li key={g.id} className="brow">
                  <span style={{ minWidth: 0 }}>
                    <Link href={`/app/social/group?id=${g.id}`} className="brow__title" style={{ textDecoration: 'none' }}>{g.name}</Link>
                    <span className="brow__sub">{g.division}</span>
                  </span>
                  <span className="pill">{fmtPosition(g.yourPosition, g.members)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="small muted" style={{ marginTop: 'var(--s3)' }}>
              You are not in a group yet. A division is a position inside one, so there is nothing
              to show here until you start or join one.{' '}
              <Link href="/app/social">Social</Link>.
            </p>
          )}
        </section>

        <section className="card col-6">
          <h2 className="card__title">Badges</h2>
          <ul style={{ marginTop: 'var(--s3)' }}>
            {badges.map((b) => (
              <li key={b.t} className={`brow${b.got ? '' : ' brow--faded'}`} style={{ gridTemplateColumns: '20px minmax(0,1fr)', gap: 'var(--s3)' }}>
                <Icon name={b.got ? 'check' : 'minus'} size={16} className={b.got ? 'readmark readmark--ok' : 'dim'} />
                <span>
                  <span className="brow__title">{b.t}</span>
                  <span className="brow__sub">{b.s}</span>
                </span>
              </li>
            ))}
          </ul>
          <p className="small dim card__foot">
            Every badge is for something you did in the app, never for winning a bet and never
            for betting more often.
          </p>
        </section>

        <section className="card col-8">
          <h2 className="card__title">Settings</h2>
          <ul style={{ marginTop: 'var(--s3)' }}>
            {SETTINGS_GROUPS.map((g) => (
              <li key={g.id} className="brow brow--field">
                <Icon name={g.icon} size={16} className="dim" />
                <span style={{ minWidth: 0 }}>
                  <Link href={`/app/settings?pane=${g.id}`} className="brow__title" style={{ textDecoration: 'none' }}>{g.label}</Link>
                  <span className="brow__sub">{g.blurb}</span>
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
