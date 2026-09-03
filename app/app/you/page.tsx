import type { Metadata } from 'next';
import Link from 'next/link';
import { Icon } from '@/components/Icon';
import { getViewer } from '@/lib/data/session';
import { Figure } from '@/components/app/Module';
import { select, summarise, byMonth, DEFAULT_SCOPE } from '@/lib/data/analytics';
import { TRIAL_DAYS } from '@/lib/domain/trial';
import { money, units as fmtUnits, pct, count, initials } from '@/lib/format';
import { isImported } from '@/lib/data/ledger-shape';

export const metadata: Metadata = {
  title: 'You',
  description: 'Who you are, what your record says all time, your badges and your plan.',
};

/** You holds identity, the lifetime figures, the badges and the plan.
 *
 *  FORM IS GONE. It was seven rows of month, bet count and net, which is the
 *  dashboard's own six period chart drawn as a list, one screen away, at a
 *  granularity the dashboard's selector can produce and this could not
 *  change. Two places to read a month is one place too many and this was the
 *  one that could not be scoped.
 *
 *  DIVISIONS IS GONE. It listed the groups the account is in with a position
 *  in each, which is the Your groups card on Social, row for row, including
 *  the same position pill. Social owns the groups.
 *
 *  THE SETTINGS LIST WAS ALREADY GONE and stays gone: it was the six rows of
 *  /app/settings printed a second time, 640 pixels of card, beside a rail
 *  that carries a Settings row.
 *
 *  THE BADGES ARE A ROW OF CHIPS. Six rows with a title, a sentence and a
 *  tick came to 360 pixels to say that four of six are held. The name is the
 *  badge and the sentence under each was a restatement of it. */
