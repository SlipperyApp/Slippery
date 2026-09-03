/** WHOSE FIGURES ARE ON THE SCREEN. One decision, taken once, per request.
 *
 *  THE DEFECT THIS EXISTS TO KILL. getViewer() read the example account
 *  unconditionally and the session cookie switched off the "Example" pill and
 *  nothing else, so an account that had just typed in a card was shown
 *  @tester123, +£2,631.37 all time and 259 bets, with the label removed at
 *  exactly the moment the data became a lie. Every write path in the build
 *  was honest (503 without a database, 401 without a session) and the read
 *  path, the one people look at, was not.
 *
 *  So the three answers are named here and a page asks which one it has
 *  rather than inferring it from a cookie. The example account is the right
 *  thing to show a signed-OUT visitor. A signed-in account is shown its own
 *  rows, and when it has none it is shown the empty state and told so, which
 *  is the honest answer and is never a stranger's ledger.
 *
 *  Pure on purpose: the decision is a function of three facts, so it can be
 *  tested without a request, a cookie jar or a database. */

import type { DemoData } from './demo';
import type { Balance } from '@/lib/domain/balances';
import { TRIAL_DAYS, TRIAL_SLIPS } from '@/lib/domain/trial';
import { NOTIFICATIONS, SHARING_SWITCHES, switchDefaults } from './settings';
import { DEFAULT_TZ } from '@/lib/format';

export type ViewerSource =
  /** Signed out. The example account, labelled as an example everywhere. */
  | 'example'
  /** Signed in, with rows of their own. */
  | 'account'
  /** Signed in, with nothing in the ledger yet. Empty states, never figures. */
  | 'empty';

/** The three facts the answer depends on, and nothing else. */
export type ViewerFacts = {
  /** A session cookie is present. */
  signedIn: boolean;
  /** The session resolved to a real account row. False without a database. */
  hasAccount: boolean;
  /** How many bets that account's book actually holds. */
  betCount: number;
};

export function viewerSource(f: ViewerFacts): ViewerSource {
  if (!f.signedIn) return 'example';
  if (!f.hasAccount) return 'empty';
  return f.betCount > 0 ? 'account' : 'empty';
}

/** True when nothing on the screen may be a figure.
 *
 *  A page asks this rather than asking `source === 'empty'`, so the day a
 *  fourth source exists nothing has to be revisited to stay honest. */
export function showsFigures(source: ViewerSource): boolean {
  return source !== 'empty';
}

/** Why the ledger is empty, in the one sentence the screens print.
 *
 *  A signed-in account looking at zeroes is owed the reason, and there are
 *  two of them: a new account has not sent a slip yet, and a deployment
 *  without a database cannot hold one. Saying which is the difference
 *  between an empty state and a product that looks broken. */
export function emptyReason(storeReady: boolean): string {
  return storeReady
    ? 'Your account has no bets yet, so every figure here is zero rather than an example.'
    : 'Your account has no bets yet. This deployment has no database behind it, so nothing can be stored and every figure here is zero rather than an example.';
}

export const DEFAULT_ACCOUNT_ID = 'no-account';

/** What a page needs to know about an account that has no rows.
 *
 *  Every field is the account's own or a documented default. NOTHING here is
 *  taken from the example account: the whole point of this file is that a
 *  signed-in viewer never sees one of its figures, and a "sensible default"
 *  copied off @tester123 would be the same defect one layer down. */
export function newAccountFacts(
  over: Partial<DemoData['account']>,
  now: Date = new Date(),
): DemoData['account'] {
  return {
    id: DEFAULT_ACCOUNT_ID,
    displayName: '',
    handle: '',
    email: '',
    unitPence: 0,
    currency: 'GBP',
    balanceStartPence: 0,
    timeZone: DEFAULT_TZ,
    weekStart: 1,
    oddsFormat: 'decimal',
    showProfitIn: 'both',
    calendarDates: true,
    theme: 'carbon',
    linkCode: '',
    telegramLinked: false,
    planState: 'trial',
    trialEndsAt: new Date(now.getTime() + TRIAL_DAYS * 86400000).toISOString(),
    trialSlipsAllowed: TRIAL_SLIPS,
    trialSlipsUsed: 0,
    /*  The switches, resolved against the one list in lib/data/settings.ts.
        The panes used to hold their own copy in React state and nothing
        else, so a reload put every one of them back. */
    notifications: switchDefaults(NOTIFICATIONS, null),
    sharing: switchDefaults(SHARING_SWITCHES, null),
    ...over,
  };
}

/** The one balance an account has before it makes another. It carries the
 *  account's own currency and unit, so an empty screen is still denominated
 *  in the money this person keeps. */
export function firstBalance(account: DemoData['account'], now: Date = new Date()): Balance {
  return {
    id: 'bal-main',
    accountId: account.id,
    name: 'Main',
    currency: account.currency,
    startMinor: account.balanceStartPence,
    unitMinor: account.unitPence,
    shareToken: null,
    archived: false,
    sort: 0,
    createdAt: now.toISOString(),
  };
}

/** A book with nothing in it. Real account, real balances, zero rows. */
export function emptyBook(
  account: DemoData['account'],
  balances: Balance[] = [],
  now: Date = new Date(),
): DemoData {
  return {
    account,
    balances: balances.length ? balances : [firstBalance(account, now)],
    bets: [],
    movements: [],
    generatedAt: now.toISOString(),
  };
}
