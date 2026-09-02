'use client';

import Link from 'next/link';
import { useRef, useState } from 'react';
import { Brand } from '@/components/Brand';
import { usePathname } from 'next/navigation';
import { Icon, type IconName } from '@/components/Icon';
import { SIDE_NAV, TAB_NAV, isActive } from '@/lib/nav';
import { money, plural, type Currency } from '@/lib/format';
import { timeZoneClock } from '@/lib/data/reference';
import { BalanceSwitch } from '@/components/app/BalanceSwitch';
import { AppMenu } from '@/components/app/AppMenu';

export type ShellChrome = {
  displayName: string;
  handle: string;
  /** The SELECTED balance, shown as a figure in the top bar. It is not a
   *  page, and it is one balance: the account's other balances have their
   *  own figures and nothing anywhere adds two of them. */
  balanceMinor: number;
  currency: Currency;
  /** Every balance, for the switcher. Name and currency only: the figure
   *  beside the name would be a second number in the chrome that nobody
   *  asked for, and the currency is the fact that matters when choosing. */
  balances: { id: string; name: string; currency: Currency }[];
  balanceId: string;
  /** The zone every day boundary on this account is computed in. The line
   *  under the greeting says which one, because a calendar that files a
   *  midnight kick off on the other day has to be answerable. */
  timeZone: string;
  /** Counters ride as badges on the row they belong to. One: the open bets
   *  on Ledger. Social had one too and it was the literal 3, which counted
   *  nothing and never cleared. */
  badges: { ledger?: number };
  /*  What needs the account holder, as opposed to what needs a football
      match. See lib/data/attention.ts for why there are two of these and
      not the prototype's three. */
  needs?: { resting: number; running: number; waiting: number; proposals: number; asks: number };
  /*  WHAT IS ON THE TABLE RIGHT NOW, in money, for the line under the
      greeting. The counts above say how many bets are open; this says what
      they are worth, which is the fact a bettor wants in front of them on
      every screen and which appeared on exactly one card on one route. It is
      never coloured: an exposure is neither a profit nor a loss, and the two
      result colours mean money that has been won or lost and nothing else. */
  atRiskMinor: number;
  openBets: number;
  /** Read only pauses new slips, imports and the bot. The ledger and export
   *  stay fully live. */
  readOnly?: boolean;
  demo?: boolean;
  /*  WHETHER THERE IS A SESSION TO END. The example account is a signed-OUT
      visitor, so offering it a sign out would be a control that logs nobody
      out of anything. Asked as its own fact rather than inferred from
      `demo`, which has two values where the viewer has three. */
  signedIn?: boolean;
};

/** The jobs, as rows of the rail.
 *
 *  A place is where you go; a job is something waiting on YOU rather than on
 *  a football match. The two groups are separated by a hairline in the rail
 *  and every one of these is a filter on the ledger, so the number goes
 *  somewhere. None of them draws when its count is zero: a permanent
 *  "Waiting on a result 0" is furniture.
 *
 *  THEY POINT AT THE LEDGER, NOT AT /app/review. There is no app/app/review
 *  directory and the route 404s, and both of the confirm rows pointed at it:
 *  latent only because attention() reports zero of each until the ingestion
 *  branch lands. When the review queue is real, these hrefs are what change. */
const JOBS: {
  key: 'running' | 'resting' | 'waiting' | 'proposals' | 'asks';
  href: string;
  icon: IconName;
  label: string;
  warn?: boolean;
}[] = [
  { key: 'running', href: '/app/ledger?needs=running', icon: 'clock', label: 'Bets running' },
  { key: 'resting', href: '/app/ledger?needs=resting', icon: 'calendar', label: 'Not started yet' },
  { key: 'waiting', href: '/app/ledger?needs=waiting', icon: 'alert', label: 'Waiting on a result', warn: true },
  { key: 'proposals', href: '/app/ledger?needs=waiting', icon: 'check', label: 'Settlements to confirm' },
  { key: 'asks', href: '/app/ledger?needs=waiting', icon: 'help', label: 'Questions to answer', warn: true },
];

