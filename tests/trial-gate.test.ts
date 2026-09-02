import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { decideGate, type GateRow } from '@/lib/server/gate';
import { recordReadOn, refundReadOn, type Runner } from '@/lib/server/reads';
import { TRIAL_DAYS, TRIAL_SLIPS, trialState } from '@/lib/domain/trial';
import { REFUSAL_COPY } from '@/lib/data/read';

/** THE TRIAL, AND THE ONE CALL THAT COSTS MONEY.
 *
 *  trial_slips_used was written in exactly one place in the repository and
 *  that place decremented it. /api/extract checked no plan, no trial and no
 *  read-only state. /api/reads/flag refunded a slip on every press against a
 *  read id it never checked existed. All three are the same hole with three
 *  edges, and these are the tests that hold each one shut. */

const NOW = new Date('2026-09-02T12:00:00Z');
const inDays = (n: number) => new Date(NOW.getTime() + n * 86400000).toISOString();

const row = (over: Partial<GateRow> = {}): GateRow => ({
  plan_state: 'trial',
  trial_ends_at: inDays(7),
  trial_slips_allowed: TRIAL_SLIPS,
  trial_slips_used: 0,
  ...over,
});

// ---------------------------------------------------------------- the gate

test('a trial with days and slips left may read a slip', () => {
  const g = decideGate(row(), NOW);
  assert.equal(g.allowed, true);
});

test('a trial with every slip used is refused, and says it was the slips', () => {
  const g = decideGate(row({ trial_slips_used: TRIAL_SLIPS }), NOW);
  assert.equal(g.allowed, false);
  if (g.allowed) return;
  assert.equal(g.reason, 'trial_spent');
  assert.equal(g.trial?.ranOutOn, 'slips');
  assert.match(g.message, new RegExp(`All ${TRIAL_SLIPS} trial slips used`));
});

test('a trial past its last day is refused, and says it was the days', () => {
  const g = decideGate(row({ trial_ends_at: inDays(-1) }), NOW);
  assert.equal(g.allowed, false);
  if (g.allowed) return;
  assert.equal(g.reason, 'trial_spent');
  assert.equal(g.trial?.ranOutOn, 'days');
  assert.match(g.message, new RegExp(`${TRIAL_DAYS} day trial has ended`));
});

test('the last slip is allowed and the one after it is not', () => {
  assert.equal(decideGate(row({ trial_slips_used: TRIAL_SLIPS - 1 }), NOW).allowed, true);
  assert.equal(decideGate(row({ trial_slips_used: TRIAL_SLIPS }), NOW).allowed, false);
});

test('a read only account is refused whatever its trial says', () => {
  for (const state of ['read_only', 'cancelled']) {
    const g = decideGate(row({ plan_state: state }), NOW);
    assert.equal(g.allowed, false, `${state} was allowed to read a slip`);
    if (g.allowed) continue;
    assert.equal(g.reason, 'read_only');
    assert.match(g.message, /ledger/, 'a refusal must say what still works');
  }
});

test('a paying account has no slip ceiling, and one failed payment is still paying', () => {
  for (const state of ['active', 'past_due']) {
    const g = decideGate(row({ plan_state: state, trial_slips_used: 9999, trial_ends_at: inDays(-100) }), NOW);
    assert.equal(g.allowed, true, `${state} was blocked`);
    if (!g.allowed) continue;
    assert.equal(g.paid, true);
  }
});

test('the gate quotes trialState and never assembles a sentence of its own', () => {
  const spent = row({ trial_slips_used: TRIAL_SLIPS });
  const g = decideGate(spent, NOW);
  const t = trialState({
    trialEndsAt: spent.trial_ends_at!,
    trialSlipsAllowed: spent.trial_slips_allowed,
    trialSlipsUsed: spent.trial_slips_used,
  }, NOW);
  if (g.allowed) throw new Error('expected a refusal');
  assert.equal(g.message, t.message, 'two places would be two answers');
});

test('both refusals the gate can produce have copy that says what still works', () => {
  for (const r of ['trial_spent', 'read_only'] as const) {
    const c = REFUSAL_COPY[r];
    assert.ok(c.tag === c.tag.toUpperCase() && c.tag.length > 2);
    assert.ok(c.fix.length > 20, `${r} is a dead end`);
    assert.match(c.message, /ledger|history|charged/, `${r} does not say what is untouched`);
  }
});

// ------------------------------------------------------------- the counter

/** A tiny stand-in for the two tables these functions touch, so the rules can
 *  be tested as rules. It models only what the statements actually do. */
