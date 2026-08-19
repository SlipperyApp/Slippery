import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MARKET_GROUPS, canonicalMarket } from '../lib/server/markets.ts';

test('there are twenty seven canonical groups, as specified', () => {
  assert.equal(MARKET_GROUPS.length, 27);
});

test('no alias is claimed by two groups', () => {
  const seen = new Map<string, string>();
  for (const g of MARKET_GROUPS) {
    for (const a of [g.name, ...g.aliases]) {
      const k = a.toLowerCase().replace(/−/g, '-').replace(/[^a-z0-9+-]/g, '');
      const other = seen.get(k);
      assert.ok(!other || other === g.name, a + ' is claimed by ' + other + ' and ' + g.name);
      seen.set(k, g.name);
    }
  }
});

test('the same bet under three bookmakers names lands in one row', () => {
  assert.equal(canonicalMarket('Double Chance 1X'), 'Home or draw');
  assert.equal(canonicalMarket('Asian Handicap Home +0.5'), 'Home or draw');
  assert.equal(canonicalMarket('Away Win No'), 'Home or draw');
});

test('the minus sign is read whichever character the slip used', () => {
  assert.equal(canonicalMarket('Asian Handicap Home −0.5'), 'Home win');
  assert.equal(canonicalMarket('asian handicap home -0.5'), 'Home win');
});

test('a market with no group says so rather than guessing one', () => {
  assert.equal(canonicalMarket('Number of throw-ins in the second half'), null);
});
