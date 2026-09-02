import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  money, pl, units, pct, count, shortDate, longDate, dayKey, timeOfDay,
  axisMoney, axisMonth, position, initials, daysUntil, ewTerms,
  zonedParts, startOfDay, isKnownTimeZone, DEFAULT_TZ,
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

test('a 23:00 UTC bet in summer lands on the NEXT UK day', () => {
  // Europe/London is UTC+1 in August, so 23:30Z is 00:30 the following day.
  assert.equal(dayKey('2026-08-12T23:30:00Z', DEFAULT_TZ), '2026-08-13');
  assert.equal(timeOfDay('2026-08-12T23:30:00Z'), '00:30');
});

test('a winter timestamp stays on its own day', () => {
  assert.equal(dayKey('2026-01-12T23:30:00Z', DEFAULT_TZ), '2026-01-12');
  assert.equal(timeOfDay('2026-01-12T23:30:00Z'), '23:30');
});

/*  ------------------------------------------------------ the account's zone
 *
 *  THE BET AT 23:40, which is the case the whole zone change is for. One
 *  instant, read by three accounts, is three different calendar days, and
 *  every one of those three answers is right for the person reading it. */

const AT_2340_IRISH_SUMMER = '2026-08-12T22:40:00Z';   // 23:40 in Dublin, 22:40 UTC

test('a 23:40 bet lands on the day it was 23:40 on, in whichever zone the account keeps', () => {
  assert.equal(dayKey(AT_2340_IRISH_SUMMER, 'Europe/Dublin'), '2026-08-12');
  assert.equal(timeOfDay(AT_2340_IRISH_SUMMER, 'Europe/Dublin'), '23:40');

  // The same instant is 22:40 in UTC, still the 12th, and 00:40 on the 13th
  // in Madrid, which is an hour further on.
  assert.equal(dayKey(AT_2340_IRISH_SUMMER, 'UTC'), '2026-08-12');
  assert.equal(dayKey(AT_2340_IRISH_SUMMER, 'Europe/Madrid'), '2026-08-13');
  assert.equal(timeOfDay(AT_2340_IRISH_SUMMER, 'Europe/Madrid'), '00:40');
});

test('a 23:40 bet in Sydney is already tomorrow to a UTC server', () => {
  // 23:40 on the 12th in Sydney is 13:40 UTC on the 12th; the interesting
  // direction is the other one, where a UTC afternoon is a Sydney night.
  const utcLateEvening = '2026-08-12T23:40:00Z';
  assert.equal(dayKey(utcLateEvening, 'UTC'), '2026-08-12');
  assert.equal(dayKey(utcLateEvening, 'Australia/Sydney'), '2026-08-13');
  assert.equal(timeOfDay(utcLateEvening, 'Australia/Sydney'), '09:40');
});

test('startOfDay is the instant local midnight actually happens at', () => {
  /*  The defect this replaces: Date.UTC on the zoned year, month and day,
   *  which is midnight UTC and an hour late for anywhere on summer time. */
  assert.equal(startOfDay(2026, 8, 13, 'Europe/London').toISOString(), '2026-08-12T23:00:00.000Z');
  assert.equal(startOfDay(2026, 1, 13, 'Europe/London').toISOString(), '2026-01-13T00:00:00.000Z');
  assert.equal(startOfDay(2026, 8, 13, 'Europe/Madrid').toISOString(), '2026-08-12T22:00:00.000Z');
  assert.equal(startOfDay(2026, 8, 13, 'UTC').toISOString(), '2026-08-13T00:00:00.000Z');
});

test('startOfDay survives the clocks going forward and back', () => {
  /*  Two passes, because the offset depends on the instant and the instant
   *  depends on the offset. British summer time starts at 01:00 on 29 March
   *  2026 and ends at 02:00 on 25 October, so midnight on each of those days
   *  is on the old offset and midday is on the new one. */
  assert.equal(startOfDay(2026, 3, 29, 'Europe/London').toISOString(), '2026-03-29T00:00:00.000Z');
  assert.equal(startOfDay(2026, 3, 30, 'Europe/London').toISOString(), '2026-03-29T23:00:00.000Z');
  assert.equal(startOfDay(2026, 10, 25, 'Europe/London').toISOString(), '2026-10-24T23:00:00.000Z');
  assert.equal(startOfDay(2026, 10, 26, 'Europe/London').toISOString(), '2026-10-26T00:00:00.000Z');
});

test('the day a startOfDay begins is the day it is a start of', () => {
  // The round trip, in four zones, across a year. If these ever disagree the
  // period window and the calendar are filing the same bet under two days.
  for (const tz of ['Europe/London', 'Europe/Dublin', 'Europe/Madrid', 'Australia/Sydney', 'UTC']) {
    for (let m = 1; m <= 12; m++) {
      const key = `2026-${String(m).padStart(2, '0')}-01`;
      assert.equal(dayKey(startOfDay(2026, m, 1, tz), tz), key, `${tz} ${key}`);
    }
  }
});

test('zonedParts reads midnight as hour zero, never as hour 24', () => {
  const p = zonedParts('2026-08-12T23:00:00Z', 'Europe/London');
  assert.equal(p.hour, 0);
  assert.equal(p.day, 13);
});

test('a zone the platform cannot resolve is refused rather than stored', () => {
  assert.equal(isKnownTimeZone('Europe/Dublin'), true);
  assert.equal(isKnownTimeZone('UTC'), true);
  assert.equal(isKnownTimeZone('Middle/Earth'), false);
  assert.equal(isKnownTimeZone(''), false);
  assert.equal(isKnownTimeZone(null), false);
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

test('each way terms print as a slip prints them, and never half of themselves', () => {
  /*  "3rd of 12, places paid 1-3" needs both halves stored. A fifth the odds
   *  says nothing without the place count and the place count says nothing
   *  without the fraction, which is why places_paid went in beside
   *  ew_place_fraction rather than instead of it. */
  assert.equal(ewTerms(0.2, 3), '1/5, places 1-3');
  assert.equal(ewTerms(0.25, 4), '1/4, places 1-4');
  assert.equal(ewTerms(0.2, null), '1/5', 'a place count nobody read was invented');
  assert.equal(ewTerms(null, 3), 'places 1-3');
  assert.equal(ewTerms(null, null), '');
  assert.equal(ewTerms(0, 0), '');
});
