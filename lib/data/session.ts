/** What a page needs to know about who is looking at it.
 *
 *  THE SEAM. One function decides, per request, whether this viewer has real
 *  data, example data, or nothing yet, and every page goes through it. Before
 *  this existed the example account was read unconditionally and the session
 *  cookie only switched off the "Example" label, so a signed-in account was
 *  shown @tester123's ledger with the one thing that said it was not theirs
 *  removed. See lib/data/viewer.ts for the decision itself, which is pure and
 *  tested, and lib/server/book.ts for the account's own rows. */

import { cookies } from 'next/headers';
import { attention } from '@/lib/data/attention';
import { demoData, type DemoData } from './demo';
import { trialState, type TrialState } from '@/lib/domain/trial';
import type { OnboardingSignals } from '@/lib/domain/onboarding';
import { THEME_COOKIE, isTheme } from '@/lib/themes';
import { balance } from './analytics';
import { inBalance, resolveBalance, type Balance } from '@/lib/domain/balances';
import { emptyBook, newAccountFacts, viewerSource, type ViewerSource } from './viewer';
import { currentAccount } from '@/lib/server/auth';
import { hasDatabase } from '@/lib/server/db';
import { loadBook } from '@/lib/server/book';
import { decideGate, READ_ONLY_GATE, type SlipGate } from '@/lib/server/gate';
import type { ShellChrome } from '@/components/AppShell';

export type Viewer = {
  /** THE SELECTED BALANCE'S BOOKS, not the account's.
   *
   *  `bets` and `movements` here are one balance's, and `account` carries
   *  that balance's currency, unit and starting figure rather than the
   *  account level ones. That is deliberate and it is the enforcement of the
   *  rule that pounds and euros are never summed: a page cannot add two
   *  currencies together because it cannot see two of them. Every screen
   *  that reads `data` was already correct the day the second balance
   *  existed, without being touched.
   *
   *  The whole book is on `book` below, and exactly one surface reads it. */
  data: DemoData;
  /** Every balance on the account, in draw order. */
  balances: Balance[];
  /** The one being read. */
  balance: Balance;
  /** EVERY balance's bets and movements. Only the balance sheet may read
   *  this, and it splits by balance before it counts anything: there is no
   *  figure anywhere that is a total across two currencies. */
  book: { bets: DemoData['bets']; movements: DemoData['movements'] };
  /** Whose figures these are. A page that prints money reads this, not
   *  `demo`, because there are three answers and `demo` only has two. */
  source: ViewerSource;
  /** Whether this deployment can store a bet at all. An account with nothing
   *  in it says something different when there is nowhere to put it. */
  storeReady: boolean;
  demo: boolean;
  readOnly: boolean;
  trial: TrialState;
  /** Whether this account may spend a slip, and why not when it may not.
   *
   *  THE SAME FUNCTION THE ROUTE USES. The upload control was enabled off
   *  `trial.active` alone, which is false for every paying account the day
   *  its trial window passes, so a customer would have been locked out of the
   *  feature they pay for. One rule, in lib/server/gate.ts, asked here and
   *  asked again by /api/extract, so the control and the refusal cannot
   *  disagree. */
  slips: SlipGate;
  /** The four things a new account has to do, as booleans. The list itself
   *  lives in lib/domain/onboarding.ts; this is only what is true. */
  onboarding: OnboardingSignals;
  now: Date;
  chrome: ShellChrome;
};

export const SESSION_COOKIE = 'slip_session';
export const STATE_COOKIE = 'slip_state';
/** Which balance is open. A cookie rather than a query parameter, because it
 *  is not a filter on a page: it is which set of books you have in front of
 *  you, and it has to survive every link on the site the way the theme does.
 *  Never localStorage: iOS Safari is the primary target. */
export const BALANCE_COOKIE = 'slip_balance';

/** Read the display preferences a signed-out visitor may still have set.
 *  Cookies, never localStorage: iOS Safari is the primary target. */
