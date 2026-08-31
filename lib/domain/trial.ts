/** The trial. One function owns both numbers and reports WHICH one ran out.
 *
 *  14 days or 35 slips, whichever runs out first. The two halves fail
 *  differently, so the client is told the answer rather than counting, and no
 *  two surfaces can disagree about what blocks an upload. */

export const TRIAL_DAYS = 14;
export const TRIAL_SLIPS = 35;

export type TrialState = {
  active: boolean;
  /** Which half ran out. Null while the trial is still running. */
  ranOutOn: 'days' | 'slips' | null;
  daysLeft: number;
  slipsLeft: number;
  slipsUsed: number;
  slipsAllowed: number;
  endsAt: string;
  /** The one sentence every surface shows. Never assembled at a call site. */
  message: string;
};

export function trialState(
  input: { trialEndsAt: string; trialSlipsAllowed: number; trialSlipsUsed: number },
  now: Date = new Date(),
): TrialState {
  const endsAt = new Date(input.trialEndsAt);
  const msLeft = endsAt.getTime() - now.getTime();
  const daysLeft = Math.max(0, Math.ceil(msLeft / 86400000));
  const allowed = input.trialSlipsAllowed || TRIAL_SLIPS;
  const used = Math.max(0, input.trialSlipsUsed);
  const slipsLeft = Math.max(0, allowed - used);

  const outOfDays = msLeft <= 0;
  const outOfSlips = slipsLeft <= 0;
  const active = !outOfDays && !outOfSlips;

  const ranOutOn = active ? null : outOfDays && !outOfSlips ? 'days' : outOfSlips && !outOfDays ? 'slips' : 'days';

  let message: string;
  if (active) {
    message = daysLeft <= 3
      ? `${daysLeft} day${daysLeft === 1 ? '' : 's'} left, or ${slipsLeft} more slip${slipsLeft === 1 ? '' : 's'}.`
      : `${daysLeft} days left, or ${slipsLeft} more slips, whichever runs out first.`;
  } else if (ranOutOn === 'slips') {
    message = `All ${allowed} trial slips used. The ledger and export stay live.`;
  } else {
    message = 'The 14 day trial has ended. The ledger and export stay live.';
  }

  return { active, ranOutOn, daysLeft, slipsLeft, slipsUsed: used, slipsAllowed: allowed, endsAt: input.trialEndsAt, message };
}

/** Read only pauses new slips, imports and the bot. It never touches the
 *  ledger, the export, or history. History is never deleted for non-payment. */
export const READ_ONLY_ALLOWS = ['ledger', 'export', 'history', 'settings', 'billing'] as const;
export const READ_ONLY_PAUSES = ['new slips', 'imports', 'the Telegram bot'] as const;
