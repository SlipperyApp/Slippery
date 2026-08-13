/* Subscription rules.
 *
 * No payment processor is connected, so these are the rules rather than
 * the charging. That is deliberate: the rules are the part that decides
 * whether somebody keeps access to their own betting record, and they
 * should be settled and tested before any money moves, not written in a
 * hurry around a processor's callbacks.
 *
 * Three rules, from the owner:
 *   no card, no subscription
 *   two days after a charge is requested and unpaid, the account locks
 *   a monthly plan cancels free right up to the first charge
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { billingState, canSubscribe, firstChargeAt, GRACE_MS, lookup } from '../api/_lib/promo.js';

const T0 = new Date('2026-08-13T12:00:00Z');
const plus = (d, ms) => new Date(d.getTime() + ms);

test('a free account owes nothing and is not locked', () => {
  const s = billingState({ plan: 'free' }, T0);
  assert.equal(s.owes, false);
  assert.equal(s.locked, false);
  assert.equal(s.reason, 'ok');
});

test('a lifetime grant never owes anything', () => {
  const s = billingState({ plan: 'lifetime', chargeDueAt: '2020-01-01T00:00:00Z' }, T0);
  assert.equal(s.owes, false);
  assert.equal(s.locked, false);
  assert.equal(s.reason, 'lifetime');
});

test('a charge that is not yet due is not owed', () => {
  const s = billingState({ plan: 'monthly', chargeDueAt: plus(T0, 86400000).toISOString() }, T0);
  assert.equal(s.owes, false);
  assert.equal(s.locked, false);
});

test('a charge due and unpaid is owed but not yet locked', () => {
  const s = billingState({ plan: 'monthly', chargeDueAt: T0.toISOString() }, T0);
  assert.equal(s.owes, true);
  assert.equal(s.locked, false, 'the grace period has not run out');
  assert.equal(s.reason, 'due');
});

test('the account locks exactly two days after the charge was requested', () => {
  const due = T0.toISOString();
  const justBefore = billingState({ plan: 'monthly', chargeDueAt: due }, plus(T0, GRACE_MS - 1000));
  assert.equal(justBefore.locked, false, 'one second inside the window is still inside it');

  const atTheLimit = billingState({ plan: 'monthly', chargeDueAt: due }, plus(T0, GRACE_MS));
  assert.equal(atTheLimit.locked, true);
  assert.equal(atTheLimit.reason, 'unpaid');
});

test('paying clears the debt however late it was', () => {
  const due = T0.toISOString();
  const later = plus(T0, GRACE_MS * 3);
  const s = billingState(
    { plan: 'monthly', chargeDueAt: due, chargePaidAt: later.toISOString() },
    plus(later, 1000));
  assert.equal(s.owes, false);
  assert.equal(s.locked, false);
});

test('a payment made BEFORE the charge was requested does not clear it', () => {
  /* Last month's payment must not pay for this month. */
  const s = billingState({
    plan: 'monthly',
    chargePaidAt: plus(T0, -30 * 86400000).toISOString(),
    chargeDueAt: T0.toISOString()
  }, plus(T0, 1000));
  assert.equal(s.owes, true);
});

test('no card means no paid plan', () => {
  const r = canSubscribe({ cardAdded: false }, null);
  assert.equal(r.ok, false);
  assert.equal(r.why, 'card');
  assert.match(r.error, /payment method/i);
});

test('a card means a paid plan can start', () => {
  assert.equal(canSubscribe({ cardAdded: true }, null).ok, true);
});

test('a promo that grants months starts a plan without a card', () => {
  /* Nothing is charged until the free months run out, so asking for a card
     first is asking for a commitment nobody has been given a reason to
     make yet. */
  const r = canSubscribe({ cardAdded: false }, lookup('ULTRAS'));
  assert.equal(r.ok, true);
  assert.equal(r.why, 'promo');
});

test('ULTRAS is two free months and then the monthly rate', () => {
  const promo = lookup('ULTRAS');
  assert.equal(promo.plan, 'monthly');
  assert.equal(promo.months, 2);
  const due = firstChargeAt(promo, T0);
  assert.equal(due.getUTCMonth(), (T0.getUTCMonth() + 2) % 12,
    'the first charge falls two months out, not today');
});

test('a lifetime code never has a first charge', () => {
  assert.equal(firstChargeAt(lookup('AK5WRD'), T0), null);
});

test('a monthly plan cancels free right up to the first charge', () => {
  const before = billingState({ plan: 'monthly', chargeDueAt: plus(T0, 86400000).toISOString() }, T0);
  assert.equal(before.canCancelFree, true);
});

test('once charged, cancelling runs to the end of the paid period', () => {
  const after = billingState({
    plan: 'monthly',
    chargeDueAt: plus(T0, -86400000).toISOString(),
    chargePaidAt: plus(T0, -86400000).toISOString(),
    planUntil: plus(T0, 29 * 86400000).toISOString()
  }, T0);
  assert.equal(after.canCancelFree, false);
  assert.ok(after.until, 'the paid period has an end date to run to');
});

test('a free account cannot cancel free, because there is nothing to cancel', () => {
  assert.equal(billingState({ plan: 'free' }, T0).canCancelFree, false);
});
