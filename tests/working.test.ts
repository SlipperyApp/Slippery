import { test } from 'node:test';
import assert from 'node:assert/strict';
import { explain, recompute } from '@/lib/domain/fold';
import { working, betTags, type WorkingBet } from '@/lib/domain/working';
import { placeTerms } from '@/lib/odds';
import { demoData } from '@/lib/data/demo';
import type { Bet, SettlementEvent } from '@/lib/domain/types';

/** "One tap on any settled bet reveals the maths. This builds trust in every
 *  other number."
 *
 *  Which makes the maths the one figure on the screen that must not be
 *  derived a second time. If the working recomputed a return of its own, a
 *  rounding difference between it and the fold would be the product showing
 *  somebody the sum and the answer, and disagreeing with itself about which
 *  one is right. */

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

function settle(b: Bet, events: SettlementEvent[]): WorkingBet {
  return { ...b, events, state: recompute(b, events, NOW) };
}

const labels = (w: ReturnType<typeof working>) => w.lines.map((l) => l.label);
const value = (w: ReturnType<typeof working>, label: string) =>
  w.lines.find((l) => l.label === label);

// ------------------------------------------------------- the fold explains

test('explain returns the same state recompute does, event for event', () => {
  const b = bet({ commissionPct: 5 });
  const events = seqd(ev('won'), ev('commission', { commissionPct: 5 }));
  const { state, steps } = explain(b, events, NOW);

  assert.deepEqual(state, recompute(b, events, NOW), 'two answers from one fold');
  assert.equal(steps.length, 2);
  assert.equal(steps[0].returned, 7500);
  assert.equal(steps[0].stakePortion, 2500);
  assert.equal(steps[1].returned, -250, 'commission is 5% of the 5000 net winnings');
  assert.equal(steps[steps.length - 1].realisedAfter, state.realisedPlPence);
  assert.equal(steps[steps.length - 1].remainingAfter, state.remainingStakePence);
});

test('a result that lands after the bet closed is kept and marked, never folded twice', () => {
  const events = seqd(ev('won'), ev('lost'));
  const { state, steps } = explain(bet(), events, NOW);
  assert.equal(steps[1].ignored, true);
  assert.equal(steps[1].returned, 0);
  assert.equal(state.realisedPlPence, 5000, 'the later result changed the profit');
});

test('the steps of two partial cash outs are of what was left each time', () => {
  const events = seqd(
    ev('cash_out_partial', { fractionEighths: 4, returnedPence: 2000 }),
    ev('cash_out_partial', { fractionEighths: 4, returnedPence: 900 }),
  );
  const { steps } = explain(bet(), events, NOW);
  assert.equal(steps[0].stakePortion, 1250, 'half of £25.00');
  assert.equal(steps[1].stakePortion, 625, 'half of what was LEFT, not half of the original');
  assert.equal(steps[1].remainingAfter, 625);
});

// ------------------------------------------------------------ the working

test('a winner shows stake, price, what came back and the net', () => {
  const w = working(settle(bet(), seqd(ev('won'))));
  assert.deepEqual(labels(w), ['Stake', 'Price', 'Came back', 'Profit', 'In units']);
  assert.equal(value(w, 'Stake')!.minor, 2500);
  assert.equal(value(w, 'Price')!.odds, 3);
  assert.equal(value(w, 'Came back')!.minor, 7500);
  assert.equal(w.netPence, 5000);
  assert.equal(w.units, 2);
});

test('the net printed is bet_state and not a sum of the lines', () => {
  /*  Every displayed figure reads bet_state. A working that added its own
   *  lines up would be a second grader in the browser, and the first penny
   *  of rounding difference would put the sum and the answer on the same
   *  screen disagreeing. */
  for (const b of demoData(new Date('2026-08-31T12:00:00Z')).bets.slice(0, 120)) {
    const w = working(b);
    assert.equal(w.netPence, b.state.realisedPlPence, `bet ${b.id}`);
    assert.equal(w.units, b.state.units);
  }
});

test('a commission line appears only when commission was charged', () => {
  const paid = working(settle(bet({ commissionPct: 2 }), seqd(ev('won'), ev('commission', { commissionPct: 2 }))));
  assert.ok(labels(paid).includes('Commission at 2%'));
  assert.equal(value(paid, 'Commission at 2%')!.minor, -100, '2% of £50.00 of winnings');
  assert.ok(labels(paid).includes('Back in total'), 'more than one part, so the sum needs a total');

  const none = working(settle(bet({ commissionPct: 2 }), seqd(ev('lost'), ev('commission', { commissionPct: 2 }))));
  assert.equal(value(none, 'Commission at 2%')!.minor, 0, 'a losing bet pays no commission');
  assert.ok(!Object.is(value(none, 'Commission at 2%')!.minor, -0), 'a negative zero prints as "-0.00"');
});

