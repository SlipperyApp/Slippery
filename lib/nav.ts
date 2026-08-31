import type { IconName } from '@/components/Icon';

/** Five destinations. "Add a bet" is a primary button above them, not a row.
 *  Counters are badges on the row they belong to, never rows of their own.
 *  Balance is a figure in the top bar, not a page. */
export type NavItem = { href: string; label: string; icon: IconName; match: string[] };

export const SIDE_NAV: NavItem[] = [
  { href: '/app', label: 'Dashboard', icon: 'home', match: ['/app'] },
  { href: '/app/ledger', label: 'Ledger', icon: 'bets', match: ['/app/ledger', '/app/history'] },
  { href: '/app/social', label: 'Social', icon: 'social', match: ['/app/social'] },
  { href: '/app/import', label: 'Import', icon: 'upload', match: ['/app/import'] },
  { href: '/app/you', label: 'You', icon: 'you', match: ['/app/you', '/app/settings', '/app/billing'] },
];

/** Home, Bets, [ + ], Social, You. The plus is 56px, raised, centred, no label. */
export const TAB_NAV: NavItem[] = [
  { href: '/app', label: 'Home', icon: 'home', match: ['/app'] },
  { href: '/app/ledger', label: 'Bets', icon: 'bets', match: ['/app/ledger', '/app/history'] },
  { href: '/app/social', label: 'Social', icon: 'social', match: ['/app/social'] },
  { href: '/app/you', label: 'You', icon: 'you', match: ['/app/you', '/app/settings', '/app/billing'] },
];

export const MARKETING_NAV = [
  { href: '/how', label: 'How it works' },
  { href: '/demo', label: 'Demo' },
  { href: '/social', label: 'Groups' },
  { href: '/import', label: 'Import' },
  { href: '/themes', label: 'Themes' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/faq', label: 'FAQ' },
];

export function isActive(pathname: string, item: { href: string; match: string[] }): boolean {
  if (item.href === '/app') return pathname === '/app';
  return item.match.some((m) => pathname === m || pathname.startsWith(m + '/'));
}
