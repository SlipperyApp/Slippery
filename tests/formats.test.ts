import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  money, units, percent, axisLabel, shortDate, formatOdds, toFractional,
  toAmerican, clock, localDayKey,
} from '../lib/formats.ts';

test('money is always two decimals, totals included', () => {
  assert.equal(money(2500), '£25.00');
  assert.equal(money(118400), '£1,184.00');
  assert.equal(money(0), '£0.00');
  assert.equal(money(118400, 'GBP', true), '+£1,184.00');
  assert.equal(money(-2500, 'GBP', true), '−£25.00');
});

test('euro accounts get euros, and the symbol is not hardcoded anywhere', () => {
  assert.equal(money(2500, 'EUR'), '€25.00');
  assert.equal(axisLabel(118400, 'EUR'), '€1.2k');
});

test('units are two decimals, except on a league surface', () => {
  assert.equal(units(8.44), '+8.44u');
  assert.equal(units(8.44, 'league'), '+8.4u');
  assert.equal(units(-1), '−1.00u');
  assert.equal(units(0), '0.00u');
});

test('axis labels round to nothing, because they are labels', () => {
  assert.equal(axisLabel(118400), '£1.2k');
  assert.equal(axisLabel(26400), '£264');
  assert.equal(axisLabel(-9600), '−£96');
  assert.equal(axisLabel(100000), '£1k');
});

test('percentages are one decimal', () => {
  assert.equal(percent(3.16), '+3.2%');
  assert.equal(percent(-1.05), '−1.1%');
});

test('dates are day first, and the year only when it is not this one', () => {
  const now = new Date('2026-08-19T12:00:00Z');
  assert.equal(shortDate('2026-08-12T00:00:00Z', now), '12 Aug');
  assert.equal(shortDate('2025-09-02T00:00:00Z', now), '2 Sep 2025');
});

test('fractional odds come off the standard ladder, not from arithmetic', () => {
  /* The whole reason this is a lookup: a best-fit search returns 3/2 for
     2.50, which is mathematically right and is not what any UK board shows.
     A tracker printing 3/2 next to a slip printing 6/4 looks broken. */
  assert.equal(toFractional(2.50), '6/4');
  assert.equal(toFractional(1.91), '10/11');
  assert.equal(toFractional(3.50), '5/2');
  assert.equal(toFractional(2.00), '1/1');
  assert.equal(toFractional(1.20), '1/5');
  assert.equal(toFractional(11.00), '10/1');
});

test('a price between two rungs takes the nearer one rather than inventing a fraction', () => {
  assert.equal(toFractional(2.52), '6/4');
  assert.equal(toFractional(2.60), '13/8');
});

test('american odds flip sign at evens', () => {
  assert.equal(toAmerican(3.00), '+200');
  assert.equal(toAmerican(1.50), '-200');
  assert.equal(toAmerican(2.00), '+100');
});

test('the odds format switch covers all three and refuses nonsense', () => {
  assert.equal(formatOdds(2.5, 'Decimal'), '2.50');
  assert.equal(formatOdds(2.5, 'Fractional'), '6/4');
  assert.equal(formatOdds(2.5, 'American'), '+150');
  assert.equal(formatOdds(0, 'Decimal'), '—');
});

test('a late kick off lands on the right local day, not the UTC one', () => {
  /* 23:30 on 12 August in London is 22:30 UTC the same day — but in summer
     the offset is +1, so a naive UTC read of a 23:30 BST bet gives the 12th
     while a 00:30 BST bet gives the previous day. This is what puts a bet in
     the wrong calendar cell. */
  assert.equal(localDayKey('2026-08-12T22:30:00Z'), '2026-08-12');
  assert.equal(localDayKey('2026-08-12T23:30:00Z'), '2026-08-13');
  assert.equal(clock('2026-08-12T18:45:00Z'), '19:45');
});
