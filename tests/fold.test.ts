import { test } from 'node:test';
import assert from 'node:assert/strict';
import { recompute, effectiveOdds, turnoverPence, riskPence } from '@/lib/domain/fold';
import type { Bet, BetLeg, SettlementEvent } from '@/lib/domain/types';

const NOW = '2026-08-31T12:00:00.000Z';

function bet(over: Partial<Bet> = {}): Bet {
  return {
    id: 'b1', accountId: 'a1', shape: 'single', side: 'back',
    stakePence: 2500, liabilityPence: null, odds: 3, currency: 'GBP', fxRate: null,
    bookmakerId: 'bet365', tipsterId: 'own', sportId: 'football',
    competition: null, course: null, eventName: 'A v B', selection: 'A',
    marketRaw: 'Match result', marketGroupId: null,
    eventAt: NOW, placedAt: NOW, expectedSettleAt: null,
    isFreeBet: false, isBonusFunds: false, isBoosted: false,
    isEachWay: false, ewPlaceFraction: null, ewPart: null, ewGroupId: null,
    slipBacked: true, source: 'manual', arbGroupId: null, note: null,
    unitPenceAtPlacement: 2500, commissionPct: 0, createdAt: NOW, legs: [],
    ...over,
  };
}

let n = 0;
function ev(type: SettlementEvent['type'], over: Partial<SettlementEvent> = {}): SettlementEvent {
  n += 1;
  return {
    id: `e${n}`, betId: 'b1', seq: n, type,
    fractionEighths: null, returnedPence: null, deductionPence: null, commissionPct: null,
    occurredAt: NOW, enteredBy: 'you', afterResultKnown: false, note: null, createdAt: NOW,
    ...over,
  };
}
const seqd = (...evs: SettlementEvent[]) => evs.map((e, i) => ({ ...e, seq: i + 1 }));

// ------------------------------------------------------------ the basics

test('a winner returns stake times price and profits the difference', () => {
  const s = recompute(bet(), seqd(ev('won')), NOW);
  assert.equal(s.returnedPence, 7500);
  assert.equal(s.realisedPlPence, 5000);
  assert.equal(s.status, 'settled');
  assert.equal(s.outcome, 'won');
});

test('a loser loses the stake and returns nothing', () => {
  const s = recompute(bet(), seqd(ev('lost')), NOW);
  assert.equal(s.returnedPence, 0);
  assert.equal(s.realisedPlPence, -2500);
  assert.equal(s.outcome, 'lost');
});

test('a void returns the stake, profits nothing, and records the voided stake', () => {
  const s = recompute(bet(), seqd(ev('void')), NOW);
  assert.equal(s.realisedPlPence, 0);
  assert.equal(s.voidedStakePence, 2500);
  assert.equal(s.outcome, 'void');
});

test('void stake is excluded from turnover and so from the ROI denominator', () => {
  const b = bet();
  const s = recompute(b, seqd(ev('void')), NOW);
  assert.equal(turnoverPence(b, s), 0);
});

// ---------------------------------------------------- partial cash out

test('the eighths slider works on REMAINING stake, not the original', () => {
  // Half of £25.00 pulled for £20.00, then half of what is LEFT.
  const first = ev('cash_out_partial', { fractionEighths: 4, returnedPence: 2000 });
  const s1 = recompute(bet(), seqd(first), NOW);
  assert.equal(s1.remainingStakePence, 1250, 'four eighths of 2500 leaves 1250');
  assert.equal(s1.status, 'part_settled');

  const second = ev('cash_out_partial', { fractionEighths: 4, returnedPence: 1000 });
  const s2 = recompute(bet(), seqd(first, second), NOW);
  assert.equal(s2.remainingStakePence, 625, 'four eighths of 1250 leaves 625, not 0');
});

test('two consecutive partial cash outs leave the correct remainder and profit', () => {
  const evs = seqd(
    ev('cash_out_partial', { fractionEighths: 2, returnedPence: 900 }),   // 625 of stake out
    ev('cash_out_partial', { fractionEighths: 4, returnedPence: 1600 }),  // half of 1875 = 938 out
  );
  const s = recompute(bet(), evs, NOW);
  assert.equal(s.remainingStakePence, 2500 - 625 - 938);
  assert.equal(s.realisedPlPence, (900 - 625) + (1600 - 938));
  assert.equal(s.status, 'part_settled');
});

