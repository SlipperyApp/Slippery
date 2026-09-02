import type { IconName } from '@/components/Icon';

/** Four destinations. "Add a bet" is a primary button above them, not a row.
 *  Counters are badges on the row they belong to, never rows of their own.
 *  Balance is a figure in the top bar, not a page.
 *
 *  IMPORT WAS THE FIFTH, AND IT WAS THE BUTTON AGAIN. The sidebar carried a
 *  row labelled Import pointing at /app/import, directly under a primary
 *  button labelled Add a bet pointing at /app/import: two links a centimetre
 *  apart, going to the same screen, under two different names, and the page
 *  they both open is headed Add a bet. The phone never had the row, only the
 *  plus, so the two navigations disagreed about how many places this product
 *  has. The row is gone and both now say four places and one action. */
export type NavItem = { href: string; label: string; icon: IconName; match: string[] };

export const SIDE_NAV: NavItem[] = [
  { href: '/app', label: 'Dashboard', icon: 'home', match: ['/app'] },
  { href: '/app/ledger', label: 'Ledger', icon: 'bets', match: ['/app/ledger', '/app/history', '/app/gallery'] },
  { href: '/app/social', label: 'Social', icon: 'social', match: ['/app/social'] },
  { href: '/app/you', label: 'You', icon: 'you', match: ['/app/you', '/app/settings', '/app/billing'] },
];

/** Dashboard, Ledger, [ + ], Social, You. The plus is 56px, raised, centred,
 *  no label.
 *
 *  THE SAME WORDS AS THE SIDEBAR. It said Home and Bets where the sidebar
 *  says Dashboard and Ledger, for the same two destinations, whose own
 *  headings and page titles are Dashboard and Ledger as well. A phone and a
 *  desktop were calling the same two screens by four names, which is the
 *  kind of thing nobody reports and everybody notices. */
export const TAB_NAV: NavItem[] = [
  { href: '/app', label: 'Dashboard', icon: 'home', match: ['/app'] },
  { href: '/app/ledger', label: 'Ledger', icon: 'bets', match: ['/app/ledger', '/app/history', '/app/gallery'] },
  { href: '/app/social', label: 'Social', icon: 'social', match: ['/app/social'] },
  { href: '/app/you', label: 'You', icon: 'you', match: ['/app/you', '/app/settings', '/app/billing'] },
];

/** Four. It was seven, and seven links plus two buttons is a menu you read
 *  rather than a bar you use. Groups, Import and Themes are one scroll away in
 *  the footer, which is where a visitor looks for the rest of a site. */
export const MARKETING_NAV = [
  { href: '/how', label: 'How it works' },
  { href: '/demo', label: 'Demo' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/faq', label: 'Questions' },
];

export function isActive(pathname: string, item: { href: string; match: string[] }): boolean {
  if (item.href === '/app') return pathname === '/app';
  return item.match.some((m) => pathname === m || pathname.startsWith(m + '/'));
}
