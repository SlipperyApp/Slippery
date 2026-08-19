import { test } from 'node:test';
import assert from 'node:assert/strict';
import { afterPaymentFailure, canDo, PRICES, PLAN_AT_TRIAL_END, FAILURES_BEFORE_READ_ONLY } from '../lib/server/billing.ts';

test('the first failure retries in three days rather than locking anything', () => {
  const r = afterPaymentFailure(1);
  assert.equal(r.planState, 'past_due');
  assert.ok(r.retryAt);
  assert.match(r.message, /3 days/);
});

test('two failures go read only, and say what still works', () => {
  const r = afterPaymentFailure(FAILURES_BEFORE_READ_ONLY);
  assert.equal(r.planState, 'read_only');
  assert.match(r.message, /ledger and export still work/i);
});

/* THE RULE THAT MUST NEVER BE BROKEN. */
test('read only never touches betting history and never blocks export', () => {
  assert.equal(canDo('viewLedger', 'read_only'), true);
  assert.equal(canDo('export', 'read_only'), true);
  assert.equal(canDo('editSettings', 'read_only'), true);
});

test('read only pauses the things that cost money', () => {
  for (const action of ['logNewBet', 'importHistory', 'readSlips', 'bot'] as const) {
    assert.equal(canDo(action, 'read_only'), false, action + ' should pause');
  }
});

test('an account in good standing can do everything', () => {
  for (const action of ['logNewBet', 'readSlips', 'bot', 'export'] as const) {
    assert.equal(canDo(action, 'active'), true);
    assert.equal(canDo(action, 'trialing'), true);
  }
});

test('the prices are the ones on the plan screen', () => {
  assert.equal(PRICES.monthly.pence, 349);
  assert.equal(PRICES.yearly.pence, 2999);
  assert.equal(PRICES.yearly.was, 3499);
  /* The struck-through price and the saving have to agree, or the pill is a
     claim the numbers do not support. */
  assert.equal(PRICES.monthly.pence * 12 - PRICES.yearly.pence, 1189);
  assert.equal(PRICES.yearly.saves, '£11.89 a year');
});

test('a trial nobody acts on rolls into the yearly plan', () => {
  assert.equal(PLAN_AT_TRIAL_END, 'yearly');
});