function fakeStore(seed: { reads?: Record<string, { refundedAt: string | null }>; used?: number } = {}) {
  const reads = new Map(Object.entries(seed.reads ?? {}));
  let used = seed.used ?? 0;
  let audits = 0;
  const client: Runner = {
    async query<R>(text: string, params: unknown[] = []): Promise<{ rows: R[] }> {
      const sql = text.replace(/\s+/g, ' ').trim();
      const id = String(params[0] === 'acc' ? params[1] : params[0]);
      if (sql.startsWith('insert into slip_reads')) {
        const readId = String(params[0]);
        if (reads.has(readId)) return { rows: [] as R[] };
        reads.set(readId, { refundedAt: null });
        return { rows: [{ read_id: readId }] as R[] };
      }
      if (sql.startsWith('select refunded_at from slip_reads')) {
        const r = reads.get(String(params[1]));
        return { rows: (r ? [{ refunded_at: r.refundedAt }] : []) as R[] };
      }
      if (sql.startsWith('update slip_reads set refunded_at')) {
        const r = reads.get(String(params[1]));
        if (r) r.refundedAt = '2026-09-02T00:00:00Z';
        return { rows: [] as R[] };
      }
      if (sql.startsWith('update slip_reads set flagged_at')) return { rows: [] as R[] };
      if (sql.includes('trial_slips_used = trial_slips_used + 1')) { used += 1; return { rows: [] as R[] }; }
      if (sql.includes('trial_slips_used - 1')) { used = Math.max(0, used - 1); return { rows: [] as R[] }; }
      if (sql.startsWith('insert into audit_log')) { audits += 1; return { rows: [] as R[] }; }
      throw new Error(`unexpected statement: ${sql.slice(0, 60)} (${id})`);
    },
  };
  return { client, reads, audits: () => audits, used: () => used };
}

test('a successful read spends exactly one slip', async () => {
  const s = fakeStore();
  await recordReadOn(s.client, 'acc', { readId: 'r1', sha256: 'h', bookmakerId: 'bet365', ok: true });
  assert.equal(s.used(), 1);
});

test('a read that failed costs nobody a slip, and is still recorded for its cost', async () => {
  const s = fakeStore();
  await recordReadOn(s.client, 'acc', {
    readId: 'r1', sha256: 'h', bookmakerId: null, ok: false,
    cost: { inputTokens: 1500, outputTokens: 300, model: 'm' },
  });
  assert.equal(s.used(), 0, 'our worst moment with the reader charged them a slip');
  assert.equal(s.reads.size, 1, 'the cost was not recorded, so nobody can add it up');
});

test('a retried read lands once, however many times it arrives', async () => {
  const s = fakeStore();
  const read = { readId: 'r1', sha256: 'h', bookmakerId: 'bet365', ok: true };
  await recordReadOn(s.client, 'acc', read);
  await recordReadOn(s.client, 'acc', read);
  await recordReadOn(s.client, 'acc', read);
  assert.equal(s.used(), 1);
});

// -------------------------------------------------------------- the refund

test('a flag returns the credit exactly once, however many times it is pressed', async () => {
  const s = fakeStore({ reads: { r1: { refundedAt: null } }, used: 5 });

  const first = await refundReadOn(s.client, 'acc', 'r1');
  assert.equal(first.ok, true);
  assert.equal(first.ok && first.credited, true);
  assert.equal(s.used(), 4);

  for (let i = 0; i < 20; i++) {
    const again = await refundReadOn(s.client, 'acc', 'r1');
    assert.equal(again.ok, true);
    assert.equal(again.ok && again.credited, false, 'the twentieth press paid out again');
  }
  assert.equal(s.used(), 4, 'twenty presses refunded twenty slips');
});

test('a read that is not yours refunds nothing and says so', async () => {
  const s = fakeStore({ used: 5 });
  const out = await refundReadOn(s.client, 'acc', 'somebody-elses');
  assert.equal(out.ok, false);
  assert.equal(s.used(), 5);
  assert.match(out.message, /not one of yours/);
});

// --------------------------------------------------------------- structural

const EXTRACT = readFileSync('app/api/extract/route.ts', 'utf8');
const FLAG = readFileSync('app/api/reads/flag/route.ts', 'utf8');

test('extract gates on the plan, the trial and read only before it calls the model', () => {
  assert.match(EXTRACT, /slipGate/);
  assert.ok(
    EXTRACT.indexOf('slipGate') < EXTRACT.indexOf('await readSlip('),
    'the gate must run before the call that costs money',
  );
  assert.match(EXTRACT, /refuse\(402/, 'a spent trial is a 402, not a 401 or a 403');
});

test('extract spends a slip on a read that worked, and on nothing else', () => {
  assert.match(EXTRACT, /recordRead\(/);
  const okCall = EXTRACT.indexOf('ok: true,\n      cost: outcome.cost');
  assert.ok(okCall > 0, 'no successful read is recorded');
  assert.match(EXTRACT, /ok: false, cost: outcome\.cost/, 'a failed read is not recorded for its cost');
});

test('the flag route no longer touches the counter itself', () => {
  assert.doesNotMatch(FLAG, /trial_slips_used/, 'the route decrements the counter directly again');
  assert.match(FLAG, /refundRead/);
  assert.match(FLAG, /404/, 'a read that is not yours must not be a silent success');
});

test('the trial numbers live in one file and are not repeated in the gate', () => {
  const gate = readFileSync('lib/server/gate.ts', 'utf8');
  assert.doesNotMatch(gate, /\b35\b|\b14\b/, 'the trial numbers were copied into the gate');
  assert.match(gate, /trialState/);
});

test('the upload control is gated by the same rule the route uses', () => {
  /*  The dropzone was enabled off `trial.active` alone. That is false for
   *  every paying account the day its trial window passes, so wiring the
   *  control to it would have locked a customer out of the feature they pay
   *  for. Both sides ask lib/server/gate.ts. */
  const importPage = readFileSync('app/app/import/page.tsx', 'utf8');
  assert.match(importPage, /slips\.allowed/);
  assert.doesNotMatch(importPage, /enabled=\{[^}]*trial\.active/);
  const session = readFileSync('lib/data/session.ts', 'utf8');
  assert.match(session, /decideGate/);
});