export async function getViewer(): Promise<Viewer> {
  const jar = await cookies();
  const now = new Date();
  const signedIn = Boolean(jar.get(SESSION_COOKIE)?.value);
  const storeReady = hasDatabase();

  /*  WHOSE BOOK. A signed-out visitor gets the example account, which is
      what it is for. A signed-in one gets their own rows and NEVER the
      example account's, whether or not there are any: a stranger's ledger
      with the label taken off is the worst thing this product could show
      somebody who has just paid for it. */
  const account = signedIn ? await currentAccount() : null;
  const own = account ? await loadBook(account.id, now) : null;
  const whole: DemoData = !signedIn
    ? demoData(now)
    : own ?? emptyBook(
      newAccountFacts({
        id: account?.id ?? 'no-account',
        displayName: account?.displayName ?? '',
        handle: account?.handle ?? '',
        email: account?.email ?? '',
      }, now),
      [],
      now,
    );

  const source = viewerSource({
    signedIn,
    hasAccount: Boolean(account),
    betCount: whole.bets.length,
  });

  /*  SCOPE TO ONE BALANCE, HERE, ONCE.
   *
   *  Doing it at the door rather than in each page is what makes the rule
   *  hold: there is no argument any page could pass that would hand it two
   *  currencies. A cookie naming a balance that no longer exists resolves to
   *  the first one rather than to an empty account, because a screen with no
   *  bets on it and no explanation is the worst answer to a stale cookie. */
  const selected = resolveBalance(whole.balances, jar.get(BALANCE_COOKIE)?.value);
  const data: DemoData = {
    ...whole,
    bets: inBalance(whole.bets, selected.id),
    movements: inBalance(whole.movements, selected.id),
    account: {
      ...whole.account,
      currency: selected.currency,
      unitPence: selected.unitMinor,
      balanceStartPence: selected.startMinor,
    },
  };
  const att = attention(data.bets, now);
  const forced = jar.get(STATE_COOKIE)?.value;

  /*  Read only is the account's own plan state first and the state cookie
      second. The cookie exists so the screens can be walked without a failed
      payment; it used to be the ONLY thing that set this, so an account that
      really was read only had every control in the product enabled. */
  const readOnly = forced === 'read_only' || data.account.planState === 'read_only';
  const trial = trialState(data.account, now);
  const slips: SlipGate = readOnly
    ? READ_ONLY_GATE
    : decideGate({
      plan_state: data.account.planState,
      trial_ends_at: data.account.trialEndsAt,
      trial_slips_allowed: data.account.trialSlipsAllowed,
      trial_slips_used: data.account.trialSlipsUsed,
    }, now);

  const chrome: ShellChrome = {
    displayName: data.account.displayName,
    handle: data.account.handle,
    balanceMinor: balance(data.bets, data.movements, data.account.balanceStartPence),
    currency: data.account.currency,
    timeZone: data.account.timeZone,
    balances: whole.balances.map((b) => ({ id: b.id, name: b.name, currency: b.currency })),
    balanceId: selected.id,
    badges: {
      /*  The ledger badge is every open bet; the three under "Needs you"
          split that same set by whether the event has started and whether it
          has had time to finish. One source, so the badge and the rows it
          links to cannot disagree, and adding a fourth state later cannot
          leave this line counting three of them.

          THERE IS NO SOCIAL BADGE. This object carried `social: 3`, a
          literal, and it drew a "3" beside Social in the sidebar reading "3
          items" to a screen reader. There were not three of anything. Rule 5
          of the codebase is that every count derives from one query and the
          facet total equals the row total, written after a build showed 486
          bets in a banner, 482 in the ledger and facets summing to 474; a
          hand-picked number is that defect with the arithmetic skipped. It
          is also a red dot on a social tab that never clears, which is an
          engagement mechanic. A badge comes back here when there is a query
          behind it. */
      ledger: att.openCount,
    },
    needs: {
      resting: att.resting.length,
      running: att.running.length,
      waiting: att.waiting.length,
      proposals: att.proposals,
      asks: att.asks,
    },
    readOnly,
    demo: source === 'example',
  };

  /*  A THEME IS PICKED WHEN THE COOKIE SAYS SO, not when the account has a
      theme: every account has one, because carbon is the default, and a
      checklist that ticked itself on a default nobody chose would be a list
      that lies to make itself shorter. The cookie is written by the picker
      and by nothing else. */
  const themeCookie = jar.get(THEME_COOKIE)?.value;
  const onboarding: OnboardingSignals = {
    telegramLinked: data.account.telegramLinked,
    hasBet: data.bets.length > 0,
    unitSet: data.account.unitPence > 0,
    themeSet: isTheme(themeCookie ? decodeURIComponent(themeCookie) : ''),
  };

  return {
    data,
    balances: whole.balances,
    balance: selected,
    book: { bets: whole.bets, movements: whole.movements },
    source, storeReady,
    demo: source === 'example', readOnly, trial, slips, onboarding, now, chrome,
  };
}