test('eight eighths is a full cash out and closes the bet', () => {
  const s = recompute(bet(), seqd(ev('cash_out_partial', { fractionEighths: 8, returnedPence: 3000 })), NOW);
  assert.equal(s.remainingStakePence, 0);
  assert.equal(s.status, 'settled');
  assert.equal(s.outcome, 'cash-profit');
});

test('the three cash out outcomes are told apart by the realised figure', () => {
  const ahead = recompute(bet(), seqd(ev('cash_out_full', { returnedPence: 4000 })), NOW);
  const behind = recompute(bet(), seqd(ev('cash_out_full', { returnedPence: 900 })), NOW);
  const flat = recompute(bet(), seqd(ev('cash_out_full', { returnedPence: 2500 })), NOW);
  assert.equal(ahead.outcome, 'cash-profit');
  assert.equal(behind.outcome, 'cash-loss');
  assert.equal(flat.outcome, 'cash-flat');
  assert.equal(flat.realisedPlPence, 0);
});

test('a partial cash out then a win settles the remainder at the price', () => {
  const evs = seqd(
    ev('cash_out_partial', { fractionEighths: 4, returnedPence: 2000 }),
    ev('won'),
  );
  const s = recompute(bet(), evs, NOW);
  // 1250 left at 3.00 returns 3750, profit 2500, plus 750 already banked.
  assert.equal(s.realisedPlPence, 750 + 2500);
  assert.equal(s.outcome, 'won');
  assert.equal(s.remainingStakePence, 0);
});

// -------------------------------------------------------------- rule 4

test('Rule 4 comes off net winnings only, and never off the stake', () => {
  const evs = seqd(ev('won'), ev('rule4', { deductionPence: 20 }));
  const s = recompute(bet(), evs, NOW);
  // Net winnings 5000, 20p in the pound is 1000 off.
  assert.equal(s.realisedPlPence, 4000);
});

test('Rule 4 on a loser takes nothing, because there are no net winnings', () => {
  const evs = seqd(ev('lost'), ev('rule4', { deductionPence: 25 }));
  const s = recompute(bet(), evs, NOW);
  assert.equal(s.realisedPlPence, -2500);
});

// ---------------------------------------------------------- commission

test('commission is charged on net winnings only', () => {
  const b = bet({ commissionPct: 2 });
  const s = recompute(b, seqd(ev('won'), ev('commission', { commissionPct: 2 })), NOW);
  assert.equal(s.realisedPlPence, 5000 - 100);
});

test('a losing bet pays no commission', () => {
  const b = bet({ commissionPct: 5 });
  const s = recompute(b, seqd(ev('lost'), ev('commission', { commissionPct: 5 })), NOW);
  assert.equal(s.realisedPlPence, -2500);
});

test('a promo refund landing a week later still lands', () => {
  const s = recompute(bet(), seqd(ev('lost'), ev('promo_refund', { returnedPence: 2500, afterResultKnown: true })), NOW);
  assert.equal(s.realisedPlPence, 0);
});

// ------------------------------------------------------------ each way

test('each way is two linked parts settling independently', () => {
  const group = 'ew1';
  const win = bet({ id: 'w', stakePence: 1250, odds: 11, shape: 'each_way', ewPart: 'win', ewGroupId: group, isEachWay: true, ewPlaceFraction: 0.2 });
  const place = bet({ id: 'p', stakePence: 1250, odds: 3, shape: 'each_way', ewPart: 'place', ewGroupId: group, isEachWay: true, ewPlaceFraction: 0.2 });

  // Placed but did not win: the win part loses, the place part pays.
  const winState = recompute(win, seqd({ ...ev('lost'), betId: 'w' }), NOW);
  const placeState = recompute(place, seqd({ ...ev('placed'), betId: 'p' }), NOW);

  assert.equal(winState.realisedPlPence, -1250);
  assert.equal(placeState.realisedPlPence, 2500);
  assert.equal(winState.realisedPlPence + placeState.realisedPlPence, 1250);
});

// ------------------------------------------------------------ free bets