test('a Rule 4 says what it took and off what', () => {
  const w = working(settle(bet(), seqd(ev('won'), ev('rule4', { deductionPence: 20, afterResultKnown: true }))));
  const line = w.lines.find((l) => l.label.startsWith('Rule 4'));
  assert.ok(line, `no Rule 4 line in ${labels(w).join(', ')}`);
  assert.equal(line.label, 'Rule 4, 20p in the pound');
  assert.equal(line.minor, -1000, '20p in the pound off £50.00 of winnings');
  assert.equal(line.late, true, 'a deduction entered after the result is a different fact');
});

test('a partially cashed out bet shows the parts and what is still standing', () => {
  const w = working(settle(bet(), seqd(
    ev('cash_out_partial', { fractionEighths: 4, returnedPence: 2000 }),
    ev('cash_out_partial', { fractionEighths: 2, returnedPence: 600 }),
  )));
  const groups = [...new Set(w.lines.map((l) => l.group).filter(Boolean))];
  assert.deepEqual(groups, [
    'Cashed out 4 of 8 of what was still standing',
    'Cashed out 2 of 8 of what was still standing',
  ]);
  const first = w.lines.filter((l) => l.groupKey === w.lines.find((x) => x.group === groups[0])!.groupKey);
  assert.deepEqual(first.map((l) => l.label), ['Stake it came out of', 'The bookmaker paid', 'Still standing after it']);
  assert.equal(first[0].minor, 1250);
  assert.equal(first[2].minor, 1250);
  // 2 of 8 of the £12.50 left is £3.13, rounded up, so £9.37 is still running.
  assert.equal(value(w, 'Still standing')!.minor, 937, 'the remainder is still running');
});

test('two pulls of the same size are two groups, not one heading over six lines', () => {
  /*  Both pulls read "Cashed out 4 of 8 of what was still standing" word for
   *  word, so a view that started a new group when the heading text changed
   *  drew one heading over both and the second pull's stake looked like part
   *  of the first. */
  const w = working(settle(bet(), seqd(
    ev('cash_out_partial', { fractionEighths: 4, returnedPence: 2000 }),
    ev('cash_out_partial', { fractionEighths: 4, returnedPence: 800 }),
  )));
  const headings = w.lines.filter((l) => l.group).map((l) => l.group);
  assert.equal(new Set(headings).size, 1, 'the two headings are meant to be identical');
  assert.equal(new Set(w.lines.filter((l) => l.group).map((l) => l.groupKey)).size, 2);
});

test('an each way bet shows both halves, and its place terms as a fraction', () => {
  const group = 'ew1';
  const win = settle(bet({
    id: 'w', stakePence: 1250, odds: 11, shape: 'each_way', ewPart: 'win',
    ewGroupId: group, isEachWay: true, ewPlaceFraction: 0.2,
  }), seqd(ev('lost')));
  const place = settle(bet({
    id: 'p', stakePence: 1250, odds: 3, shape: 'each_way', ewPart: 'place',
    ewGroupId: group, isEachWay: true, ewPlaceFraction: 0.2,
  }), seqd(ev('placed')));

  // Opened from either half, the sum is the whole bet and reads win first.
  for (const [a, b] of [[win, place], [place, win]] as const) {
    const w = working(a, b);
    assert.equal(w.halfOnly, false);
    assert.deepEqual([...new Set(w.lines.map((l) => l.group).filter(Boolean))], ['The win half', 'The place half']);
    assert.equal(w.netPence, 1250, 'a horse that placed at 11.00 with a fifth the odds');
    assert.equal(value(w, 'Staked in total')!.minor, 2500);
    assert.equal(value(w, 'Back in total')!.minor, 3750);
    const placePrice = w.lines.find((l) => l.group === 'The place half' && l.label === 'Price');
    assert.equal(placePrice!.odds, 3);
    assert.match(placePrice!.hint ?? '', /^1\/5 of the win price/);
  }

  // And says so when the other half is not to hand, rather than presenting
  // half a bet as the whole one.
  assert.equal(working(win).halfOnly, true);
  assert.equal(working(win, place).halfOnly, false);
});

