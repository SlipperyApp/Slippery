/** May this account spend a slip?
 *
 *  THE ONE CALL THAT COSTS MONEY WAS UNGATED. /api/extract checked no plan,
 *  no trial and no read-only state. Its only guard was an in-memory rate
 *  limit keyed on the forwarded IP, which on Vercel is per lambda and
 *  therefore not a limit at all under any concurrency, so an unauthenticated
 *  caller with a script could run the vision model at will. The trial's slip
 *  counter was incremented nowhere, so the slips half of the trial could
 *  never run out.
 *
 *  ONE FUNCTION DECIDES, and it reports WHICH reason it refused for, the same
 *  shape trialState() uses for the same reason: two surfaces disagreeing
 *  about why an upload was blocked is worse than either answer on its own.
 *  TRIAL_DAYS and TRIAL_SLIPS stay the only place the numbers live, and the
 *  sentence is trialState()'s own. */

import { hasDatabase, query } from './db';
import { trialState, type TrialState } from '@/lib/domain/trial';

export type SlipGate =
  | { allowed: true; trial: TrialState | null; paid: boolean }
  | { allowed: false; reason: 'read_only' | 'trial_spent'; message: string; trial: TrialState | null };

export type GateRow = {
  plan_state: string;
  trial_ends_at: string | null;
  trial_slips_allowed: number;
  trial_slips_used: number;
};

/** Read only pauses new slips, imports and the bot. It never touches the
 *  ledger, the export or history, so this is the only kind of thing it stops. */
const READ_ONLY_STATES = new Set(['read_only', 'cancelled']);

/** The one read-only refusal, said once. The state cookie can force this
 *  state for walking the screens, so two places produce it and neither may
 *  write its own sentence. */
export const READ_ONLY_GATE: SlipGate = {
  allowed: false,
  reason: 'read_only',
  message: 'New slips are paused while the account is read only. The ledger, the export and your history all stay live, and nothing has been deleted.',
  trial: null,
};

export async function slipGate(accountId: string, now: Date = new Date()): Promise<SlipGate> {
  if (!hasDatabase()) return { allowed: true, trial: null, paid: false };

  const rows = await query<GateRow>(
    `select plan_state, trial_ends_at, trial_slips_allowed, trial_slips_used
       from accounts where id = $1 limit 1`,
    [accountId],
  ).catch(() => [] as GateRow[]);

  const row = rows[0];
  if (!row) return { allowed: true, trial: null, paid: false };
  return decideGate(row, now);
}

/** The decision, without the database, so it can be tested as a rule rather
 *  than as a query. */
export function decideGate(row: GateRow, now: Date = new Date()): SlipGate {
  if (READ_ONLY_STATES.has(row.plan_state)) return READ_ONLY_GATE;

  /*  A paying account has no slip ceiling, which is what the pricing page
      says and is therefore what this has to do. past_due is still paying: two
      failed payments is what makes an account read only, and the state above
      is where that is enforced. */
  if (row.plan_state === 'active' || row.plan_state === 'past_due') {
    return { allowed: true, trial: null, paid: true };
  }

  const trial = trialState({
    trialEndsAt: row.trial_ends_at ?? new Date(0).toISOString(),
    trialSlipsAllowed: row.trial_slips_allowed,
    trialSlipsUsed: row.trial_slips_used,
  }, now);

  if (trial.active) return { allowed: true, trial, paid: false };

  return { allowed: false, reason: 'trial_spent', message: trial.message, trial };
}
