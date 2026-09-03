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

/** The rail's second group: four things you DO, under the four places.
 *
 *  The rail is 72 pixels wide and about 800 tall, and between the four
 *  places at the top and the account at the bottom there were five hundred
 *  pixels of nothing on every route. These fill it, and every one is a real
 *  address rather than a fifth name for a screen already in the list above:
 *  the ledger with its search box focused, the ledger filtered to every open
 *  bet, the import, and the group directory. Nothing here repeats a row of
 *  SIDE_NAV, which is the defect this file already records once. */
export const RAIL_TOOLS: NavItem[] = [
  { href: '/app/ledger?find=1', label: 'Search your bets', icon: 'search', match: [] },
  { href: '/app/ledger?needs=open', label: 'Open bets', icon: 'clock', match: [] },
  { href: '/app/import', label: 'Add a bet', icon: 'plus', match: ['/app/import'] },
  { href: '/app/social/discover', label: 'Groups', icon: 'trophy', match: ['/app/social/discover'] },
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
