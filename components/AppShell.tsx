'use client';

import Link from 'next/link';
import { Brand } from '@/components/Brand';
import { usePathname } from 'next/navigation';
import { Icon } from '@/components/Icon';
import { SIDE_NAV, TAB_NAV, isActive } from '@/lib/nav';
import { money, type Currency } from '@/lib/format';

export type ShellChrome = {
  displayName: string;
  handle: string;
  /** Bankroll, shown as a figure in the top bar. It is not a page. */
  balanceMinor: number;
  currency: Currency;
  /** Counters ride as badges on the row they belong to. */
  badges: { ledger?: number; social?: number; import?: number };
  /*  What needs the account holder, as opposed to what needs a football
      match. See lib/data/attention.ts for why there are two of these and
      not the prototype's three. */
  needs?: { running: number; waiting: number };
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
        {chrome.needs && (chrome.needs.running > 0 || chrome.needs.waiting > 0) ? (
          <nav className="side__group" aria-label="Needs you">
            <p className="side__grouph label">Needs you</p>
            {chrome.needs.running > 0 ? (
              <Link href="/app/ledger?needs=running" className="navrow">
                <Icon name="clock" size={18} className="navrow__icon" />
                <span>Bets running</span>
                <span className="navrow__badge">{chrome.needs.running}<span className="sr-only"> bets</span></span>
              </Link>
            ) : null}
            {chrome.needs.waiting > 0 ? (
              <Link href="/app/ledger?needs=waiting" className="navrow navrow--warn">
                <Icon name="alert" size={18} className="navrow__icon" />
                <span>Waiting on a result</span>
                <span className="navrow__badge navrow__badge--warn">{chrome.needs.waiting}<span className="sr-only"> bets</span></span>
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
            {chrome.readOnly ? 'Read only. Ledger and export stay live.' : 'Times in UK time'}
          </p>
        </div>
      </aside>

      <div style={{ minWidth: 0 }}>
        <header className="topbar">
          {/*  Icon only: the top bar already carries the handle, the example
               pill and the bankroll, and a word beside them at 390 is what
               truncated the handle to "@tester1...". */}
          <Brand size={34} href="/app" word={false} label="Slippery, dashboard" />

          <div className="topbar__mid">
            <span className="avatar" aria-hidden="true">{chrome.displayName.slice(0, 1)}</span>
            {/*  Under 380px the handle truncates to "@..." which is worse
                 than nothing: it takes the width of a word and carries none
                 of one. It goes, and the avatar beside it still identifies
                 the account. */}
            <span className="small muted mono topbar__handle">@{chrome.handle}</span>
            {chrome.demo ? <span className="pill hide-xs">Example</span> : null}
          </div>

          <div className="topbar__right">
            <span className="balance" title="Bankroll">
              <span className="balance__k">Bankroll</span>
              <span className="balance__v tnum">{money(chrome.balanceMinor, chrome.currency)}</span>
            </span>
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
