import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatOdds } from '../lib/server/odds.ts';

/* The exact conversion the definition of done names. */
test('1.90 converts to 9/10 and to -111', () => {
  assert.equal(formatOdds(1.9, 'decimal'), '1.90');
  assert.equal(formatOdds(1.9, 'fractional'), '9/10');
  assert.equal(formatOdds(1.9, 'american'), '-111');
});

test('evens and odds-on read the way a bookmaker writes them', () => {
  assert.equal(formatOdds(2, 'fractional'), '1/1');
  assert.equal(formatOdds(2, 'american'), '+100');
  assert.equal(formatOdds(1.5, 'fractional'), '1/2');
  assert.equal(formatOdds(1.5, 'american'), '-200');
});

test('long prices stay readable rather than exact', () => {
  assert.equal(formatOdds(11, 'fractional'), '10/1');
  assert.equal(formatOdds(3.5, 'fractional'), '5/2');
  assert.equal(formatOdds(4.33, 'fractional'), '10/3');
});

test('an impossible price formats as nothing rather than as a number', () => {
  assert.equal(formatOdds(0.5, 'decimal'), '');
  assert.equal(formatOdds(NaN, 'fractional'), '');
});
