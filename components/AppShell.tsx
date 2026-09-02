'use client';

import Link from 'next/link';
import { Brand } from '@/components/Brand';
import { usePathname } from 'next/navigation';
import { Icon } from '@/components/Icon';
import { SIDE_NAV, TAB_NAV, isActive } from '@/lib/nav';
import { type Currency } from '@/lib/format';
import { timeZoneClock } from '@/lib/data/reference';
import { BalanceSwitch } from '@/components/app/BalanceSwitch';

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
   *  under the sidebar says which one, because a calendar that files a
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
  /** Read only pauses new slips, imports and the bot. The ledger and export
   *  stay fully live. */
  readOnly?: boolean;
  demo?: boolean;
};

export function AppShell({ chrome, children }: { chrome: ShellChrome; children: React.ReactNode }) {
  const pathname = usePathname() || '/app';

  return (
    <div className="shell page">
      <aside className="side">
        <Brand size={40} />

        <Link href="/app/import" className="btn btn--primary btn--wide">
          <Icon name="plus" size={18} />
          Add a bet
        </Link>

        <nav className="side__nav" aria-label="Sections">
          {SIDE_NAV.map((item) => {
            const badge = (chrome.badges as Record<string, number | undefined>)[item.href.split('/')[2] ?? ''];
            return (
              <Link
                key={item.href}
                href={item.href}
                className="navrow"
                aria-current={isActive(pathname, item) ? 'page' : undefined}
              >
                <Icon name={item.icon} size={18} className="navrow__icon" />
                <span>{item.label}</span>
                {badge ? (
                  <span className="navrow__badge">
                    {badge}
                    <span className="sr-only"> items</span>
                  </span>
                ) : null}
              </Link>
            );
          })}
        </nav>

        {/*  NEEDS YOU.
             The five rows above are places; these are jobs. A tracker's
             whole value is telling you which of your bets is waiting on YOU
             rather than on a football match, and that question could not be
             answered from anywhere in this app: the ledger had a count of
             open bets and no way to see which of them had finished hours ago
             and quietly failed to grade.

             Each row is a filter on the ledger, so the number goes
             somewhere. The group only appears when there is something in it:
             a permanent "Waiting on a result 0" is furniture. */}
        {chrome.needs && (chrome.needs.resting > 0 || chrome.needs.running > 0
          || chrome.needs.waiting > 0 || chrome.needs.proposals > 0 || chrome.needs.asks > 0) ? (
          <nav className="side__group" aria-label="Needs you">
            <p className="side__grouph label">Needs you</p>
            {chrome.needs.running > 0 ? (
              <Link href="/app/ledger?needs=running" className="navrow">
                <Icon name="clock" size={18} className="navrow__icon" />
                <span>Bets running</span>
                <span className="navrow__badge">{chrome.needs.running}<span className="sr-only"> bets</span></span>
              </Link>
            ) : null}
            {/*  Resting is its own row because it was hiding inside Running,
                 and a slip sent on Thursday for a Saturday kick off is not
                 running. It sits under it: nothing is happening to it yet. */}
            {chrome.needs.resting > 0 ? (
              <Link href="/app/ledger?needs=resting" className="navrow">
                <Icon name="calendar" size={18} className="navrow__icon" />
                <span>Not started yet</span>
                <span className="navrow__badge">{chrome.needs.resting}<span className="sr-only"> bets</span></span>
              </Link>
            ) : null}
            {chrome.needs.waiting > 0 ? (
              <Link href="/app/ledger?needs=waiting" className="navrow navrow--warn">
                <Icon name="alert" size={18} className="navrow__icon" />
                <span>Waiting on a result</span>
                <span className="navrow__badge navrow__badge--warn">{chrome.needs.waiting}<span className="sr-only"> bets</span></span>
              </Link>
            ) : null}
            {/*  A proposal is one tap and a question is a decision, so they
                 are two rows. Listing them together would hide the cheap
                 work behind the expensive work.

                 BOTH POINTED AT /app/review, WHICH DOES NOT EXIST. There is
                 no app/app/review directory and the route 404s. Neither row
                 draws today, because attention() reports zero of each until
                 the ingestion branch lands, so this was a 404 waiting for the
                 day the reader starts producing questions. They point at the
                 ledger filter that exists, which is the same set of bets seen
                 through the screen that can already settle them. When the
                 review queue is real, these two hrefs are what change. */}
            {chrome.needs.proposals > 0 ? (
              <Link href="/app/ledger?needs=waiting" className="navrow">
                <Icon name="check" size={18} className="navrow__icon" />
                <span>Settlements to confirm</span>
                <span className="navrow__badge">{chrome.needs.proposals}<span className="sr-only"> settlements</span></span>
              </Link>
            ) : null}
            {chrome.needs.asks > 0 ? (
              <Link href="/app/ledger?needs=waiting" className="navrow navrow--warn">
                <Icon name="help" size={18} className="navrow__icon" />
                <span>Questions to answer</span>
                <span className="navrow__badge navrow__badge--warn">{chrome.needs.asks}<span className="sr-only"> questions</span></span>
              </Link>
            ) : null}
          </nav>
        ) : null}

        <div style={{ marginTop: 'auto' }}>
          <Link href="/app/settings" className="navrow">
            <Icon name="settings" size={18} className="navrow__icon" />
            <span>Settings</span>
          </Link>
          <p className="small dim" style={{ padding: 'var(--s2) var(--s3) 0' }}>
            {chrome.readOnly
              ? 'Read only. Ledger and export stay live.'
              : `Times in ${timeZoneClock(chrome.timeZone)}`}
          </p>
        </div>
      </aside>

      <div style={{ minWidth: 0 }}>
        <header className="topbar">
          {/*  Icon only: the top bar already carries the handle, the example
               pill and the balance, and a word beside them at 390 is what
               truncated the handle to "@tester1...". */}
          <Brand size={34} href="/app" word={false} label="Slippery, dashboard" />

          <div className="topbar__mid">
            {/*  An account that has not picked a handle yet gets neither an
                 initial nor a bare "@". Both were drawn from empty strings
                 the moment a signed-in account stopped being handed the
                 example account's name, and an avatar with nothing in it
                 beside an at sign with nothing after it reads as a page that
                 failed to load rather than as a profile nobody has filled
                 in. */}
            {chrome.displayName ? (
              <span className="avatar" aria-hidden="true">{chrome.displayName.slice(0, 1)}</span>
            ) : null}
            {/*  Under 380px the handle truncates to "@..." which is worse
                 than nothing: it takes the width of a word and carries none
                 of one. It goes, and the avatar beside it still identifies
                 the account. */}
            {chrome.handle ? (
              <span className="small muted mono topbar__handle">@{chrome.handle}</span>
            ) : (
              <Link href="/app/settings?pane=account" className="small muted topbar__handle">Finish your profile</Link>
            )}
            {chrome.demo ? <span className="pill hide-xs">Example</span> : null}
          </div>

          <div className="topbar__right">
            <BalanceSwitch
              balances={chrome.balances}
              current={chrome.balanceId}
              balanceMinor={chrome.balanceMinor}
              currency={chrome.currency}
            />
          </div>
        </header>

        <main className="main" id="main">{children}</main>
      </div>

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
