import { test } from 'node:test';
import assert from 'node:assert/strict';
import { demoData } from '@/lib/data/demo';
import { balance, realisedPence, summarise, breakdown, byDay, byMonth, facets, offerSplit } from '@/lib/data/analytics';
import { ledgerSummary } from '@/lib/data/ledger-shape';
import {
  balanceAfterEach, balanceMinor, ownMoneyInMinor, signedMinor, totalMovements,
  type Movement,
} from '@/lib/domain/movements';
import { inBalance, balanceById } from '@/lib/domain/balances';

const NOW = new Date('2026-08-31T12:00:00Z');
const data = demoData(NOW);

/*  EVERY SUM HERE IS INSIDE ONE BALANCE. demoData returns the whole book now,
 *  and the whole book is three balances in two currencies: adding a euro
 *  deposit to a sterling starting figure would be the exact defect the
 *  balance separation exists to prevent, committed by the test that asserts
 *  it cannot happen. The product never sees the union either. */
const main = data.balances[0];
const mainBets = inBalance(data.bets, main.id);
const mainMoves = inBalance(data.movements, main.id);

const mv = (over: Partial<Movement> & { id: string; kind: Movement['kind']; amountMinor: number; occurredAt: string }): Movement => ({
  accountId: 'a1',
  balanceId: main.id,
  currency: 'GBP',
  bookmakerId: null,
  note: null,
  createdAt: over.occurredAt,
  ...over,
});

// -------------------------------------------------------------- the direction

test('the direction is the kind, never the sign on the amount', () => {
  /*  A withdrawal typed in with a minus in front of it must not become a
   *  deposit on the way to the balance. The amount is always positive and
   *  the kind carries the direction, in exactly one function. */
  assert.equal(signedMinor({ kind: 'deposit', amountMinor: 20000 }), 20000);
  assert.equal(signedMinor({ kind: 'withdrawal', amountMinor: 20000 }), -20000);
  assert.equal(signedMinor({ kind: 'withdrawal', amountMinor: -20000 }), -20000);
  assert.equal(signedMinor({ kind: 'deposit', amountMinor: -20000 }), 20000);
});

test('the totals separate what went in from what came out', () => {
  const t = totalMovements([
    mv({ id: 'a', kind: 'deposit', amountMinor: 20000, occurredAt: '2026-03-01T10:00:00Z' }),
    mv({ id: 'b', kind: 'deposit', amountMinor: 5000, occurredAt: '2026-04-01T10:00:00Z' }),
    mv({ id: 'c', kind: 'withdrawal', amountMinor: 30000, occurredAt: '2026-05-01T10:00:00Z' }),
  ]);
  assert.equal(t.depositedMinor, 25000);
  assert.equal(t.withdrawnMinor, 30000);
  assert.equal(t.netInMinor, -5000, 'more came out than went in');
  assert.equal(t.deposits, 2);
  assert.equal(t.withdrawals, 1);
  assert.equal(t.count, 3);
});

// ------------------------------------------------------- how much is theirs

test('the balance says how much of the money in there is the account holders own', () => {
  /*  THE QUESTION THE OLD BALANCE COULD NOT ANSWER. Four hundred up on the
   *  betting, six hundred paid in across the season: the balance is a
   *  thousand and the person is two hundred down on the money they have put
   *  in, and both facts have to be on the screen. */
  const movements = [
    mv({ id: 'd1', kind: 'deposit', amountMinor: 30000, occurredAt: '2026-03-01T10:00:00Z' }),
    mv({ id: 'd2', kind: 'deposit', amountMinor: 30000, occurredAt: '2026-04-01T10:00:00Z' }),
  ];
  assert.equal(ownMoneyInMinor(0, movements), 60000);
  assert.equal(balanceMinor(0, movements, 40000), 100000);
  // And it is two hundred down against the money paid in, which is the read.
  assert.equal(balanceMinor(0, movements, -20000) - ownMoneyInMinor(0, movements), -20000);
});

test('a withdrawal takes money out of the balance and leaves the profit alone', () => {
  const movements = [
    mv({ id: 'd1', kind: 'deposit', amountMinor: 50000, occurredAt: '2026-03-01T10:00:00Z' }),
    mv({ id: 'w1', kind: 'withdrawal', amountMinor: 20000, occurredAt: '2026-06-01T10:00:00Z' }),
  ];
  assert.equal(balanceMinor(10000, movements, 7500), 47500);
  assert.equal(ownMoneyInMinor(10000, movements), 40000);
});

// ------------------------------------------------ NOT in any betting figure

/*  THE DEFECT THIS WHOLE SEPARATION EXISTS TO PREVENT. If a deposit ever
 *  changes a return figure, somebody's record looks better for having put
 *  more money in, which is the most dishonest number this product could
 *  print. So the assertion is not "return is unchanged": it is that the
 *  ENTIRE summary is byte for byte what it was, because naming the figures
 *  that must not move is how the one nobody named gets missed. */

