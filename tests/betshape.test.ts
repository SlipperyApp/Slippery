import { test } from 'node:test';
import assert from 'node:assert/strict';
import { betProblems } from '../lib/server/betshape.ts';

const good = { stakePence: 2500, eventAt: '2026-08-19T14:00:00Z', odds: 1.9, currency: 'GBP' };

test('an ordinary bet has no problems', () => {
  assert.deepEqual(betProblems(good), []);
});

test('a bet without a stake or a date is refused', () => {
  assert.ok(betProblems({ ...good, stakePence: 0 }).length);
  assert.ok(betProblems({ ...good, eventAt: 'not a date' }).length);
});

test('a lay bet without its liability is refused, because nothing about it can be totalled', () => {
  assert.ok(betProblems({ ...good, side: 'lay' }).length);
  assert.deepEqual(betProblems({ ...good, side: 'lay', liabilityPence: 8000 }), []);
});

test('odds below evens on the decimal scale are impossible', () => {
  assert.ok(betProblems({ ...good, odds: 0.5 }).length);
  assert.deepEqual(betProblems({ ...good, odds: 1 }), []);
});

test('an antepost bet needs the date it is expected to settle', () => {
  assert.ok(betProblems({ ...good, isAntepost: true }).length);
  assert.deepEqual(betProblems({ ...good, isAntepost: true, expectedSettleAt: '2027-05-01' }), []);
});

test('only pounds and euros', () => {
  assert.ok(betProblems({ ...good, currency: 'USD' }).length);
});
