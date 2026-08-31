import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toFractional, toAmerican, fromFractional, formatOdds, accaOdds, LADDER } from '@/lib/odds';

test('the fractional ladder is a real one, not a fraction reducer', () => {
  // These two are the reason there is a lookup table at all.
  assert.equal(toFractional(2.5), '6/4');   // not 3/2
  assert.equal(toFractional(1.9), '9/10');  // not 10/11
});

test('evens is named, not printed as 1/1', () => {
  assert.equal(toFractional(2), 'evens');
});

test('the ladder covers the everyday board', () => {
  assert.equal(toFractional(1.5), '1/2');
  assert.equal(toFractional(3), '2/1');
  assert.equal(toFractional(4.5), '7/2');
  assert.equal(toFractional(11), '10/1');
  assert.equal(toFractional(1.25), '1/4');
  assert.equal(toFractional(2.75), '7/4');
});

test('american odds cross over at 2.00', () => {
  assert.equal(toAmerican(1.9), '-111');
  assert.equal(toAmerican(2), '+100');
  assert.equal(toAmerican(3.5), '+250');
});

test('a price below evens never reads as a positive american price', () => {
  for (const d of [1.05, 1.2, 1.5, 1.75, 1.99]) {
    assert.ok(toAmerican(d).startsWith('-'), `${d} should be a minus price`);
  }
});

test('fractional input round trips', () => {
  assert.equal(fromFractional('6/4'), 2.5);
  assert.equal(fromFractional('evens'), 2);
  assert.equal(fromFractional('9/10'), 1.9);
  assert.equal(fromFractional('not odds'), null);
});

test('every rung is in ascending order, so the nearest match is stable', () => {
  const values = LADDER.map(([n, d]) => n / d);
  for (let i = 1; i < values.length; i++) {
    assert.ok(values[i] > values[i - 1], `rung ${i} is out of order`);
  }
});

test('decimal display is always 2dp', () => {
  assert.equal(formatOdds(2, 'decimal'), '2.00');
  assert.equal(formatOdds(9.5, 'decimal'), '9.50');
});

test('accumulator odds multiply', () => {
  assert.equal(accaOdds([1.5, 2, 3]), 9);
});
