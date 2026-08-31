/** What a page needs to know about who is looking at it.
 *
 *  The product renders from one repository. When a signed-in account exists
 *  it reads that account; otherwise it reads the example account, labelled as
 *  an example everywhere it appears. Nothing here is presented as a real
 *  person's record. */

import { cookies } from 'next/headers';
import { demoData, type DemoData } from './demo';
import { trialState, type TrialState } from '@/lib/domain/trial';
import { bankroll } from './analytics';
import type { ShellChrome } from '@/components/AppShell';

export type Viewer = {
  data: DemoData;
  demo: boolean;
  readOnly: boolean;
  trial: TrialState;
  now: Date;
  chrome: ShellChrome;
};

export const SESSION_COOKIE = 'slip_session';
export const STATE_COOKIE = 'slip_state';

/** Read the display preferences a signed-out visitor may still have set.
 *  Cookies, never localStorage: iOS Safari is the primary target. */
export async function getViewer(): Promise<Viewer> {
  const jar = await cookies();
  const now = new Date();
  const data = demoData(now);
  const signedIn = Boolean(jar.get(SESSION_COOKIE)?.value);
  const forced = jar.get(STATE_COOKIE)?.value;

  const readOnly = forced === 'read_only';
  const trial = trialState(data.account, now);

  const chrome: ShellChrome = {
    displayName: data.account.displayName,
    handle: data.account.handle,
    balanceMinor: bankroll(data.bets, data.account.bankrollStartPence),
    currency: data.account.currency,
    badges: {
      ledger: data.bets.filter((b) => b.state.status === 'open').length,
      social: 3,
    },
    readOnly,
    demo: !signedIn,
  };

  return { data, demo: !signedIn, readOnly, trial, now, chrome };
}