test('a deposit changes no figure derived from bets, anywhere', () => {
  const before = summarise(mainBets);
  const beforeFacets = facets(mainBets);
  const beforeSport = breakdown(mainBets, 'sport');
  const beforeDays = byDay(mainBets);
  const beforeMonths = byMonth(mainBets);
  const beforeOffers = offerSplit(mainBets);
  const beforeLedger = ledgerSummary(mainBets);

  const movements = [
    mv({ id: 'big', kind: 'deposit', amountMinor: 500000, occurredAt: '2026-08-01T10:00:00Z' }),
    mv({ id: 'out', kind: 'withdrawal', amountMinor: 250000, occurredAt: '2026-08-20T10:00:00Z' }),
  ];

  // Every one of these takes bets and only bets. There is no argument through
  // which a movement could reach them, which is the design.
  assert.deepEqual(summarise(mainBets), before);
  assert.deepEqual(facets(mainBets), beforeFacets);
  assert.deepEqual(breakdown(mainBets, 'sport'), beforeSport);
  assert.deepEqual(byDay(mainBets), beforeDays);
  assert.deepEqual(byMonth(mainBets), beforeMonths);
  assert.deepEqual(offerSplit(mainBets), beforeOffers);
  assert.deepEqual(ledgerSummary(mainBets), beforeLedger);

  // And the balance is the one thing that did move.
  const start = main.startMinor;
  assert.equal(
    balance(mainBets, movements, start) - balance(mainBets, [], start),
    250000,
  );
});

test('the return figure is identical with and without half a million paid in', () => {
  /*  Stated on its own as well, because it is the sentence somebody would
   *  read in a bug report. */
  const withNothing = summarise(mainBets);
  const movements = [mv({ id: 'x', kind: 'deposit', amountMinor: 500000, occurredAt: '2026-08-01T10:00:00Z' })];
  const stillTheSame = summarise(mainBets);
  assert.equal(stillTheSame.roi, withNothing.roi);
  assert.equal(stillTheSame.turnoverPence, withNothing.turnoverPence);
  assert.equal(stillTheSame.winRate, withNothing.winRate);
  assert.equal(stillTheSame.netPence, withNothing.netPence);
  assert.equal(stillTheSame.units, withNothing.units);
  assert.equal(totalMovements(movements).netInMinor, 500000);
});

// --------------------------------------------------------- running balance

test('the running balance folds bets and movements together in time order', () => {
  const bets = [
    { id: 'b1', eventAt: '2026-03-05T15:00:00Z', state: { status: 'settled', realisedPlPence: 5000 } },
    { id: 'b2', eventAt: '2026-03-15T15:00:00Z', state: { status: 'settled', realisedPlPence: -2000 } },
  ];
  const movements = [
    mv({ id: 'm1', kind: 'deposit', amountMinor: 10000, occurredAt: '2026-03-01T10:00:00Z' }),
    mv({ id: 'm2', kind: 'withdrawal', amountMinor: 3000, occurredAt: '2026-03-20T10:00:00Z' }),
  ];
  const after = balanceAfterEach(0, movements, bets);
  assert.equal(after.m1, 10000);
  // 10000 in, +5000 won, -2000 lost, then 3000 out.
  assert.equal(after.m2, 10000 + 5000 - 2000 - 3000);
});

test('an open bet does not move the running balance', () => {
  /*  A stake that is committed and not yet lost is exposure, which is its own
   *  figure and says so. Counting it would show a balance that recovers every
   *  time a bet is graded a loser. */
  const bets = [
    { id: 'b1', eventAt: '2026-03-05T15:00:00Z', state: { status: 'open', realisedPlPence: 0 } },
  ];
  const movements = [mv({ id: 'm1', kind: 'deposit', amountMinor: 10000, occurredAt: '2026-03-10T10:00:00Z' })];
  assert.equal(balanceAfterEach(0, movements, bets).m1, 10000);
});

test('the last running balance is the balance the top bar shows', () => {
  /*  Two ways of adding the same money have to agree, or somebody has to
   *  work out which of the two numbers on their screen is lying. */
  const start = main.startMinor;
  const after = balanceAfterEach(start, mainMoves, mainBets);
  const last = mainMoves[mainMoves.length - 1];
  const afterLast = after[last.id];

  // Every settled bet after that final movement, added on.
  const since = mainBets
    .filter((b) => b.state.status !== 'open' && Date.parse(b.eventAt) > Date.parse(last.occurredAt))
    .reduce((a, b) => a + b.state.realisedPlPence, 0);

  assert.equal(afterLast + since, balance(mainBets, mainMoves, start));
});

test('the example account has both kinds, or the two row shapes cannot be told apart on it', () => {
  const t = totalMovements(data.movements);
  assert.ok(t.deposits > 0, 'no deposits in the example account');
  assert.ok(t.withdrawals > 0, 'no withdrawals in the example account');
  for (const m of data.movements) {
    assert.ok(m.amountMinor > 0, 'a movement amount is never negative');
    /*  A movement takes ITS BALANCE'S currency, which is the account's only
     *  for an account that keeps one balance. Money paid into the euro
     *  account is not money in the sterling one, and this is the assertion
     *  that stops it being filed as though it were. */
    const bal = balanceById(data.balances, m.balanceId);
    assert.ok(bal, `${m.id} belongs to no balance`);
    assert.equal(m.currency, bal.currency, 'a movement is in its balance currency');
  }
});

test('the balance is their own money in plus the realised profit, and nothing else', () => {
  const start = main.startMinor;
  assert.equal(
    balance(mainBets, mainMoves, start),
    ownMoneyInMinor(start, mainMoves) + realisedPence(mainBets),
  );
});
