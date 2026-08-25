/* One URL per view.
 *
 * The prototype had no router: a harness swapped `cur.view` and nothing in
 * the address bar moved, so no screen could be linked, shared or reloaded and
 * the back button left the app. Every view owns a path, `go()` pushes it, and
 * the audit can visit a route rather than clicking its way to one.
 *
 * Public pages sit at the root. Everything behind sign-in sits under /app, so
 * the two halves of the product are legible from the address bar and a future
 * middleware rule can protect one prefix rather than a list.
 */
export const ROUTES: Record<string, string> = {
  landing: '/',
  demo: '/demo',

  su1: '/signup',
  su429: '/signup/rate-limited',
  su2: '/signup/verify',
  su3: '/signup/name',
  su4: '/signup/unit',
  su5: '/signup/sports',
  su6: '/signup/plan',
  login: '/login',

  overview: '/app',
  ledger: '/app/ledger',
  history: '/app/history',

  social: '/app/social',
  discover: '/app/social/discover',
  groupdetail: '/app/social/group',
  person: '/app/social/person',
  feed: '/app/social/feed',

  import: '/app/import',
  crop: '/app/import/crop',
  reading: '/app/import/analysing',
  review: '/app/import/review',
  manual: '/app/import/manual',
  importlinked: '/app/import/linked',
  imphist: '/app/import/history',
  imphistreview: '/app/import/history/review',
  impdry: '/app/import/history/dry-run',
  impfix: '/app/import/history/resolve',
  impcommit: '/app/import/history/done',

  settings: '/app/settings',
  plan: '/app/settings/plan',
  referrals: '/app/settings/referrals',

  bs_reminder: '/app/billing/trial',
  bs_failed: '/app/billing/declined',
  bs_readonly: '/app/billing/read-only',

  fresh: '/app/states/new-dashboard',
  freshledger: '/app/states/new-ledger',
  freshsocial: '/app/states/new-social',
  offline: '/app/states/offline',
  saveerr: '/app/states/save-failed',
  readererr: '/app/states/unreadable',
};

/* Sections of the landing page, reachable by their own URL so a pricing link
   in an email lands on pricing rather than at the top of the page. They are
   not views: each scrolls the landing page to a `[data-sec]` anchor. */
export const SECTIONS: Record<string, string> = {
  '/how': 'how',
  '/pricing': 'price',
  '/themes': 'themes',
  '/social': 'social',
  '/import': 'import',
  '/faq': 'faq',
};

export const PATH_TO_VIEW: Record<string, string> = Object.fromEntries(
  Object.entries(ROUTES).map(([view, path]) => [path, view]),
);

export const ALL_VIEWS = Object.keys(ROUTES);
export const ALL_PATHS = [...Object.values(ROUTES), ...Object.keys(SECTIONS)];

export function pathForView(view: string): string {
  return ROUTES[view] || '/';
}

export function viewForPath(path: string): string {
  const clean = path.replace(/\/+$/, '') || '/';
  if (SECTIONS[clean]) return 'landing';
  return PATH_TO_VIEW[clean] || 'landing';
}

/** The landing section a path names, if it names one. */
export function sectionForPath(path: string): string | null {
  return SECTIONS[path.replace(/\/+$/, '') || '/'] ?? null;
}

/* 02/04 · A TITLE AND A DESCRIPTION PER ROUTE.
 *
 * Every one of the 173 captures carried the same `<title>Slippery</title>`,
 * which makes a browser's tab strip, a bookmark list and a set of search
 * results all unreadable. The specific part goes first — "Ledger · Slippery",
 * not "Slippery · Ledger" — because a tab is truncated from the right and the
 * shared half is the half you can afford to lose.
 *
 * The descriptions are per route rather than one repeated line, since a
 * repeated meta description is the same defect as a repeated title.
 */
export const PAGE_META: Record<string, { title: string; description: string }> = {
  '/': { title: 'Slippery, a bet tracker for UK and Irish bettors',
    description: 'Forward a bet slip when you place it. Slippery reads it, settles it and keeps the record — so your history is what happened, not what you remembered.' },
  '/how': { title: 'How it works',
    description: 'Forward a slip to the bot, in play or after it settled. Slippery reads the stake, price and selection, then grades it against the 90-minute score.' },
  '/pricing': { title: 'Pricing',
    description: 'Free while you try it, then £3.49 a month or £29.99 a year. No commission, no bookmaker links, no affiliate deals.' },
  '/faq': { title: 'Questions',
    description: 'What Slippery reads, how it settles, what happens to your slip images, and what it will not do.' },
  '/social': { title: 'Groups and leagues',
    description: 'Monthly leagues ranked in units, weekly head to heads, and groups where every figure has a bookmaker slip behind it.' },
  '/themes': { title: 'Themes',
    description: 'Eight themes, all dark, all with the same semantic profit and loss colours so a green figure means the same thing in every one.' },
  '/import': { title: 'Bringing your history in',
    description: 'Spreadsheets, bookmaker statements, Betfair P&L or screenshots. Nothing is written until you have seen the dry run.' },
  '/demo': { title: 'Demo',
    description: 'A worked example month. Every figure is illustrative and labelled as such.' },
  '/app': { title: 'Dashboard', description: 'Your net, your calendar and what is still running.' },
  '/app/ledger': { title: 'Ledger', description: 'Every bet you have logged, newest first.' },
  '/app/history': { title: 'Imported history', description: 'Bets brought in from elsewhere, kept apart from your slip-backed record.' },
  '/app/social': { title: 'Social', description: 'Your groups, your league table and the Slippers you follow.' },
  '/app/settings': { title: 'Settings', description: 'Your unit, your bankroll, your bookmakers and what Slippery is allowed to do.' },
  '/app/import': { title: 'Add a bet', description: 'Forward a slip, drop a screenshot, or type one in.' },
  '/signup': { title: 'Create an account', description: 'One screen. Email and a password, or continue with Google.' },
  '/login': { title: 'Sign in', description: 'Sign in to Slippery.' },
};

export function metaForPath(path: string): { title: string; description: string } {
  const hit = PAGE_META[path];
  if (hit) return hit;
  /* Anything without its own entry falls back to the view's own heading,
     which is still specific, rather than to the bare product name. */
  const view = PATH_TO_VIEW[path];
  const name = view ? view.replace(/([a-z])([A-Z])/g, '$1 $2') : 'Slippery';
  return {
    title: name.charAt(0).toUpperCase() + name.slice(1),
    description: 'Slippery is a bet tracker. It records bets. It does not take them.',
  };
}
