import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  recompute, effectiveOdds, turnoverPence, riskPence, commissionPence, commissionDue,
} from '@/lib/domain/fold';
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
    placesPaid: null,
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

test('a fifty pound win at 3.0 on a two per cent exchange keeps ninety eight pounds', () => {
  /*  The arithmetic the whole defect was about, pinned with the real numbers.
   *  £50.00 at 3.00 returns £150.00, of which £100.00 is net winnings.
   *  Commission is 2% OF THE WINNINGS, so £2.00: not 2% of the £150.00 back
   *  (£3.00) and not 2% of the £50.00 staked (£1.00). Profit is £98.00. */
  const b = bet({ stakePence: 5000, odds: 3, bookmakerId: 'betfair-exchange', commissionPct: 2 });
  const s = recompute(b, seqd(ev('won'), ev('commission', { commissionPct: 2 })), NOW);
  assert.equal(s.returnedPence, 15000 - 200, 'the charge came off the return');
  assert.equal(s.realisedPlPence, 9800);
  assert.equal(turnoverPence(b, s), 5000, 'commission never touches turnover');
  // Return is measured on turnover, so it moves with the charge and not the
  // other way about: 9800 on 5000 turned over is 196%.
  assert.equal((s.realisedPlPence / turnoverPence(b, s)) * 100, 196);
});

test('commission is charged on net winnings, never on turnover or on the return', () => {
  const b = bet({ stakePence: 5000, odds: 3, commissionPct: 2 });
  const s = recompute(b, seqd(ev('won'), ev('commission', { commissionPct: 2 })), NOW);
  assert.notEqual(s.realisedPlPence, 10000 - 300, 'charged on the return');
  assert.notEqual(s.realisedPlPence, 10000 - 100, 'charged on the stake');
  assert.equal(s.realisedPlPence, 10000 - 200);
});

test('a part penny of commission rounds UP, away from the person', () => {
  /*  £5.10 at 3.00 on Matchbook wins £10.20. 1.5% of 1020 pence is 15.3
   *  pence. Rounding to nearest would take 15p and report a penny of profit
   *  the exchange never paid; the charge is 16p.
   *
   *  Stated direction, and this is the test that pins it. */
  assert.equal(commissionPence(1020, 1.5), 16);
  assert.equal(commissionPence(1970, 2), 40, '39.4 pence of charge is 40 pence taken');
  assert.equal(commissionPence(10000, 2), 200, 'an exact charge is not pushed up a penny');
  assert.equal(commissionPence(5000, 1.5), 75, 'and neither is an exact charge at a fractional rate');
  // A rate with no exact binary form must not drift an exact charge upward.
  assert.equal(commissionPence(10000, 1.3), 130);
  assert.equal(commissionPence(0, 5), 0);
  assert.equal(commissionPence(-500, 5), 0, 'a loss is not a negative charge');

  const b = bet({ stakePence: 510, odds: 3, bookmakerId: 'matchbook', commissionPct: 1.5 });
  const s = recompute(b, seqd(ev('won'), ev('commission', { commissionPct: 1.5 })), NOW);
  assert.equal(s.realisedPlPence, 1020 - 16);
  assert.ok(Number.isInteger(s.realisedPlPence), 'money left integer minor units');
});

test('a settled exchange winner is owed a commission event, and only once', () => {
  /*  What the settlement paths ask before they append. The rate comes back,
   *  never the amount: the fold works the amount out when the event lands, so
   *  there is one commission formula in the build and not two. */
  const b = bet({ stakePence: 5000, odds: 3, commissionPct: 2 });
  const won = seqd(ev('won'));
  assert.equal(commissionDue(b, won, recompute(b, won, NOW)), 2);

  const charged = seqd(ev('won'), ev('commission', { commissionPct: 2 }));
  assert.equal(commissionDue(b, charged, recompute(b, charged, NOW)), null, 'a second sweep charged it twice');

  const lost = seqd(ev('lost'));
  assert.equal(commissionDue(b, lost, recompute(b, lost, NOW)), null, 'a loser owes nothing');

  const noRate = bet({ stakePence: 5000, odds: 3, commissionPct: 0 });
  assert.equal(commissionDue(noRate, won, recompute(noRate, won, NOW)), null);

  const voided = seqd(ev('void'));
  assert.equal(commissionDue(b, voided, recompute(b, voided, NOW)), null, 'a void owes nothing');
});

