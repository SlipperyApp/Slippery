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
  '/app', '/app/ledger', '/app/history',
  '/app/social', '/app/social/discover', '/app/social/group', '/app/social/person', '/app/social/feed',
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
  '/app/ledger?needs=waiting', '/app/ledger?needs=running',
];

export const ERRORS = ['/404', '/500'];

export const API = ['/api/sources'];

export const ALL = [...MARKETING, ...AUTH, ...APP, ...ERRORS];
