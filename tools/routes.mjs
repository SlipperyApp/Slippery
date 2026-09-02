/** Every route in the map, in one place, so the audit and the live check
 *  cannot drift from each other. */
export const MARKETING = [
  '/', '/demo', '/how', '/pricing', '/faq', '/themes', '/social', '/import',
  '/terms', '/privacy', '/changelog', '/safer-gambling', '/waiting-list',
  '/thank-you',
];

export const AUTH = [
  '/login', '/signup', '/signup/verify', '/signup/name', '/signup/unit',
  '/signup/sports', '/signup/plan', '/signup/rate-limited',
];

export const APP = [
  '/app', '/app/ledger', '/app/history', '/app/gallery', '/app/balances', '/app/analyser',
  '/app/social', '/app/social/leaderboard', '/app/social/group/new', '/app/social/discover',
  '/app/social/group', '/app/social/group/join', '/app/social/person', '/app/social/feed',
  '/app/import', '/app/import/crop', '/app/import/analysing', '/app/import/review',
  '/app/import/manual', '/app/import/linked',
  '/app/import/history', '/app/import/history/review', '/app/import/history/dry-run',
  '/app/import/history/resolve', '/app/import/history/done',
  '/app/you', '/app/settings', '/app/settings/plan', '/app/settings/referrals',
  '/app/billing/trial', '/app/billing/declined', '/app/billing/read-only',
  '/app/states/new-dashboard', '/app/states/new-ledger', '/app/states/new-social',
  '/app/states/offline', '/app/states/save-failed', '/app/states/unreadable',
  '/app/states/loading',
  /*  The ledger arrived at from the sidebar's counts. A filtered list is a
      different page from an unfiltered one and the sweep should see both. */
  '/app/ledger?needs=waiting', '/app/ledger?needs=running', '/app/ledger?needs=resting',
  /*  The analyser crossed, which is a different table from the single axis
      one and the only place a second label column is drawn at all. */
  '/app/analyser?dim=bookmaker&dim2=odds',
  /*  The social states that only exist under a query: the two other league
      periods, the second feed, a group of one, and a code that matches
      nothing. Each is a different page and the sweep should see all of them. */
  '/app/social/leaderboard?period=year', '/app/social/leaderboard?period=all',
  '/app/social/feed?tab=activity',
  '/app/social/group?id=the-nap', '/app/social/group?id=sunday-singles&new=1',
  '/app/social/group/join?code=K7QM2X', '/app/social/group/join?code=ZZZZZZ',
];

/** Public pages that are not the marketing site.
 *
 *  A shared balance, at the example account's own token. It is in the sweep
 *  because it is a real page a stranger can be sent to, and the thing most
 *  likely to break on it is the one thing it must never do: print money. A
 *  revoked token is deliberately NOT here, because the right answer to one
 *  is a 404 and the sweep asserts a 200. */
export const PUBLIC = ['/b/sb-k4qmw92xr3fzhn5tvbdc'];

export const ERRORS = ['/404', '/500'];

export const API = ['/api/sources', '/api/analysis'];

export const ALL = [...MARKETING, ...AUTH, ...APP, ...PUBLIC, ...ERRORS];
