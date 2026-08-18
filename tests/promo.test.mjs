/* Promo codes.
 *
 * The dates are the part worth testing. A gifted month added to an account
 * that already has one must extend it, not replace it, anything else
 * quietly takes time the person already paid for. And a lifetime code must
 * never produce an end date, because a date in the past is indistinguishable
 * from an expired plan.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  lookup, normalise, planUntil, unlimited, CODES,
  trialEnd, trialState, TRIAL_DAYS, TRIAL_SLIPS,
  billingState, canSubscribe, firstChargeAt
} from '../api/_lib/promo.js';

test('codes are matched however they are typed', () => {
  assert.equal(normalise('ak5 wrd'), 'AK5WRD');
  assert.equal(normalise('AK5-WRD'), 'AK5WRD');
  assert.equal(normalise('  ultras  '), 'ULTRAS');
  assert.equal(normalise(null), '');
});

test('the two named codes are what the owner asked for', () => {
  assert.equal(lookup('AK5WRD').plan, 'lifetime');
  assert.equal(lookup('AK5WRD').months, undefined, 'lifetime has no month count');
  assert.equal(lookup('ULTRAS').plan, 'monthly');
  assert.equal(lookup('ULTRAS').months, 2);
});

test('an unknown code is null, never a silent free plan', () => {
  assert.equal(lookup('NOPE'), null);
  assert.equal(lookup(''), null);
  assert.equal(lookup(undefined), null);
  /* Object.prototype keys must not resolve as codes. */
  assert.equal(lookup('constructor'), null);
  assert.equal(lookup('toString'), null);
});

test('lifetime never gets an end date', () => {
  assert.equal(planUntil(lookup('AK5WRD')), null);
  assert.equal(planUntil(lookup('AK5WRD'), new Date('2026-08-12T00:00:00Z'),
    new Date('2027-01-01T00:00:00Z')), null, 'not even over an existing date');
});

test('two months from now is two months from now', () => {
  const from = new Date('2026-08-12T00:00:00Z');
  assert.equal(planUntil(lookup('ULTRAS'), from).toISOString().slice(0, 10), '2026-10-12');
});

test('a gift extends an existing plan rather than truncating it', () => {
  const from = new Date('2026-08-12T00:00:00Z');
  const existing = new Date('2026-12-01T00:00:00Z');
  const out = planUntil(lookup('GIFT1'), from, existing);
  assert.equal(out.toISOString().slice(0, 10), '2027-01-01',
    'a month on top of December, not a month from today');
});

test('an expired plan is not extended from its own past', () => {
  const from = new Date('2026-08-12T00:00:00Z');
  const expired = new Date('2026-02-01T00:00:00Z');
  const out = planUntil(lookup('GIFT1'), from, expired);
  assert.equal(out.toISOString().slice(0, 10), '2026-09-12', 'runs from today');
});

test('unlimited is decided by plan and date together', () => {
  const now = new Date('2026-08-12T00:00:00Z');
  assert.equal(unlimited('free', null, now), false);
  assert.equal(unlimited(undefined, null, now), false);
  assert.equal(unlimited('lifetime', null, now), true);
  assert.equal(unlimited('monthly', new Date('2026-09-01T00:00:00Z'), now), true);
  assert.equal(unlimited('monthly', new Date('2026-08-01T00:00:00Z'), now), false, 'expired');
  assert.equal(unlimited('yearly', null, now), true, 'paid with no end recorded');
});

test('ULTRAS carries the tick and the others do not', () => {
  assert.equal(lookup('ULTRAS').verify, true);
  for (const code of ['AK5WRD', 'GIFT1', 'GIFT2']) {
    assert.ok(!lookup(code).verify, code + ' must not hand out a verified tick');
  }
});

/* ---- the free trial ---- */

test('the trial is two weeks and 35 slips', () => {
  assert.equal(TRIAL_DAYS, 14);
  assert.equal(TRIAL_SLIPS, 35);
  const from = new Date('2026-08-12T00:00:00Z');
  assert.equal(trialEnd(from).toISOString().slice(0, 10), '2026-08-26');
});

test('a trial with time and slips left is active', () => {
  const now = new Date('2026-08-12T00:00:00Z');
  const s = trialState({ slipsUsed: 4, trialEndsAt: '2026-08-17T00:00:00Z' }, now);
  assert.equal(s.active, true);
  assert.equal(s.over, null);
  assert.equal(s.slipsLeft, 31);
  assert.equal(s.daysLeft, 5);
});