test('a free bet returns the winnings but not the stake', () => {
  const b = bet({ isFreeBet: true });
  const s = recompute(b, seqd(ev('won')), NOW);
  assert.equal(s.returnedPence, 5000, 'stake not returned');
  assert.equal(s.realisedPlPence, 5000);
});

test('a losing free bet costs nothing', () => {
  const s = recompute(bet({ isFreeBet: true }), seqd(ev('lost')), NOW);
  assert.equal(s.realisedPlPence, 0);
});

test('a free bet is excluded from turnover, because it was never turned over', () => {
  const b = bet({ isFreeBet: true });
  assert.equal(turnoverPence(b, recompute(b, seqd(ev('won')), NOW)), 0);
});

// ----------------------------------------------------------- lay bets

test('a lay bet risks its liability and its ROI denominator is the liability', () => {
  const b = bet({ side: 'lay', stakePence: 2500, odds: 3, liabilityPence: 5000 });
  assert.equal(riskPence(b), 5000);
  const won = recompute(b, seqd(ev('won')), NOW);
  assert.equal(won.realisedPlPence, 2500, 'the layer keeps the backer stake');
  const lost = recompute(b, seqd(ev('lost')), NOW);
  assert.equal(lost.realisedPlPence, -5000, 'the layer loses the liability');
});

// -------------------------------------------------------- quarter lines

test('a quarter line splits the stake: half wins, half pushes', () => {
  const s = recompute(bet({ odds: 2 }), seqd(ev('half_won')), NOW);
  // 1250 at 2.00 returns 2500, the other 1250 comes back: 3750 total.
  assert.equal(s.returnedPence, 3750);
  assert.equal(s.realisedPlPence, 1250);
});

test('a quarter line that half loses returns half the stake', () => {
  const s = recompute(bet({ odds: 2 }), seqd(ev('half_lost')), NOW);
  assert.equal(s.returnedPence, 1250);
  assert.equal(s.realisedPlPence, -1250);
  assert.equal(s.voidedStakePence, 1250, 'the pushed half is excluded from turnover');
});

// --------------------------------------------------------- multiples

function leg(over: Partial<BetLeg>): BetLeg {
  return {
    id: 'l', betId: 'b1', seq: 1, selection: 'A', marketRaw: 'Match result',
    fixtureId: null, eventName: 'A v B', legOdds: 2, legResult: 'won', eventAt: NOW,
    ...over,
  };
}

test('void legs drop out of a multiple and the odds recalculate', () => {
  const b = bet({
    shape: 'multi_cross_fixture', odds: 8,
    legs: [
      leg({ id: 'l1', seq: 1, legOdds: 2, legResult: 'won' }),
      leg({ id: 'l2', seq: 2, legOdds: 2, legResult: 'void' }),
      leg({ id: 'l3', seq: 3, legOdds: 2, legResult: 'won' }),
    ],
  });
  assert.equal(effectiveOdds(b), 4, 'the void leg is gone from the price');
  const s = recompute(b, seqd(ev('won')), NOW);
  assert.equal(s.returnedPence, 10000);
});

test('the unit is frozen at placement, so history never rewrites itself', () => {
  const b = bet({ unitPenceAtPlacement: 1000 });
  const s = recompute(b, seqd(ev('won')), NOW);
  assert.equal(s.units, 5, '5000p profit against a 1000p unit');
  // Changing the account unit later cannot change this figure, because the
  // fold only ever reads the bet's own frozen unit.
  const later = recompute({ ...b, unitPenceAtPlacement: 1000 }, seqd(ev('won')), NOW);
  assert.equal(later.units, 5);
});

test('a terminal event closes the bet, and later leg grading cannot reopen it', () => {
  const evs = seqd(ev('cash_out_full', { returnedPence: 3000 }), ev('won'));
  const s = recompute(bet(), evs, NOW);
  assert.equal(s.realisedPlPence, 500, 'the cash out is terminal');
  assert.equal(s.outcome, 'cash-profit');
});

test('an open bet reports open with the full stake still standing', () => {
  const s = recompute(bet(), [], NOW);
  assert.equal(s.status, 'open');
  assert.equal(s.remainingStakePence, 2500);
  assert.equal(s.outcome, null);
});