test('place terms come back as a board would write them', () => {
  assert.equal(placeTerms(0.2), '1/5');
  assert.equal(placeTerms(0.25), '1/4');
  assert.equal(placeTerms(1 / 3), '1/3');
  assert.equal(placeTerms(null), '');
  assert.equal(placeTerms(0), '');
  assert.equal(placeTerms(0.3), '0.3', 'terms nobody writes as a unit fraction are not invented');
});

test('a lay bet is worked out from the liability, and says whose stake it won', () => {
  const w = working(settle(bet({ side: 'lay', stakePence: 2500, odds: 3, liabilityPence: 5000 }), seqd(ev('won'))));
  assert.equal(value(w, 'Your liability')!.minor, 5000);
  assert.equal(value(w, 'The backer put up')!.minor, 2500);
  assert.equal(w.netPence, 2500);
  assert.ok(w.notes.some((s) => s.includes('liability')));
});

test('a free bet says the stake is not coming back', () => {
  const w = working(settle(bet({ isFreeBet: true }), seqd(ev('won'))));
  assert.equal(value(w, 'Came back')!.minor, 5000, 'the winnings, not the winnings plus the stake');
  assert.equal(w.netPence, 5000);
  assert.ok(w.notes.some((s) => s.includes('free bet')));
});

test('a quarter line explains the split rather than printing half_won', () => {
  const w = working(settle(bet({ odds: 2 }), seqd(ev('half_won'))));
  assert.ok(!labels(w).some((l) => l.includes('_')), `a type name reached the screen: ${labels(w).join(', ')}`);
  assert.equal(value(w, 'Came back')!.minor, 3750);
  assert.ok(w.notes.some((s) => s.includes('quarter line')));
});

test('an open bet shows what it would return and claims no profit', () => {
  const w = working(settle(bet(), []));
  assert.deepEqual(labels(w), ['Stake', 'Price', 'To return if it wins']);
  assert.equal(value(w, 'To return if it wins')!.minor, 7500);
  assert.equal(w.netPence, 0);
});

test('no line label carries a settlement type name, on any bet in the account', () => {
  /*  This is the whole feature. `half_won`, `cash_out_partial` and `rule4`
   *  are the correct names for what happened and none of them is an
   *  explanation, and they were what the sheet used to list. */
  const banned = /_|cash_out|half_won|half_lost|promo_refund|manual_correction|\bROI\b/;
  for (const b of demoData(new Date('2026-08-31T12:00:00Z')).bets) {
    for (const line of working(b).lines) {
      assert.ok(!banned.test(line.label), `${b.id}: "${line.label}"`);
      assert.ok(line.label.length > 2, `${b.id}: an empty label`);
    }
  }
});

test('exactly one of the four value slots is filled on every line', () => {
  // The view formats whichever one it is. Two filled would mean the view
  // silently picks, and a price would print as money.
  for (const b of demoData(new Date('2026-08-31T12:00:00Z')).bets.slice(0, 200)) {
    for (const l of working(b).lines) {
      const filled = [l.minor, l.odds, l.units, l.text].filter((v) => v !== null).length;
      assert.equal(filled, 1, `${b.id}: "${l.label}" has ${filled} values`);
    }
  }
});

// ------------------------------------------------------------------- tags

test('the row and the export call a bet the same things', () => {
  assert.deepEqual(betTags(bet()), []);
  assert.deepEqual(betTags(bet({ isFreeBet: true, isBoosted: true })), ['Free bet', 'Boosted']);
  assert.deepEqual(betTags(bet({ side: 'lay' })), ['Lay']);
  // An each way marker without its terms is the outcome without the terms
  // that produced it, so the terms ride with the marker, and a bet that has
  // neither half of them still says Each way rather than a dangling comma.
  assert.deepEqual(betTags(bet({ isEachWay: true })), ['Each way']);
  assert.deepEqual(
    betTags(bet({ isEachWay: true, ewPlaceFraction: 0.2, placesPaid: 3 })),
    ['Each way, 1/5, places 1-3'],
  );
  assert.deepEqual(betTags(bet({ isEachWay: true, ewPlaceFraction: 0.2 })), ['Each way, 1/5']);
  assert.deepEqual(betTags(bet({ isEachWay: true, placesPaid: 4 })), ['Each way, places 1-4']);
  assert.deepEqual(betTags(bet({ slipBacked: false })), ['Typed in']);
  // Imported and typed in are the same fact, and the vaguer one loses.
  assert.deepEqual(betTags(bet({ slipBacked: false, source: 'csv_import' })), ['Imported']);
  assert.deepEqual(betTags(bet({ arbGroupId: 'a1' })), ['Arb']);
});