test('running out of slips and running out of time are different answers', () => {
  const now = new Date('2026-08-12T00:00:00Z');
  const bySlips = trialState({ slipsUsed: 35, trialEndsAt: '2026-08-26T00:00:00Z' }, now);
  assert.equal(bySlips.over, 'slips', 'so the prompt can say which limit it was');
  assert.equal(bySlips.active, false);

  const byTime = trialState({ slipsUsed: 2, trialEndsAt: '2026-08-11T00:00:00Z' }, now);
  assert.equal(byTime.over, 'time');
  assert.equal(byTime.active, false);
  assert.equal(byTime.daysLeft, 0, 'never negative');
});

test('an account from before the trial existed is not retroactively expired', () => {
  const s = trialState({ slipsUsed: 3, trialEndsAt: null }, new Date());
  assert.equal(s.active, true);
  assert.equal(s.endsAt, null);
  assert.equal(s.daysLeft, null);
});

test('slips left never goes negative', () => {
  const s = trialState({ slipsUsed: 99, trialEndsAt: '2099-01-01T00:00:00Z' });
  assert.equal(s.slipsLeft, 0);
});

test('every code declares a plan the entitlement check understands', () => {
  for (const [code, spec] of Object.entries(CODES)) {
    assert.ok(['lifetime', 'monthly', 'yearly'].includes(spec.plan), code + ' has an odd plan');
    assert.equal(unlimited(spec.plan, planUntil(lookup(code)), new Date()), true,
      code + ' must actually grant unlimited slips');
    assert.ok(spec.label && spec.note, code + ' needs wording for the UI');
  }
});

/* ---------------- the two group codes and the admin grant ---------------- */

test('HBVALUE is the same shape as ULTRAS, which is the point of the field', () => {
  const hb = lookup('HBVALUE');
  assert.equal(hb.plan, 'monthly');
  assert.equal(hb.months, 2);
  assert.equal(hb.group, 'HBValue');
  /* ensurePromoGroup does the group work for anything carrying `group`, so
     a second group code is a row rather than a code path. */
  const ultras = lookup('ULTRAS');
  assert.equal(typeof ultras.group, typeof hb.group);
});

test('a group code grants two months and then ordinary billing', () => {
  for (const code of ['ULTRAS', 'HBVALUE']) {
    const p = lookup(code);
    const from = new Date('2026-01-15T00:00:00Z');
    const until = planUntil(p, from);
    assert.equal(until.toISOString().slice(0, 10), '2026-03-15');
    /* And the first charge is at the end of the free months, not today. */
    assert.equal(firstChargeAt(p, from).toISOString(), until.toISOString());
  }
});

test('the admin code is a year, and it does not roll into a charge', () => {
  /* This is the requirement that needed a new property. Every other paid
     code is "free months, then billing picks up", which is right for a
     promotion and wrong for a grant: nobody handed a free year has agreed
     to pay for a second one. */
  const codes = Object.keys(CODES).filter(c => CODES[c].renews === false);
  assert.equal(codes.length, 1, 'exactly one non-renewing grant');
  const admin = lookup(codes[0]);
  assert.equal(admin.plan, 'yearly');
  assert.equal(admin.months, 12);
  assert.equal(firstChargeAt(admin, new Date()), null, 'a grant has no first charge');
});

test('the admin code is not a word anybody would try', () => {
  const code = Object.keys(CODES).find(c => CODES[c].renews === false);
  assert.ok(code.length >= 14, 'short enough to guess is short enough to be guessed');
  assert.match(code, /[0-9]/, 'not a dictionary word');
});

test('a granted account owes nothing, and lapses to free rather than to a debt', () => {
  const until = new Date(Date.now() + 300 * 86400000).toISOString();
  const state = billingState({ plan: 'yearly', planUntil: until, cardAdded: false });
  assert.equal(state.owes, false);
  assert.equal(state.locked, false);
  assert.equal(state.dueAt, null, 'no due date means nothing can fall due');
  assert.equal(state.reason, 'granted');
  /* And it is distinguishable from lifetime, which is a different promise. */
  assert.notEqual(state.reason, 'lifetime');
});

test('an ordinary unpaid month still falls due, so the grant rule is not a hole', () => {
  const state = billingState({
    plan: 'monthly',
    chargeDueAt: new Date(Date.now() - 1000).toISOString()
  });
  assert.equal(state.owes, true);
  assert.equal(state.reason, 'due');
});

test('a promo starts a paid plan with no card, and only a promo does', () => {
  assert.equal(canSubscribe({ cardAdded: false }, lookup('HBVALUE')).ok, true);
  assert.equal(canSubscribe({ cardAdded: false }, null).ok, false);
});
