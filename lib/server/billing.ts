/* Billing rules, stated once.
 *
 * Trial is 5 days OR 15 slips, a referral makes it 14 or 40, and a card is
 * required. The plan chosen at signup starts immediately if the person picks
 * one outright; if they take the trial instead, THE YEARLY PLAN STARTS WHEN
 * THE TRIAL ENDS and there is deliberately no reminder before it does.
 *
 * PAYMENT FAILURE. One failure retries in three days. TWO FAILURES AND THE
 * ACCOUNT GOES READ ONLY: the ledger and export stay fully live, new slips,
 * imports and the bot pause. Betting history is NEVER deleted for
 * non-payment. Adding a working card reverses it.
 */
export const PRICES = {
  monthly: { pence: 349, label: '£3.49', period: 'a month' },
  yearly: { pence: 2999, was: 3499, label: '£29.99', period: 'a year', saves: '£11.89 a year' },
} as const;

export type PlanKey = keyof typeof PRICES;

/* What the trial rolls into if the person never picks. */
export const PLAN_AT_TRIAL_END: PlanKey = 'yearly';

export const RETRY_AFTER_DAYS = 3;
export const FAILURES_BEFORE_READ_ONLY = 2;

export type PlanState = 'trialing' | 'active' | 'granted' | 'past_due' | 'read_only' | 'cancelled' | null;

export function afterPaymentFailure(failures: number): { planState: PlanState; retryAt: Date | null; message: string } {
  if (failures >= FAILURES_BEFORE_READ_ONLY) {
    return {
      planState: 'read_only',
      retryAt: null,
      message: 'Two payments have failed, so the account is read only. Your ledger and export still work in full. Add a working card to start logging again.',
    };
  }
  return {
    planState: 'past_due',
    retryAt: new Date(Date.now() + RETRY_AFTER_DAYS * 86400000),
    message: `That payment did not go through. We will try again in ${RETRY_AFTER_DAYS} days.`,
  };
}

/* Read only pauses what costs money and nothing else. Export in particular
   stays available in read only and after cancelling: somebody's betting
   record is theirs whether or not they are paying. */
export const CAN_DO_IN_READ_ONLY = {
  viewLedger: true,
  export: true,
  editSettings: true,
  logNewBet: false,
  importHistory: false,
  readSlips: false,
  bot: false,
} as const;

export function canDo(action: keyof typeof CAN_DO_IN_READ_ONLY, planState: PlanState): boolean {
  if (planState !== 'read_only') return true;
  return CAN_DO_IN_READ_ONLY[action];
}
