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

  import: '/app/import',
  crop: '/app/import/crop',
  reading: '/app/import/analysing',
  review: '/app/import/review',
  manual: '/app/import/manual',
  importlinked: '/app/import/linked',
  imphist: '/app/import/history',
  imphistreview: '/app/import/history/review',

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
