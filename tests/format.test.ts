import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  money, pl, units, pct, count, shortDate, longDate, londonDay, timeOfDay,
  axisMoney, axisMonth, position, initials, daysUntil,
} from '@/lib/format';
import { trialState, TRIAL_DAYS, TRIAL_SLIPS } from '@/lib/domain/trial';

test('money is always 2dp, totals included', () => {
  assert.equal(money(0), '£0.00');
  assert.equal(money(500), '£5.00');
  assert.equal(money(-2550), '-£25.50');
  assert.equal(money(123456789), '£1,234,567.89');
});

test('a thousands separator appears above 999', () => {
  assert.equal(money(99999), '£999.99');
  assert.equal(money(100000), '£1,000.00');
});

test('euros are a first class currency, not a pound with a different symbol', () => {
  assert.equal(money(2500, 'EUR'), '€25.00');
  assert.equal(money(-2500, 'EUR'), '-€25.00');
});

test('a signed profit always carries its sign', () => {
  assert.equal(pl(1234), '+£12.34');
  assert.equal(pl(-1234), '-£12.34');
  assert.equal(pl(0), '+£0.00');
});

test('units are 2dp, except on a league surface which uses 1dp', () => {
  assert.equal(units(1.234), '1.23u');
  assert.equal(units(1.234, { league: true }), '1.2u');
  assert.equal(units(-1.235, { sign: true }), '-1.24u');
  assert.equal(units(1.2, { sign: true }), '+1.20u');
});

test('percentages are 1dp', () => {
  assert.equal(pct(12.345), '12.3%');
  assert.equal(pct(-4), '-4.0%');
  assert.equal(pct(7.25, { sign: true }), '+7.3%');
});

test('axis labels are 0dp', () => {
  assert.equal(axisMoney(123456), '£1.2k');
  assert.equal(axisMoney(4900), '£49');
  assert.equal(axisMoney(-4900), '-£49');
});

test('counts carry a thousands separator', () => {
  assert.equal(count(1234), '1,234');
});

test('dates are day first, always', () => {
  const now = new Date('2026-08-31T12:00:00Z');
  assert.equal(shortDate('2026-08-12T10:00:00Z', now), '12 Aug');
  assert.equal(shortDate('2025-08-12T10:00:00Z', now), '12 Aug 2025');
  assert.equal(longDate('2025-08-12T10:00:00Z'), '12 Aug 2025');
  assert.equal(axisMonth('2026-08-12T10:00:00Z'), 'Aug');
});

test('a 23:00 UTC bet in summer lands on the NEXT London day', () => {
  // Europe/London is UTC+1 in August, so 23:30Z is 00:30 the following day.
  assert.equal(londonDay('2026-08-12T23:30:00Z'), '2026-08-13');
  assert.equal(timeOfDay('2026-08-12T23:30:00Z'), '00:30');
});

test('a winter timestamp stays on its own day', () => {
  assert.equal(londonDay('2026-01-12T23:30:00Z'), '2026-01-12');
  assert.equal(timeOfDay('2026-01-12T23:30:00Z'), '23:30');
});

test('a position reads as a place out of a field', () => {
  assert.equal(position(4, 12), '4 of 12');
});

test('initials never return an empty string', () => {
  assert.equal(initials('Rowan Ellis'), 'RE');
  assert.equal(initials(''), '?');
});

test('days until never goes negative', () => {
  const now = new Date('2026-08-31T12:00:00Z');
  assert.equal(daysUntil('2026-08-01T12:00:00Z', now), 0);
  assert.equal(daysUntil('2026-09-05T12:00:00Z', now), 5);
});

// -------------------------------------------------------------- trial

test('the trial is 14 days or 35 slips, and one function owns both numbers', () => {
  assert.equal(TRIAL_DAYS, 14);
  assert.equal(TRIAL_SLIPS, 35);
});

test('the trial reports WHICH half ran out', () => {
  const now = new Date('2026-08-31T12:00:00Z');
  const daysGone = trialState({ trialEndsAt: '2026-08-20T12:00:00Z', trialSlipsAllowed: 35, trialSlipsUsed: 3 }, now);
  assert.equal(daysGone.active, false);
  assert.equal(daysGone.ranOutOn, 'days');

  const slipsGone = trialState({ trialEndsAt: '2026-09-20T12:00:00Z', trialSlipsAllowed: 35, trialSlipsUsed: 35 }, now);
  assert.equal(slipsGone.active, false);
  assert.equal(slipsGone.ranOutOn, 'slips');
  assert.match(slipsGone.message, /35 trial slips/);
});

test('a running trial reports both numbers in one sentence', () => {
  const now = new Date('2026-08-31T12:00:00Z');
  const s = trialState({ trialEndsAt: '2026-09-09T12:00:00Z', trialSlipsAllowed: 35, trialSlipsUsed: 12 }, now);
  assert.equal(s.active, true);
  assert.equal(s.daysLeft, 9);
  assert.equal(s.slipsLeft, 23);
  assert.match(s.message, /9 days left/);
  assert.match(s.message, /23 more slips/);
});