export function AppShell({ chrome, children }: { chrome: ShellChrome; children: React.ReactNode }) {
  const pathname = usePathname() || '/app';
  /*  The phone's menu. It holds what the rail holds and the tab bar cannot,
      and it is the product's only glass surface: see components/app/AppMenu.tsx
      for what that costs and why it is one element. */
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const here = chrome.balances.find((b) => b.id === chrome.balanceId);
  const jobs = chrome.needs
    ? JOBS.map((j) => ({ ...j, n: chrome.needs![j.key] })).filter((j) => j.n > 0)
    : [];

  /*  THE NAME, NOT THE HANDLE. An account that has finished its profile is
      greeted by the name it gave; one that has not falls back to the handle
      rather than to a bare "Hello," with a comma hanging off it. Both were
      drawn from empty strings the moment a signed-in account stopped being
      handed the example account's name. */
  const name = chrome.displayName || (chrome.handle ? `@${chrome.handle}` : '');
  const initial = (chrome.displayName || chrome.handle || '?').slice(0, 1);

  /*  ONE SENTENCE, AND IT IS THE ONE THAT IS TRUE ON THIS ROUTE.
      What is at risk is the money version of the job counts in the rail and
      lived on one card on one route. It is not printed on the ledger, which
      opens with the same figure at four times the size: one number printed
      twice on one screen is a number somebody has to check against itself.
      The zone is here because a calendar that files a midnight kick off on
      the other day has to be answerable from wherever you are standing. */
  const zone = `Times in ${timeZoneClock(chrome.timeZone)}`;
  const sub = chrome.readOnly
    ? 'Read only. Ledger and export stay live.'
    : chrome.openBets > 0 && !pathname.startsWith('/app/ledger')
      ? `${money(chrome.atRiskMinor, chrome.currency)} at risk over ${plural(chrome.openBets, 'open bet')} in ${here?.name ?? 'this balance'}. ${zone}.`
      : `${zone}.`;

  return (
    <div className="shell page">
      {/*  THE RAIL IS ICONS ONLY, AND EVERY ONE OF THEM CARRIES A NAME.
           It was 232 pixels of labelled rows with five hundred pixels of
           nothing under them on every route, which is a fifth of a 1440
           screen spent on four words. Icon only it is 72, and the width goes
           to the modules.

           An icon with no accessible name is a link a screen reader reads as
           "link" and nothing else, so every one of these gets an aria-label
           and the badge count is inside it: "Ledger, 3 open bets" rather
           than "link, 3". */}
      <aside className="rail">
        <Brand size={30} href="/app" word={false} className="brand rail__brand" label="Slippery, dashboard" />

        <nav className="rail__nav" aria-label="Sections">
          {SIDE_NAV.map((item) => {
            const badge = (chrome.badges as Record<string, number | undefined>)[item.href.split('/')[2] ?? ''];
            return (
              <Link
                key={item.href}
                href={item.href}
                className="rail__link"
                aria-current={isActive(pathname, item) ? 'page' : undefined}
                aria-label={badge ? `${item.label}, ${plural(badge, 'open bet')}` : item.label}
              >
                <Icon name={item.icon} size={20} />
                {badge ? <span className="rail__badge" aria-hidden="true">{badge}</span> : null}
              </Link>
            );
          })}
        </nav>

        {jobs.length > 0 ? (
          <nav className="rail__nav rail__nav--jobs" aria-label="Needs you">
            {jobs.map((j) => (
              <Link
                key={j.label}
                href={j.href}
                className={`rail__link${j.warn ? ' rail__link--warn' : ''}`}
                aria-label={`${j.label}, ${j.n}`}
              >
                <Icon name={j.icon} size={20} />
                <span className={`rail__badge${j.warn ? ' rail__badge--warn' : ''}`} aria-hidden="true">{j.n}</span>
              </Link>
            ))}
          </nav>
        ) : null}

        {/*  THE FOOT: the two chrome actions and then who you are, pinned to
             the bottom.

             SIGNING OUT WAS NOT REACHABLE FROM THE APP AT ALL. /api/auth/logout
             existed and nothing in the product posted to it, so the only way
             out of an account was to clear a cookie by hand. It is a form and
             not a link because it changes server state, and a GET that ends a
             session is one a browser is free to prefetch. */}
        <div className="rail__foot">
          <Link
            href="/app/settings"
            className="rail__link"
            aria-current={pathname.startsWith('/app/settings') ? 'page' : undefined}
            aria-label="Settings"
          >
            <Icon name="settings" size={20} />
          </Link>

          {chrome.signedIn ? (
            <form action="/api/auth/logout" method="post" className="rail__out">
              <button type="submit" className="rail__link" aria-label="Sign out">
                <Icon name="signout" size={20} />
              </button>
            </form>
          ) : null}

          <Link
            href="/app/you"
            className="rail__me"
            aria-current={pathname.startsWith('/app/you') ? 'page' : undefined}
            aria-label={name ? `Your account, ${name}` : 'Your account'}
          >
            <span className="avatar" aria-hidden="true">{initial}</span>
          </Link>
        </div>
      </aside>

      <div style={{ minWidth: 0 }}>
        {/*  THE GREETING, THE SEARCH AND THE ACTIONS.
             The bar carried a mark, an avatar, a handle and a balance box,
             which is four ways of saying whose account this is and no way of
             finding anything in it. */}
        <header className="topbar">
          {/*  The mark only where there is no rail to carry it. Under 1000 the
               rail is display:none and the phone would otherwise have no way
               back to the dashboard from the top of the screen. */}
          <Brand size={30} href="/app" word={false} className="brand topbar__mark" label="Slippery, dashboard" />

          <div className="topbar__hello">
            <p className="topbar__greet">
              {/*  The name is its own box so that IT truncates and the pill
                   beside it does not: inside one line box at 320 the pill
                   was cut to "EXAN", and the pill is the sentence saying the
                   ledger below is not yours. */}
              {/*  The greeting drops its first word on a phone, and it is the
                   menu button beside it that pays for that: measured at 390,
                   "Hello, Tester" needs 93px and had exactly 93, so adding a
                   38px control on the right truncated it to "Hello...". The
                   name is the half worth keeping. */}
              <span className="topbar__name">
                {name ? <><span className="topbar__hi">Hello, </span>{name}</> : 'Hello'}
              </span>
              {chrome.demo ? <span className="pill topbar__pill">Example</span> : null}
            </p>
            <p className="topbar__sub small dim">{sub}</p>
          </div>

          {/*  A REAL SEARCH OR NONE AT ALL.
               It is a GET form aimed at the ledger's own ?q=, which is the
               filter that already exists and already draws its own box
               carrying whatever was typed here. Nothing about this field is
               decoration: with scripting off it still submits, and the page
               it lands on is filtered by the same parameter. The reference
               this layout follows draws a search field on a dashboard with
               nothing behind it, and a control that does nothing is worse
               than no control. */}
          <form className="topbar__search" action="/app/ledger" method="get" role="search">
            <label className="sr-only" htmlFor="shell-q">Search your bets</label>
            <input
              id="shell-q"
              name="q"
              type="search"
              className="topbar__q"
              placeholder="Search your bets"
              autoComplete="off"
            />
            <button type="submit" className="roundbtn topbar__go" aria-label="Search your bets">
              <Icon name="search" size={18} />
            </button>
          </form>

          <div className="topbar__right">
            <BalanceSwitch
              balances={chrome.balances}
              current={chrome.balanceId}
              balanceMinor={chrome.balanceMinor}
              currency={chrome.currency}
            />
            {/*  The one action the product is for, as the one accent shape in
                 the bar. Not on a phone: the tab bar's raised plus is the
                 same link, and two of them a thumb apart is the defect
                 nav.ts records for Import. */}
            <Link href="/app/import" className="roundbtn roundbtn--go topbar__add" aria-label="Add a bet">
              <Icon name="plus" size={20} strokeWidth={2} />
            </Link>

            {/*  And the other way round: only on a phone, because everything
                 behind it is a row of the rail. */}
            <button
              type="button"
              ref={menuButton}
              className="roundbtn topbar__menu"
              aria-label="Menu"
              aria-haspopup="dialog"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen(true)}
            >
              <Icon name="menu" size={20} />
            </button>
          </div>
        </header>

        {/*  THE ONE SCREEN IN THIS PRODUCT THAT IS SIZED TO THE WINDOW.
             Everything else is a page you scroll, and the modifier says which
             is which HERE rather than in a :has() selector, so the rule is
             visible to anybody reading either file. The dashboard's grid
             takes whatever is left after the banners above it, which is why a
             trial banner or the example note shortens the modules instead of
             pushing the last one off the bottom. */}
        <main className={`main${pathname === '/app' ? ' main--fit' : ''}`} id="main">{children}</main>
      </div>

      <AppMenu
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        name={name}
        handle={chrome.handle}
        sub={sub}
        jobs={jobs.map((j) => ({ key: j.key, href: j.href, icon: j.icon, label: j.label, n: j.n, warn: j.warn }))}
        signedIn={Boolean(chrome.signedIn)}
        returnFocusTo={menuButton}
      />

      <nav className="bottombar" aria-label="Sections">
        {TAB_NAV.slice(0, 2).map((item) => (
          <Link key={item.href} href={item.href} className="tab" aria-current={isActive(pathname, item) ? 'page' : undefined}>
            <Icon name={item.icon} size={21} className="tab__icon" />
            <span>{item.label}</span>
          </Link>
        ))}
        <div className="tab tab--add">
          <Link href="/app/import" className="tab--add__btn" aria-label="Add a bet">
            <Icon name="plus" size={24} strokeWidth={2} />
          </Link>
        </div>
        {TAB_NAV.slice(2).map((item) => (
          <Link key={item.href} href={item.href} className="tab" aria-current={isActive(pathname, item) ? 'page' : undefined}>
            <Icon name={item.icon} size={21} className="tab__icon" />
            <span>{item.label}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
