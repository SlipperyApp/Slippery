import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { recomputeState } from '../lib/db/recompute.ts';
import { unitsFor } from '../lib/unit.ts';

/* THE BUG THIS EXISTS TO CATCH.
 *
 * Spec 3 added `bets.unit_at_placement_pence`, backfilled it, and wrote a pure
 * `unitsFor()` around the rule — and then the one place that actually computes
 * a bet's units, `appendEvent`, carried on passing the account's CURRENT unit
 * into the fold. The column was written on every bet and read by nothing, so
 * the defect it was added to prevent stayed live: every recompute rewrote the
 * past.
 *
 * A stored value and an honoured value are different things and only the
 * second one is a fix. These assert the second.
 */

test('a settled bet keeps the unit it was placed at when the account unit changes', () => {
  /* January: +£250 at a £25 unit is +10.0u. Raising the unit to £50 in August
     must not turn January into +5.0u. */
  const events = [{ seq: 1, type: 'won' as const }];
  const bet = { stakePence: 5000, odds: 6.0, unitPence: 2500 };

  const atPlacement = recomputeState(bet, events);
  assert.equal(atPlacement.realisedPlPence, 25000);
  assert.equal(atPlacement.units, 10);

  const recomputedLater = recomputeState({ ...bet, unitPence: 2500 }, events);
  assert.equal(recomputedLater.units, 10, 'the past moved');

  /* And this is precisely what the bug did — today's unit, applied backwards. */
  const theBug = recomputeState({ ...bet, unitPence: 5000 }, events);
  assert.equal(theBug.units, 5);
});

test("appendEvent reads the bet's unit, not the account's", () => {
  /* Asserted against the source, because the alternative is a live database.
     The precedence matters: the account value is a fallback for bets written
     before the column existed, never the first choice. */
  const src = readFileSync('lib/server/bets.ts', 'utf8');
  assert.match(src, /unitPence:\s*bet\.unitAtPlacementPence\s*\?\?\s*account\?\.unitPence/,
    'the fold is back on the account unit and rewrites history on every recompute');
});

test("appendEvent reads the bet's commission rate, not the bookmaker's current one", () => {
  /* The same class of bug. `bets.commission_pct` is resolved at placement so
     that editing a bookmaker's rate cannot walk back through settled P&L. */
  const src = readFileSync('lib/server/bets.ts', 'utf8');
  assert.match(src, /bet\.commissionPct != null \? Number\(bet\.commissionPct\) : null/,
    'a bookmaker rate change would move already-settled profit');
});

test('units are null rather than zero when no unit was ever set', () => {
  const s = recomputeState({ stakePence: 5000, odds: 2.0, unitPence: null },
    [{ seq: 1, type: 'won' }]);
  assert.equal(s.units, null);
  assert.equal(unitsFor(5000, null), null);
});
