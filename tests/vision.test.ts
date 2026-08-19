import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sanitise } from '../lib/server/slip-schema.ts';

const one = (b: object) => sanitise({ bets: [b] }).bets[0];

test('a legible single comes back whole', () => {
  const b = one({ shape: 'single', stake_pence: 2500, odds: 1.9, bookmaker: 'Bet 365', selection: 'Arsenal', event_at: '2026-08-19T14:00:00Z', unreadable_fields: [] });
  assert.equal(b.stake_pence, 2500);
  assert.equal(b.odds, 1.9);
  assert.equal(b.bookmaker, 'bet365', 'folded through the registry');
  assert.deepEqual(b.unreadable_fields, []);
});

/* THE RULE THE READER EXISTS TO KEEP. */
test('a missing stake is named rather than invented', () => {
  const b = one({ odds: 1.9, unreadable_fields: [] });
  assert.equal(b.stake_pence, null);
  assert.ok(b.unreadable_fields.includes('stake'));
});

test('an implausible value is refused and named, not rounded into shape', () => {
  const b = one({ stake_pence: -50, odds: 0.4, event_at: 'sometime', unreadable_fields: [] });
  assert.equal(b.stake_pence, null);
  assert.equal(b.odds, null);
  assert.equal(b.event_at, null);
  for (const f of ['stake', 'odds', 'date']) assert.ok(b.unreadable_fields.includes(f), f + ' should be named');
});

test('several legs on one stake stay one bet', () => {
  const b = one({
    shape: 'multi_same_fixture', stake_pence: 10000, odds: 1.8,
    legs: [{ selection: 'Juventus to win', odds: 1.4 }, { selection: 'Under 4 cards', odds: 1.3 }],
    unreadable_fields: [],
  });
  assert.equal(b.shape, 'multi_same_fixture');
  assert.equal(b.legs.length, 2);
});

test('several separate stakes stay several bets', () => {
  const r = sanitise({ bets: [
    { stake_pence: 1000, unreadable_fields: [] },
    { stake_pence: 2000, unreadable_fields: [] },
    { stake_pence: 3000, unreadable_fields: [] },
  ] });
  assert.equal(r.bets.length, 3);
  assert.deepEqual(r.bets.map((b) => b.stake_pence), [1000, 2000, 3000]);
});

test('a builder the reader could not tell from an accumulator asks rather than guesses', () => {
  const b = one({ stake_pence: 10000, legs: [{ selection: 'a' }, { selection: 'b' }], unreadable_fields: [] });
  assert.equal(b.shape, null);
  assert.ok(b.unreadable_fields.includes('bet type'));
});

test('a lay bet without its liability is flagged', () => {
  const b = one({ side: 'lay', stake_pence: 2000, unreadable_fields: [] });
  assert.ok(b.unreadable_fields.includes('liability'));
});

test('a photo that is not a slip says so instead of producing a bet', () => {
  const r = sanitise({ not_a_slip: true, bets: [] });
  assert.equal(r.not_a_slip, true);
  assert.equal(r.bets.length, 0);
});

test('an unsupported currency falls back rather than reaching the ledger', () => {
  assert.equal(one({ stake_pence: 100, currency: 'USD', unreadable_fields: [] }).currency, 'GBP');
});
