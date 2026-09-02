/** A slip read, recorded, counted and refundable exactly once.
 *
 *  trial_slips_used was written in one place in the whole repository and that
 *  place DECREMENTED it, so the counter every surface quotes never moved and
 *  the slips half of the trial could not run out. The flag button decremented
 *  it again on every press, against a read id it never checked existed or
 *  belonged to the account, which is an unbounded free allowance behind a
 *  button.
 *
 *  Both are the same defect: there was no record of a read. There is now, and
 *  the counter moves with it. The increment and the row go in one transaction
 *  so the count and the evidence for it cannot come apart, and the refund is
 *  bound to a nullable refunded_at that can only be filled once, so it is
 *  idempotent by construction rather than by a rate limit. */

import { hasDatabase, transaction } from './db';
import type { ReadCost } from './vision';

/** The smallest thing these need: something that runs a statement. A
 *  PoolClient satisfies it, and so does a fake, which is how the two rules
 *  that matter here are tested as rules rather than as queries. */
export type Runner = {
  query<R = Record<string, unknown>>(text: string, params?: unknown[]): Promise<{ rows: R[] }>;
};

export type ReadRecord = {
  readId: string;
  sha256: string;
  bookmakerId: string | null;
  ok: boolean;
  cost?: ReadCost;
};

/** Store the read and spend a slip.
 *
 *  A SLIP IS SPENT ONLY ON A READ THAT WORKED. A refused image, an
 *  unreachable model and an answer that would not parse all cost us money and
 *  none of them cost the account one of theirs; the row is still written,
 *  with ok false, because the cost is real and somebody has to be able to add
 *  it up. */
export async function recordRead(accountId: string, read: ReadRecord): Promise<void> {
  if (!hasDatabase()) return;
  await transaction((client) => recordReadOn(client, accountId, read)).catch(() => null);
}

export async function recordReadOn(client: Runner, accountId: string, read: ReadRecord): Promise<void> {
  /*  THE INSERT DECIDES WHETHER A SLIP IS SPENT. `returning` after `on
      conflict do nothing` yields a row only when one was actually written, so
      a retry that lands on the same read id, which is the image hash, adds no
      second charge. That is the whole guard and it is one statement: a count
      kept apart from the evidence for it drifts, and this counter drifting is
      what let the trial run for ever. */
  const inserted = await client.query<{ read_id: string }>(
    `insert into slip_reads
       (read_id, account_id, sha256, bookmaker_id, ok, model, input_tokens, output_tokens)
     values ($1,$2,$3,$4,$5,$6,$7,$8)
     on conflict (account_id, read_id) do nothing
     returning read_id`,
    [
      read.readId, accountId, read.sha256, read.bookmakerId, read.ok,
      read.cost?.model ?? null, read.cost?.inputTokens ?? 0, read.cost?.outputTokens ?? 0,
    ],
  );
  if (!read.ok || !inserted.rows.length) return;
  await client.query(
    'update accounts set trial_slips_used = trial_slips_used + 1, updated_at = now() where id = $1',
    [accountId],
  );
}

export type RefundOutcome =
  | { ok: true; credited: boolean; message: string }
  | { ok: false; reason: 'not_found'; message: string };

/** Flag a misread slip and return the credit, once.
 *
 *  The read has to exist and to belong to this account. Anything else and the
 *  answer is that it is not one of yours, rather than a refund for a UUID
 *  somebody typed. */
export async function refundRead(accountId: string, readId: string): Promise<RefundOutcome> {
  if (!hasDatabase()) {
    return {
      ok: true,
      credited: false,
      message: 'Flagged on this page only: this deployment has no database, so there is no allowance to credit.',
    };
  }

  return transaction((client) => refundReadOn(client, accountId, readId)).catch(() => ({
    ok: true as const,
    credited: false,
    message: 'That did not reach the store, so nothing was flagged and no allowance was changed.',
  }));
}

/** The refund, on any runner. ONCE PER READ: the second call finds
 *  refunded_at already set and says so rather than paying out again. */
export async function refundReadOn(client: Runner, accountId: string, readId: string): Promise<RefundOutcome> {
  const found = await client.query<{ refunded_at: string | null }>(
    'select refunded_at from slip_reads where account_id = $1 and read_id = $2 for update',
    [accountId, readId],
  );
  if (!found.rows.length) {
    return {
      ok: false,
      reason: 'not_found',
      message: 'That read is not one of yours, so nothing was flagged and no allowance was changed.',
    };
  }

  await client.query(
    'update slip_reads set flagged_at = coalesce(flagged_at, now()) where account_id = $1 and read_id = $2',
    [accountId, readId],
  );

  /*  ONCE PER READ, NOT ONCE PER PRESS. refunded_at is the whole guard: it
      can only be filled in once, so a second press is answered honestly
      rather than paid out. The route this replaced decremented the counter on
      every call, which is an unbounded free allowance behind a button. */
  if (found.rows[0].refunded_at) {
    return {
      ok: true,
      credited: false,
      message: 'This read was already flagged and its slip has already gone back to your allowance. It is credited once, not once per press.',
    };
  }

  await client.query(
    'update slip_reads set refunded_at = now() where account_id = $1 and read_id = $2',
    [accountId, readId],
  );
  await client.query(
    `update accounts set trial_slips_used = greatest(0, trial_slips_used - 1), updated_at = now()
      where id = $1`,
    [accountId],
  );
  await client.query(
    `insert into audit_log (account_id, entity, entity_id, action, source)
     values ($1, 'slip_read', $2, 'flagged', 'you')`,
    [accountId, readId],
  );
  return {
    ok: true,
    credited: true,
    message: 'Flagged. The slip is back in your allowance and the read is kept, marked as misread.',
  };
}
