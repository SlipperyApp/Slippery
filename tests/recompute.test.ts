import { test } from 'node:test';
import assert from 'node:assert/strict';
import { recomputeState, turnoverPence } from '../lib/db/recompute.ts';

const bet = (over = {}) => ({ stakePence: 10000, odds: 2.0, unitPence: 2500, ...over });
const ev = (seq: number, type: string, over = {}) => ({ seq, type, ...over });

test('an unsettled bet is open with the whole stake at risk', () => {
  const s = recomputeState(bet(), [ev(1, 'placed')]);
  assert.equal(s.status, 'open');
  assert.equal(s.remainingStakePence, 10000);
  assert.equal(s.realisedPlPence, 0);
});

test('a winner returns stake plus winnings and prices in units', () => {
  const s = recomputeState(bet(), [ev(1, 'placed'), ev(2, 'won')]);
  assert.equal(s.status, 'settled');
  assert.equal(s.returnedPence, 20000);
  assert.equal(s.realisedPlPence, 10000);
  assert.equal(s.units, 4);
  assert.equal(s.remainingStakePence, 0);
});

test('a loser loses the stake and returns nothing', () => {
  const s = recomputeState(bet(), [ev(1, 'lost')]);
  assert.equal(s.realisedPlPence, -10000);
  assert.equal(s.returnedPence, 0);
});

test('a void returns the stake, makes no profit, and leaves turnover', () => {
  const s = recomputeState(bet(), [ev(1, 'void')]);
  assert.equal(s.realisedPlPence, 0);
  assert.equal(s.returnedPence, 10000);
  assert.equal(s.voidedStakePence, 10000);
  assert.equal(turnoverPence(bet(), s), 0);
});

test('a whole line on the exact score pushes rather than losing', () => {
  const s = recomputeState(bet(), [ev(1, 'push')]);
  assert.equal(s.realisedPlPence, 0);
  assert.equal(s.voidedStakePence, 10000);
});

test('a quarter line splits the stake, so half is lost and half returned', () => {
  const s = recomputeState(bet(), [ev(1, 'half_lost')]);
  assert.equal(s.realisedPlPence, -5000);
  assert.equal(s.returnedPence, 5000);
  assert.equal(s.voidedStakePence, 5000);
});

test('half won pays the price on half the stake and returns the other half', () => {
  const s = recomputeState(bet(), [ev(1, 'half_won')]);
  assert.equal(s.realisedPlPence, 5000);
  assert.equal(s.returnedPence, 15000);
});

/* THE CASE THE OLD MODEL COULD NOT HOLD AT ALL. */
test('two consecutive half cash outs leave a quarter of the stake running', () => {
  const s = recomputeState(bet(), [
    ev(1, 'placed'),
    ev(2, 'cash_out_partial', { fractionEighths: 4, returnedPence: 6000 }),
    ev(3, 'cash_out_partial', { fractionEighths: 4, returnedPence: 3500 }),
  ]);
  assert.equal(s.remainingStakePence, 2500, 'eighths are of remaining stake, not of the original');
  assert.equal(s.status, 'part_settled');
  assert.equal(s.returnedPence, 9500);
  assert.equal(s.realisedPlPence, 9500 - 7500);
});

test('cashing out all eight eighths settles the bet', () => {
  const s = recomputeState(bet(), [
    ev(1, 'cash_out_partial', { fractionEighths: 8, returnedPence: 12000 }),
  ]);
  assert.equal(s.remainingStakePence, 0);
  assert.equal(s.status, 'settled');
  assert.equal(s.realisedPlPence, 2000);
});

test('a full cash out is terminal and later leg results do not move the money', () => {
  const s = recomputeState(bet(), [
    ev(1, 'cash_out_full', { returnedPence: 14000 }),
    ev(2, 'won'),
  ]);
  assert.equal(s.realisedPlPence, 4000, 'the cash out is terminal, the win must not pay again');
});

