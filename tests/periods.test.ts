import { test } from 'node:test';
import assert from 'node:assert/strict';
import { periodRange, londonDateKey, DAY_LETTERS, londonDayStart } from '../lib/server/periods.ts';

test('a 00:30 kick-off belongs to the day the fixture is listed under', () => {
  /* British Summer Time. 00:30 London on 20 August is 23:30 UTC on the 19th,
     and bucketing in UTC would put it in the wrong square. */
  assert.equal(londonDateKey(new Date('2026-08-19T23:30:00Z')), '2026-08-20');
  /* And in winter, when London is UTC, the same instant is the same day. */
  assert.equal(londonDateKey(new Date('2026-01-19T23:30:00Z')), '2026-01-19');
});

test('the day starts at London midnight, not at UTC midnight', () => {
  const start = londonDayStart(new Date('2026-08-19T12:00:00Z'));
  assert.equal(start.toISOString(), '2026-08-18T23:00:00.000Z');
});

test('week start moves the week, so the total and the calendar agree', () => {
  const wed = new Date('2026-08-19T12:00:00Z');
  const mon = periodRange('W', 1, null, null, wed);
  const sun = periodRange('W', 0, null, null, wed);
  assert.equal(londonDateKey(mon.from), '2026-08-17', 'Monday start');
  assert.equal(londonDateKey(sun.from), '2026-08-16', 'Sunday start');
  assert.notEqual(mon.from.getTime(), sun.from.getTime());
});

test('week start reorders the day letters', () => {
  assert.deepEqual(DAY_LETTERS(1), ['M', 'T', 'W', 'T', 'F', 'S', 'S']);
  assert.deepEqual(DAY_LETTERS(0), ['S', 'M', 'T', 'W', 'T', 'F', 'S']);
});

test('a month runs from its first London midnight to its last London instant', () => {
  const r = periodRange('M', 1, null, null, new Date('2026-08-19T12:00:00Z'));
  assert.equal(londonDateKey(r.from), '2026-08-01');
  assert.equal(londonDateKey(r.to), '2026-08-31');
});

test('a year is a year', () => {
  const r = periodRange('Y', 1, null, null, new Date('2026-08-19T12:00:00Z'));
  assert.equal(londonDateKey(r.from), '2026-01-01');
  assert.equal(londonDateKey(r.to), '2026-12-31');
});

test('the clocks going forward does not shorten the day', () => {
  /* 29 March 2026, the day BST begins. A day computed as start + 24 hours
     would end an hour early and drop the last hour of bets. */
  const r = periodRange('today', 1, null, null, new Date('2026-03-29T12:00:00Z'));
  assert.equal(londonDateKey(r.from), '2026-03-29');
  assert.equal(londonDateKey(r.to), '2026-03-29');
  assert.equal(Math.round((r.to.getTime() - r.from.getTime()) / 3600000), 23);
});

test('a custom period is honoured exactly as given', () => {
  const r = periodRange('custom', 1, '2026-01-01T00:00:00Z', '2026-02-01T00:00:00Z');
  assert.equal(r.from.toISOString(), '2026-01-01T00:00:00.000Z');
});
