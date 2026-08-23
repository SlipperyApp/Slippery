import { test } from 'node:test';
import assert from 'node:assert/strict';
import { placePrice, parsePlaceFraction, eachWayLabel, splitStake } from '../lib/eachway.ts';
import { balancePence, exposurePct, growthPct, adjustmentsTotal } from '../lib/bankroll.ts';
import { unitOn, unitsFor } from '../lib/unit.ts';
import { recomputeState } from '../lib/db/recompute.ts';

/* ── 55 · EACH WAY ─────────────────────────────────────────────────────── */

test('the place price reduces only the profit half of the odds', () => {
  /* The classic error is 6.00 * 1/5 = 1.20. It is 1 + (6-1)/5 = 2.00, and the
     wrong version understates every placed bet by a long way. */
  assert.equal(placePrice(6.0, { numerator: 1, denominator: 5, placesPaid: 3 }), 2.0);
  assert.equal(placePrice(11.0, { numerator: 1, denominator: 4, placesPaid: 3 }), 3.5);
  assert.equal(placePrice(2.0, { numerator: 1, denominator: 5, placesPaid: 3 }), 1.2);
});

test('an unreadable place fraction returns null rather than a guess', () => {
  assert.deepEqual(parsePlaceFraction('1/5'), { numerator: 1, denominator: 5 });
  assert.equal(parsePlaceFraction('one fifth'), null);
  assert.equal(parsePlaceFraction('1/0'), null);
  assert.equal(parsePlaceFraction(null), null);
});

test('win lost and place won is Placed, the case the six outcomes could not express', () => {
  assert.equal(eachWayLabel('lost', 'won'), 'placed');
  assert.equal(eachWayLabel('won', 'won'), 'won');
  assert.equal(eachWayLabel('lost', 'lost'), 'lost');
  assert.equal(eachWayLabel('void', 'void'), 'void');
  assert.equal(eachWayLabel('void', 'won'), 'part_void');
});

test('an unsettled part defers the whole label rather than guessing it', () => {
  assert.equal(eachWayLabel(null, 'won'), 'ask');
  assert.equal(eachWayLabel('lost', null), 'ask');
});

test('the two halves of an each-way stake always sum to the total', () => {
  for (const total of [2000, 2001, 1, 999, 12345]) {
    const { winPence, placePence } = splitStake(total);
    assert.equal(winPence + placePence, total, `total ${total}`);
  }
});

test('the York 16:10 case from the spec settles to minus four pounds', () => {
  /* £20 each way, 6.00, 1/5, places 1-3, finished 3rd. The old model called
     this LOST at −£20.00 when it actually returned £16.00. */
  const { winPence, placePence } = splitStake(2000);
  const win = recomputeState({ stakePence: winPence, odds: 6.0 }, [{ seq: 1, type: 'lost' }]);
  const pp = placePrice(6.0, { numerator: 1, denominator: 5, placesPaid: 3 });
  const place = recomputeState({ stakePence: placePence, odds: pp }, [{ seq: 1, type: 'won' }]);
  assert.equal(win.realisedPlPence, -1000);
  assert.equal(place.realisedPlPence, 1000);          // £10 at 2.00 returns £20
  assert.equal(win.realisedPlPence + place.realisedPlPence, 0);
  assert.equal(win.returnedPence + place.returnedPence, 2000);
  assert.equal(eachWayLabel('lost', 'won'), 'placed');
});

/* ── 56 · COMMISSION ───────────────────────────────────────────────────── */

test('commission comes off net winnings only, never the stake', () => {
  /* £30 at 2.41 on Smarkets. Gross profit £42.30, 2% is 85p (84.6 rounded),
     so the real profit is £41.45 and not £42.30. */
  const s = recomputeState(
    { stakePence: 3000, odds: 2.41, commissionPct: 2 },
    [{ seq: 1, type: 'won' }, { seq: 2, type: 'commission' }],
  );
  assert.equal(s.realisedPlPence, 4230 - 85);
  assert.equal(s.returnedPence, 7230 - 85);
});

test('a losing exchange bet pays no commission', () => {
  const s = recomputeState(
    { stakePence: 3000, odds: 2.41, commissionPct: 2 },
    [{ seq: 1, type: 'lost' }, { seq: 2, type: 'commission' }],
  );
  assert.equal(s.realisedPlPence, -3000);
});

/* ── 57 · BANKROLL ─────────────────────────────────────────────────────── */

test('balance is starting bankroll plus net plus adjustments', () => {
  assert.equal(balancePence(100000, 317100), 417100);
  assert.equal(balancePence(100000, 317100, [{ amountPence: 50000 }]), 467100);
  assert.equal(balancePence(100000, 317100, [{ amountPence: -20000 }]), 397100);
  assert.equal(adjustmentsTotal([{ amountPence: 500 }, { amountPence: -200 }]), 300);
});

test('exposure divides by balance, not by the starting bankroll', () => {
  /* The spec's figures: £88 at risk against a £4,171 balance is 2.1%. Against
     the £1,000 starting bankroll it reads 8.8%, which is the number that was
     wrong on the chip. */
  const pct = exposurePct(8800, 417100)!;
  assert.equal(Math.round(pct * 10) / 10, 2.1);
  const wrong = exposurePct(8800, 100000)!;
  assert.equal(Math.round(wrong * 10) / 10, 8.8);
});

test('exposure is null rather than Infinity when there is no balance', () => {
  assert.equal(exposurePct(8800, 0), null);
  assert.equal(growthPct(0, 5000), null);
});

test('growth measures against the figure a person set', () => {
  /* Compared rounded: the function returns a raw ratio and formatting is the
     edge's job, so 317.09999999999997 is the correct answer here. */
  assert.equal(Math.round(growthPct(100000, 317100)! * 10) / 10, 317.1);
});

/* ── 58 · UNIT FREEZE ──────────────────────────────────────────────────── */

test('a bet keeps the unit it was placed at when the unit later changes', () => {
  /* January: +£250 at a £25 unit is +10.0u. Raising the unit to £50 in August
     must not turn that into +5.0u. */
  assert.equal(unitsFor(25000, 2500), 10);
  assert.equal(unitsFor(25000, 5000), 5);   // what recalculating would have done
});

test('an imported bet takes the unit in force on its own date', () => {
  const history = [
    { effectiveFrom: '2026-01-01T00:00:00Z', unitPence: 2500 },
    { effectiveFrom: '2026-08-01T00:00:00Z', unitPence: 5000 },
  ];
  assert.deepEqual(unitOn(history, '2026-03-15T12:00:00Z', 5000),
    { unitPence: 2500, source: 'history' });
  assert.deepEqual(unitOn(history, '2026-09-15T12:00:00Z', 5000),
    { unitPence: 5000, source: 'history' });
  /* Predating any recorded change falls back to the current unit and says so,
     so the dry run can tell the reader which it used. */
  assert.deepEqual(unitOn(history, '2025-06-01T00:00:00Z', 5000),
    { unitPence: 5000, source: 'current' });
});

test('units are null when no unit was ever set, not a division by zero', () => {
  assert.equal(unitsFor(25000, null), null);
  assert.equal(unitsFor(25000, 0), null);
});
