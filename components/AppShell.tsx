'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon } from '@/components/Icon';
import { Wordmark } from '@/components/Wordmark';
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
        <Link href="/" className="brand" aria-label="Slippery, home">
          <img src="/icon.svg" alt="" className="brand__mark" width={26} height={26} />
          <Wordmark id="wm-side" height={17} />
          <span className="sr-only">Slippery</span>
        </Link>

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

        <div style={{ marginTop: 'auto' }}>
          <Link href="/app/settings" className="navrow">
            <Icon name="settings" size={18} className="navrow__icon" />
            <span>Settings</span>
          </Link>
          <p className="small dim" style={{ padding: '8px 12px 0' }}>
            {chrome.readOnly ? 'Read only. Ledger and export stay live.' : 'Times in UK time'}
          </p>
        </div>
      </aside>

      <div style={{ minWidth: 0 }}>
        <header className="topbar">
          <Link href="/app" className="brand" aria-label="Slippery, dashboard" style={{ minWidth: 0 }}>
            <img src="/icon.svg" alt="" className="brand__mark" width={26} height={26} />
          </Link>

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
