import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  band, disposition, askCopy, betFingerprint, isProbableDuplicate,
  isTemplateDrift, HIGH, MEDIUM,
} from '../lib/confidence.ts';

const f = (field: any, score: number) => ({ field, value: null, score });

test('a price the reader is guessing at never reaches the figures', () => {
  /* The asymmetry the whole design turns on: a missing price is visible and
     gets fixed, a wrong one is invisible and poisons a year of history. */
  const d = disposition([f('stake', 0.99), f('price', 0.4), f('selection', 0.95), f('bookmaker', 0.98)]);
  assert.equal(d.action, 'hold');
  assert.equal(d.countsInStats, false);
  assert.deepEqual(d.ask, ['price']);
});

test('a hesitant load-bearing field asks one question and still counts', () => {
  const d = disposition([f('stake', 0.99), f('price', 0.72), f('selection', 0.95), f('bookmaker', 0.98)]);
  assert.equal(d.action, 'ask');
  assert.equal(d.countsInStats, true);
  assert.deepEqual(d.ask, ['price']);
});

test('the question is asked about the field we are least sure of, first', () => {
  const d = disposition([f('stake', 0.70), f('price', 0.67), f('selection', 0.95), f('bookmaker', 0.66)]);
  assert.deepEqual(d.ask, ['bookmaker', 'price', 'stake']);
});

test('a shaky market label does not hold up a bet, because it moves no money', () => {
  const d = disposition([f('stake', 0.99), f('price', 0.98), f('selection', 0.96),
                         f('bookmaker', 0.97), f('market', 0.3)]);
  assert.equal(d.action, 'save');
  assert.equal(d.countsInStats, true);
});

test('the bands are far apart, because a model score is not calibrated', () => {
  assert.equal(band(HIGH), 'high');
  assert.equal(band(HIGH - 0.01), 'medium');
  assert.equal(band(MEDIUM), 'medium');
  assert.equal(band(MEDIUM - 0.01), 'low');
});

test('the question offers two readings rather than a text box', () => {
  assert.equal(askCopy('price', '1.90', '1.98'), 'Odds looks like 1.90, could be 1.98?');
  assert.equal(askCopy('stake', '£25.00'), 'Is the stake £25.00?');
});

test('a correction on a field the model was sure about means the template drifted', () => {
  assert.equal(isTemplateDrift({ bookmaker: 'bet365', field: 'price', read: 1.9, corrected: 1.98, modelScore: 0.97 }), true);
  assert.equal(isTemplateDrift({ bookmaker: 'bet365', field: 'price', read: 1.9, corrected: 1.98, modelScore: 0.5 }), false);
});

test('duplicates are found on the parsed bet, not the image', () => {
  /* Two screenshots of one slip are different files, and cropping one makes
     a third — so hashing bytes finds nothing. */
  const a = betFingerprint({ bookmaker: 'bet365', stakePence: 2500, odds: 1.9,
    selection: 'Arsenal to win', eventAt: '2026-08-12T14:00:00Z' });
  const b = betFingerprint({ bookmaker: 'Bet365', stakePence: 2500, odds: 1.9,
    selection: '  arsenal   to win ', eventAt: '2026-08-12T19:00:00Z' });
  assert.equal(a, b, 'case and spacing must not make a second bet');

  assert.equal(isProbableDuplicate(
    { fingerprint: a, at: '2026-08-12T10:00:00Z' },
    { fingerprint: b, at: '2026-08-12T22:00:00Z' }), true);
  /* The same bet placed again a week later is a real second bet. */
  assert.equal(isProbableDuplicate(
    { fingerprint: a, at: '2026-08-12T10:00:00Z' },
    { fingerprint: b, at: '2026-08-19T10:00:00Z' }), false);
});