test('commission comes off a part cash out on what that part actually won', () => {
  // Half of £50.00 pulled back for £40.00 is £15.00 of net winnings on the
  // half consumed, and 2% of that is 30 pence.
  const b = bet({ stakePence: 5000, odds: 3, commissionPct: 2 });
  const evs = seqd(
    ev('cash_out_partial', { fractionEighths: 4, returnedPence: 4000 }),
    ev('commission', { commissionPct: 2 }),
  );
  const s = recompute(b, evs, NOW);
  assert.equal(s.realisedPlPence, 1500 - 30);
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

test('a place is reported as PLACED, on both halves of a losing each way bet', () => {
  /*  £10.00 each way at 4.00 on a fifth the odds, three places paid, and the
   *  horse comes third of twelve.
   *
   *    win part    £10.00 at 4.00, loses            -£10.00
   *    place part  £10.00 at 1.60, places      £16 back, +£6.00
   *    the pair                                       -£4.00
   *
   *  That is the bet the ledger used to call Lost. The win part IS lost and
   *  says so; the place part is a place, and it used to read Won because the
   *  fold asked whether the money was positive instead of what happened. */
  const group = 'ew-4';
  const terms = 0.2;
  const win = bet({
    id: 'w', stakePence: 1000, odds: 4, shape: 'each_way', ewPart: 'win',
    ewGroupId: group, isEachWay: true, ewPlaceFraction: terms, placesPaid: 3,
  });
  const place = bet({
    id: 'p', stakePence: 1000, odds: Number((1 + (4 - 1) * terms).toFixed(3)),
    shape: 'each_way', ewPart: 'place', ewGroupId: group, isEachWay: true,
    ewPlaceFraction: terms, placesPaid: 3,
  });
  assert.equal(place.odds, 1.6, 'a fifth of 3.00 of net odds is 0.60 on top of the stake');

  const winState = recompute(win, seqd({ ...ev('lost'), betId: 'w' }), NOW);
  const placeState = recompute(place, seqd({ ...ev('placed'), betId: 'p' }), NOW);

  assert.equal(winState.outcome, 'lost');
  assert.equal(winState.realisedPlPence, -1000);
  assert.equal(placeState.outcome, 'placed', 'a place read as won off the sign of the money');
  assert.equal(placeState.returnedPence, 1600);
  assert.equal(placeState.realisedPlPence, 600);
  assert.equal(winState.realisedPlPence + placeState.realisedPlPence, -400, 'the pair is four pounds down');
});

test('a place that ends up out of pocket is still a place, not a loss', () => {
  /*  The collapse this replaces was `realised >= 0 ? won : lost`, so the
   *  moment anything took a place part below zero the ledger called it Lost.
   *  A place is a fact about the race and the money is reported beside it. */
  const place = bet({
    stakePence: 1000, odds: 1.6, shape: 'each_way', ewPart: 'place',
    isEachWay: true, ewPlaceFraction: 0.2, placesPaid: 3,
  });
  const s = recompute(place, seqd(
    ev('placed'),
    ev('manual_correction', { returnedPence: -700, afterResultKnown: true }),
  ), NOW);
  assert.equal(s.realisedPlPence, -100);
  assert.equal(s.outcome, 'placed');
});

test('a place on an exchange pays commission on the place winnings only', () => {
  const place = bet({
    stakePence: 1000, odds: 1.6, shape: 'each_way', ewPart: 'place', isEachWay: true,
    ewPlaceFraction: 0.2, placesPaid: 3, bookmakerId: 'smarkets', commissionPct: 2,
  });
  const evs = seqd(ev('placed'), ev('commission', { commissionPct: 2 }));
  const s = recompute(place, evs, NOW);
  // £6.00 of net winnings, 2% is 12 pence, and the place is still a place.
  assert.equal(s.realisedPlPence, 588);
  assert.equal(s.outcome, 'placed');
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

test('a voided free bet is neither a profit nor a loss', () => {
  const s = recompute(bet({ isFreeBet: true }), seqd(ev('void')), NOW);
  assert.equal(s.returnedPence, 0, 'the token does not come back as money');
  assert.equal(s.realisedPlPence, 0);
});

// -------------------------------------------------------- bonus funds
/*  THE OTHER HALF OF "MONEY THEY GAVE YOU", AND IT IS NOT THE SAME HALF.
 *
 *  A bonus funds stake and a free bet stake are both the bookmaker's money,
 *  so neither costs anything to lose and neither is in turnover. They part
 *  company on a win: a free bet pays the winnings alone, because the token
 *  is spent, and bonus funds pay the stake AND the winnings, because the
 *  restricted balance converts. That difference is 25 pounds on the bet
 *  below, it is impossible to reconstruct three weeks later, and it is the
 *  whole reason the review screen asks which one a slip is. */

test('bonus funds return the stake as well as the winnings', () => {
  const b = bet({ isBonusFunds: true });
  const s = recompute(b, seqd(ev('won')), NOW);
  assert.equal(s.returnedPence, 7500, 'stake and winnings, unlike a free bet');
  assert.equal(s.realisedPlPence, 7500, 'all of it is money the account did not have');
});

test('a free bet and bonus funds differ by exactly the stake', () => {
  const free = recompute(bet({ isFreeBet: true }), seqd(ev('won')), NOW);
  const bonus = recompute(bet({ isBonusFunds: true }), seqd(ev('won')), NOW);
  assert.equal(bonus.realisedPlPence - free.realisedPlPence, 2500);
});

test('losing bonus funds costs nothing, because they were never the bettor\'s', () => {
  const s = recompute(bet({ isBonusFunds: true }), seqd(ev('lost')), NOW);
  assert.equal(s.returnedPence, 0);
  assert.equal(s.realisedPlPence, 0);
});

test('a voided bonus funds bet is not a profit', () => {
  /*  Read off "does the stake come back" rather than "was it your money",
      this paid the whole stake out as pure profit on every void. */
  const s = recompute(bet({ isBonusFunds: true }), seqd(ev('void')), NOW);
  assert.equal(s.returnedPence, 0);
  assert.equal(s.realisedPlPence, 0);
  assert.equal(s.voidedStakePence, 2500);
});

test('bonus funds are out of turnover, so a return is a return on your own money', () => {
  const b = bet({ isBonusFunds: true });
  assert.equal(turnoverPence(b, recompute(b, seqd(ev('won')), NOW)), 0);
  const lost = bet({ isBonusFunds: true });
  assert.equal(turnoverPence(lost, recompute(lost, seqd(ev('lost')), NOW)), 0);
});

test('a quarter line splits a bonus funds stake the way it splits an own one', () => {
  /*  Half wins at the price and half pushes. The winning half pays stake and
      winnings; the pushed half goes back to the restricted balance and is
      not money arriving. */
  const b = bet({ isBonusFunds: true, odds: 3 });
  const s = recompute(b, seqd(ev('half_won')), NOW);
  assert.equal(s.returnedPence, 3750, 'half at 3.0, and nothing for the push');
  assert.equal(s.realisedPlPence, 3750);
  assert.equal(s.voidedStakePence, 1250);
});

test('a boost changes no arithmetic at all', () => {
  /*  The stake is the bettor's own and the price on the slip is the price the
      bet was struck at. Nothing here records what the price would have been
      unboosted, so nothing can compute an uplift, and a flag that guessed one
      would put an invented number into a return. */
  const plain = recompute(bet(), seqd(ev('won')), NOW);
  const boosted = recompute(bet({ isBoosted: true }), seqd(ev('won')), NOW);
  assert.equal(boosted.realisedPlPence, plain.realisedPlPence);
  assert.equal(boosted.returnedPence, plain.returnedPence);
  const b = bet({ isBoosted: true });
  assert.equal(turnoverPence(b, recompute(b, seqd(ev('won')), NOW)), 2500, 'still your own money');
});

// ------------------------------- what a deduction is charged on, per flag
/*  A Rule 4 and an exchange commission are both charged on winnings. The
 *  figure they are charged on came out of the return less the stake, which
 *  is right for a bet whose return HAS the stake in it and wrong for a free
 *  bet, whose return is the winnings alone. Both were undercharged on one,
 *  by half a Rule 4 and half a commission on the bet below. */

test('a Rule 4 on a free bet is charged on the whole winnings', () => {
  const b = bet({ isFreeBet: true, odds: 3 });
  const s = recompute(b, seqd(ev('won'), ev('rule4', { deductionPence: 25 })), NOW);
  // £25 at 3.0 as a token wins £50, and 25p in the pound off that is £12.50.
  assert.equal(s.realisedPlPence, 3750);
});

test('a Rule 4 on bonus funds is charged on the winnings and not the stake', () => {
  const b = bet({ isBonusFunds: true, odds: 3 });
  const s = recompute(b, seqd(ev('won'), ev('rule4', { deductionPence: 25 })), NOW);
  // £75 comes back, £50 of it is winnings, and £12.50 comes off that.
  assert.equal(s.returnedPence, 6250);
  assert.equal(s.realisedPlPence, 6250, 'none of the stake was ever the bettor\'s');
});

test('a Rule 4 takes the same money off a free bet as off the same bet in cash', () => {
  const own = recompute(bet({ odds: 3 }), seqd(ev('won'), ev('rule4', { deductionPence: 25 })), NOW);
  const free = recompute(bet({ isFreeBet: true, odds: 3 }), seqd(ev('won'), ev('rule4', { deductionPence: 25 })), NOW);
  /*  The deduction is the same £12.50 either way, so a WINNING free bet and
      the same bet in cash profit the same: both are the winnings less the
      deduction. Where they part is the loss and the turnover, which the tests
      above pin. Charged the old way the free bet came out £6.25 ahead of the
      cash bet on identical winnings, which is the deduction going missing. */
  assert.equal(free.realisedPlPence - own.realisedPlPence, 0);
});

test('commission on a free bet is charged on the whole winnings', () => {
  const b = bet({ isFreeBet: true, odds: 3, commissionPct: 2 });
  const won = recompute(b, seqd(ev('won')), NOW);
  assert.equal(commissionDue(b, [], won), 2);
  const s = recompute(b, seqd(ev('won'), ev('commission', { commissionPct: 2 })), NOW);
  // 2% of the £50 won, which is £1, not 2% of £25.
  assert.equal(s.realisedPlPence, 4900);
});

test('commission on bonus funds is charged on the winnings alone', () => {
  const b = bet({ isBonusFunds: true, odds: 3, commissionPct: 2 });
  const s = recompute(b, seqd(ev('won'), ev('commission', { commissionPct: 2 })), NOW);
  assert.equal(s.realisedPlPence, 7400);
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