test('rule 4 comes out of winnings and never out of the stake', () => {
  const s = recomputeState(bet(), [ev(1, 'won'), ev(2, 'rule4', { returnedPence: 2500 })]);
  assert.equal(s.realisedPlPence, 7500);
  const loser = recomputeState(bet(), [ev(1, 'lost'), ev(2, 'rule4', { returnedPence: 2500 })]);
  assert.equal(loser.realisedPlPence, -10000, 'there are no winnings to deduct from');
});

test('commission is charged on net winnings only', () => {
  const b = bet({ side: 'lay', liabilityPence: 10000, commissionPct: 5 });
  const won = recomputeState(b, [
    ev(1, 'won', { returnedPence: 12000, stakePortionPence: 10000 }),
    ev(2, 'commission'),
  ]);
  assert.equal(won.realisedPlPence, 2000 - 100);
  const lost = recomputeState(b, [ev(1, 'lost'), ev(2, 'commission')]);
  assert.equal(lost.realisedPlPence, -10000, 'a losing exchange bet pays no commission');
});

test('a promo refund adjusts profit after settlement without rewriting the result', () => {
  const s = recomputeState(bet(), [ev(1, 'lost'), ev(2, 'promo_refund', { returnedPence: 2000 })]);
  assert.equal(s.realisedPlPence, -8000);
  assert.equal(s.status, 'settled');
});

test('a lay bet risks liability, not stake', () => {
  const b = bet({ side: 'lay', stakePence: 2000, liabilityPence: 8000 });
  const open = recomputeState(b, [ev(1, 'placed')]);
  assert.equal(open.remainingStakePence, 8000);
  const lost = recomputeState(b, [ev(1, 'lost')]);
  assert.equal(lost.realisedPlPence, -8000);
});

test('a free bet leaves its stake out of turnover and returns winnings only', () => {
  const b = bet({ isFreeBet: true });
  const s = recomputeState(b, [ev(1, 'won')]);
  assert.equal(s.realisedPlPence, 10000);
  assert.equal(turnoverPence(b, s), 0);
  const lost = recomputeState(b, [ev(1, 'lost')]);
  assert.equal(lost.realisedPlPence, 0, 'losing a free bet costs nothing');
});

test('arb pairs and imported figures stay out of the statistics', () => {
  assert.equal(recomputeState(bet({ arbGroupId: 'x' }), [ev(1, 'won')]).countsInStats, false);
  assert.equal(recomputeState(bet({ source: 'csv_import' }), [ev(1, 'won')]).countsInStats, false);
  assert.equal(recomputeState(bet({ source: 'telegram' }), [ev(1, 'won')]).countsInStats, true);
});

/* THE INVARIANT THAT PROVES THE MODEL.
   The fold is order dependent by design, so replaying the same events in the
   same order must land in the same place every time, and a state recomputed
   from scratch must equal one built up event by event. If these ever diverge,
   the materialised table has stopped being a view of the log. */
test('recomputing from scratch equals folding one event at a time', () => {
  const seed = [
    ev(1, 'placed'),
    ev(2, 'cash_out_partial', { fractionEighths: 2, returnedPence: 3000 }),
    ev(3, 'cash_out_partial', { fractionEighths: 3, returnedPence: 4000 }),
    ev(4, 'won'),
    ev(5, 'rule4', { returnedPence: 500 }),
    ev(6, 'promo_refund', { returnedPence: 250 }),
  ];
  const full = recomputeState(bet(), seed);
  let progressive = recomputeState(bet(), []);
  for (let i = 1; i <= seed.length; i++) progressive = recomputeState(bet(), seed.slice(0, i));
  assert.deepEqual(progressive, full);
});

test('replay is deterministic whatever order the rows arrive in', () => {
  const seed = [
    ev(1, 'placed'),
    ev(2, 'cash_out_partial', { fractionEighths: 4, returnedPence: 6000 }),
    ev(3, 'won'),
  ];
  const a = recomputeState(bet(), seed);
  const b = recomputeState(bet(), [...seed].reverse());
  assert.deepEqual(a, b, 'the fold sorts by seq, so arrival order cannot matter');
});
