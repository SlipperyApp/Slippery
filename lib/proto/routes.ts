/* One URL per view.
 *
 * The prototype had no router: the harness swapped `cur.view` and nothing in
 * the address bar moved, so no screen could be linked, shared or reloaded and
 * the back button left the app. Every view now owns a path, and `go()` pushes
 * it, which is also what makes the Playwright sweep able to visit every route
 * rather than clicking its way to one.
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
  login: '/sign-in',

  overview: '/dashboard',
  ledger: '/ledger',
  history: '/history',

  social: '/social',
  discover: '/social/discover',
  groupdetail: '/social/group',
  person: '/social/person',

  import: '/add',
  crop: '/add/crop',
  reading: '/add/analysing',
  review: '/add/review',
  manual: '/add/manual',
  importlinked: '/add/linked',
  imphist: '/add/history',
  imphistreview: '/add/history/review',

  settings: '/settings',
  plan: '/settings/plan',
  referrals: '/settings/referrals',

  bs_reminder: '/billing/trial',
  bs_failed: '/billing/declined',
  bs_readonly: '/billing/read-only',

  fresh: '/states/new-dashboard',
  freshledger: '/states/new-ledger',
  freshsocial: '/states/new-social',
  offline: '/states/offline',
  saveerr: '/states/save-failed',
  readererr: '/states/unreadable',
};

export const PATH_TO_VIEW: Record<string, string> = Object.fromEntries(
  Object.entries(ROUTES).map(([view, path]) => [path, view]),
);

export const ALL_VIEWS = Object.keys(ROUTES);
export const ALL_PATHS = Object.values(ROUTES);

export function pathForView(view: string): string {
  return ROUTES[view] || '/';
}

export function viewForPath(path: string): string {
  const clean = path.replace(/\/+$/, '') || '/';
  return PATH_TO_VIEW[clean] || 'landing';
}