export default async function You() {
  const { data, now, trial } = await getViewer();
  const { account, bets } = data;

  const all = summarise(select(bets, { ...DEFAULT_SCOPE, period: 'all' }, now));
  const allMonths = byMonth(bets, account.timeZone);

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
    { t: 'Mostly slip backed', got: bets.length > 0 && slipBackedShare >= 0.75 },
    { t: 'Slip backed', got: bets.length > 0 && slipBackedShare >= 0.9 },
    { t: 'First import', got: bets.some(isImported) },
    { t: 'A full year', got: allMonths.length >= 12 },
    { t: 'Every bet type', got: ['single', 'each_way'].every((sh) => bets.some((b) => b.shape === sh)) && bets.some((b) => b.legs.length > 1) },
  ];

  return (
    /*  A COLUMN, NOT THE WHOLE WIDTH. What is left on this page after Form,
        Divisions and the settings list is a profile, four lifetime figures, a
        row of badges and a plan, which is about five hundred pixels of
        content. Spread across 1920 that is two cards against the left edge
        with a void beside and under them; the same content in a centred
        column reads as a page rather than as the top of one. */
    <div className="column column--wide">
      <div className="spread lgr__top">
        <h1>You</h1>
        <div className="row row--wrap" style={{ gap: 'var(--s3)' }}>
          <Link href="/app/settings" className="btn btn--quiet btn--sm">
            <Icon name="settings" size={16} /> Settings
          </Link>
          <form action="/api/auth/logout" method="post">
            <button type="submit" className="btn btn--ghost btn--sm">Sign out</button>
          </form>
        </div>
      </div>

      <div className="grid">
        <section className="card col-7">
          <div className="row" style={{ gap: 'var(--s4)', alignItems: 'flex-start' }}>
            {/*  An account that has not been named yet gets neither an empty
                 avatar nor a bare at sign. Both appeared the day a signed-in
                 account stopped being handed the example account's name, and
                 a card headed with nothing above "@" reads as a load failure
                 rather than as a profile waiting to be filled in. */}
            <span className="avatar avatar--lg" aria-hidden="true">
              {account.displayName ? initials(account.displayName) : ''}
            </span>
            <div className="grow" style={{ minWidth: 0 }}>
              <p className="card__title">{account.displayName || 'Your profile'}</p>
              {/*  ONE LINE, AND IT TRUNCATES RATHER THAN WRAPPING. At 320 the
                   name block has about 90 pixels beside the avatar, and
                   "@tester123" is 80 of them in the mono face: the handle
                   broke after the ninth character and printed the "3" on its
                   own line, which reads as a rendering fault rather than as a
                   name that did not fit. */}
              {account.handle
                ? <p className="small dim mono nowrap ellip">@{account.handle}</p>
                : <p className="small dim"><Link href="/app/settings?pane=account">Choose a name and a handle</Link></p>}
              <p className="small muted" style={{ marginTop: 'var(--s2)' }}>
                Unit {money(account.unitPence, account.currency)} · {account.currency} · week starts{' '}
                {account.weekStart === 1 ? 'Monday' : 'Sunday'}
              </p>
            </div>
          </div>

          {/*  THE LIFETIME FIGURES, and they are the only figures on this
               page. Everything scoped to a period is on the dashboard, under
               a selector that can change it. */}
          <div className="figstrip profile__figs" style={{ ['--figs' as string]: 4 }}>
            <div><p className="label">All time</p><p className={`fig fig--m ${all.netPence >= 0 ? 'pos' : 'neg'}`}>{money(all.netPence, account.currency, { sign: true })}</p></div>
            <div><p className="label">Units</p><p className="fig fig--m tnum">{fmtUnits(all.units, { sign: true })}</p></div>
            <div><p className="label">Return</p><p className={`fig fig--m ${all.roi >= 0 ? 'pos' : 'neg'}`}>{pct(all.roi, { sign: true })}</p></div>
            <div><p className="label">Bets</p><p className="fig fig--m tnum">{count(all.count)}</p></div>
          </div>

          {/*  BADGES AS A ROW. A held badge is a filled chip and one that is
               not is an outline, so which is which is the shape rather than a
               tick beside a sentence. Nothing here is for winning a bet or
               for betting more often, which is why none of them counts
               anything you have to place. */}
          <div className="card__foot">
            <p className="label">Badges</p>
            <ul className="badges">
              {badges.map((b) => (
                <li key={b.t} className={`badge${b.got ? ' badge--on' : ''}`}>
                  <Icon name={b.got ? 'check' : 'minus'} size={13} />
                  {b.t}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="card col-5" aria-labelledby="you-plan">
          <div className="card__head">
            <h2 className="card__title" id="you-plan">Plan</h2>
            <p className="card__note">{trial.active ? 'Free trial' : 'Trial over'}</p>
          </div>

          {/*  THE TWO HALVES OF THE TRIAL, across the card. It is fourteen
               days or thirty five slips, whichever runs out first, and they
               fail differently, so each says where it stands rather than the
               page printing the closer of the two in a sentence and the
               figures under it saying the same thing twice. */}
          <div className="figstrip" style={{ ['--figs' as string]: 3, marginTop: 'var(--s4)' }}>
            <Figure
              size="md"
              label="Days left"
              value={count(trial.daysLeft)}
              sub={`Of the ${TRIAL_DAYS} day trial`}
            />
            <Figure
              size="md"
              label="Slips left"
              value={count(trial.slipsLeft)}
              sub={`${count(trial.slipsUsed)} of ${count(trial.slipsAllowed)} used`}
            />
            <Figure
              size="md"
              label="After the trial"
              value="£3.49 a month"
              sub="Or £29.99 a year"
            />
          </div>

          <div className="card__foot row row--wrap" style={{ gap: 'var(--s2)' }}>
            <Link href="/app/settings/plan" className="btn btn--primary btn--sm">Plans</Link>
            <Link href="/app/settings/referrals" className="btn btn--ghost btn--sm">Referrals</Link>
          </div>
        </section>
      </div>
    </div>
  );
}
