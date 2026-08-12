/* /api/bets validation.
 *
 * This is the gate between an OCR reading and a permanent financial record.
 * It rejects what is structurally impossible rather than what looks unusual:
 * a £2 bet at 501.0 is rare and real, a £2 bet at 0.4 is not a bet at all.
 * Getting that distinction wrong in either direction is a bug, one loses
 * real bets, the other corrupts the ledger with values the grader cannot
 * reason about.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { betProblem } from '../api/bets.js';
import { payoutFor, cashOutcome, ledgerOutcome } from '../src/js/settlement.js';

const ok = over => Object.assign({
  event: 'Arsenal v Chelsea', selection: 'Over 2.5 Goals',
  market: 'Over/Under', book: 'bet365', odds: 1.9, stakePence: 10000
}, over);

test('a well-formed bet is accepted', () => {
  assert.equal(betProblem(ok()), '');
});

test('a bet needs a stake, and the stake must be whole pence', () => {
  assert.notEqual(betProblem(ok({ stakePence: 0 })), '');
  assert.notEqual(betProblem(ok({ stakePence: -500 })), '');
  assert.notEqual(betProblem(ok({ stakePence: null })), '');
  assert.notEqual(betProblem(ok({ stakePence: 'lots' })), '');
  assert.notEqual(betProblem(ok({ stakePence: 10.5 })), '',
    'half a penny cannot be stored, and would round silently');
  assert.notEqual(betProblem(ok({ stakePence: Infinity })), '');
  assert.notEqual(betProblem(ok({ stakePence: NaN })), '');
});

test('odds below or at evens-against-nothing are refused', () => {
  assert.notEqual(betProblem(ok({ odds: 1 })), '', 'decimal odds of 1 return the stake and nothing else');
  assert.notEqual(betProblem(ok({ odds: 0.4 })), '');
  assert.notEqual(betProblem(ok({ odds: -2 })), '');
  assert.notEqual(betProblem(ok({ odds: 'evens' })), '');
});

test('long-shot odds are accepted, absurd ones are not', () => {
  assert.equal(betProblem(ok({ odds: 501 })), '', 'a 500/1 outright is a real bet');
  assert.equal(betProblem(ok({ odds: 1.01 })), '');
  assert.notEqual(betProblem(ok({ odds: 100000 })), '', 'that is a misread, not a price');
});

test('odds may be absent, a bet can be logged before the price is legible', () => {
  assert.equal(betProblem(ok({ odds: null })), '');
  assert.equal(betProblem(ok({ odds: undefined })), '');
});

test('a bet needs a selection', () => {
  assert.notEqual(betProblem(ok({ selection: '' })), '');
  assert.notEqual(betProblem(ok({ selection: '   ' })), '');
  assert.notEqual(betProblem(ok({ selection: null })), '');
});

test('oversized text is refused rather than silently truncated in the column', () => {
  assert.notEqual(betProblem(ok({ event: 'x'.repeat(500) })), '');
  assert.notEqual(betProblem(ok({ selection: 'x'.repeat(500) })), '');
  assert.notEqual(betProblem(ok({ book: 'x'.repeat(200) })), '');
});

test('a stake larger than the column can hold is refused', () => {
  /* stake_pence is a 4-byte integer. £1,000,000 is fine; something that
     would overflow the column must fail here, not in Postgres. */
  assert.equal(betProblem(ok({ stakePence: 100_000_000 })), '');
  assert.notEqual(betProblem(ok({ stakePence: 100_000_001 })), '');
});

test('a nonsense placedAt is refused', () => {
  assert.equal(betProblem(ok({ placedAt: '2026-08-09T19:00:00Z' })), '');
  assert.notEqual(betProblem(ok({ placedAt: 'last Tuesday' })), '');
});

test('nothing at all is refused', () => {
  assert.notEqual(betProblem(null), '');
  assert.notEqual(betProblem(undefined), '');
  assert.notEqual(betProblem('a bet'), '');
  assert.notEqual(betProblem({}), '');
});

/* ---- the arithmetic the endpoint performs ----
   Hand settlement must produce exactly what the automatic sweep would, or a
   ledger holds two kinds of penny. These assert the endpoint's formula
   (payout - stake) against the engine rather than restating it. */
test('hand settlement matches the engine to the penny', () => {
  const stake = 30618, odds = 1.25;
  assert.equal(payoutFor('won', stake, odds) - stake, 7655,
    'stake x (odds - 1), rounded once, not twice');
  assert.equal(payoutFor('lost', stake, odds) - stake, -stake, 'a loss is the whole stake');
  assert.equal(payoutFor('void', stake, odds) - stake, 0, 'void returns the stake, so zero profit');
});

test('a cash out is classified by what it actually returned', () => {
  const stake = 12000;
  assert.equal(cashOutcome(16820 - stake), 'cash-profit');
  assert.equal(cashOutcome(4000 - stake), 'cash-loss');
  assert.equal(cashOutcome(stake - stake), 'cash-flat');
});

test('the six ledger outcomes are the only ones the endpoint can store', () => {
  const allowed = new Set(['won', 'lost', 'void', 'cash-profit', 'cash-loss', 'cash-flat']);
  for (const kind of ['won', 'lost', 'void']) {
    assert.equal(allowed.has(ledgerOutcome(kind)), true, kind);
  }
  for (const p of [500, -500, 0]) assert.equal(allowed.has(cashOutcome(p)), true);
  /* And nothing else grades. A market the engine did not understand must
     not arrive here as a settlement. */
  assert.equal(ledgerOutcome('probably-won'), null);
});
