/* The demo record has to reconcile.
 *
 * The demo page tells the reader "add the column up and it reconciles with
 * the headline, which is the least a record should do". That is a claim
 * about arithmetic made on a public page, so it is a claim worth a test.
 *
 * These also pin the shape of the record. The generator went through two
 * wrong versions before this one: independently flipped coins produced a
 * record where 6.01+ shots returned +29% and the middle of the book lost
 * 14%, and controlling the bands alone then left horse racing at +37.7%.
 * Both were plausible-looking and both said something false about betting,
 * so the shape is asserted rather than trusted.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEMO, DEMO_BETS, DEMO_DAYS, DEMO_DRAWDOWN } from '../src/js/sample.js';

const settled = DEMO_BETS.filter(b => b.result !== 'pending');

test('the record is the size the page says it is', () => {
  assert.equal(DEMO_BETS.length, 486);
  assert.equal(DEMO_DAYS, 120);
  assert.ok(DEMO.days.length > 100, 'bets should be spread across most of the window');
});

test('every settled bet obeys the profit formula', () => {
  for (const b of settled) {
    if (b.result === 'won') {
      assert.equal(b.profit, Math.round(b.stake * (b.odds - 1)),
        b.id + ': a win is stake times odds minus one');
    } else if (b.result === 'lost') {
      assert.equal(b.profit, -b.stake, b.id + ': a loss is minus the stake');
    } else if (b.result === 'void' || b.result === 'push') {
      assert.equal(b.profit, 0, b.id + ': void and push return the stake and make nothing');
    } else if (b.result === 'cash-profit') {
      assert.ok(b.profit > 0, b.id + ': a cash out at a profit is positive');
    } else if (b.result === 'cash-loss') {
      assert.ok(b.profit < 0 && b.profit > -b.stake,
        b.id + ': cashing out at a loss recovers something');
    } else {
      assert.fail(b.id + ': unexpected result ' + b.result);
    }
  }
});

test('pending bets never touch profit and loss', () => {
  for (const b of DEMO_BETS.filter(x => x.result === 'pending')) {
    assert.equal(b.profit, 0, 'a running bet has no result yet');
  }
  assert.ok(DEMO.pendingCount > 0, 'the pending stake tile needs something behind it');
  assert.equal(
    DEMO.pendingStake,
    DEMO_BETS.filter(b => b.result === 'pending').reduce((a, b) => a + b.stake, 0));
});

test('the headline is the sum of the rows', () => {
  assert.equal(DEMO.total.profit, settled.reduce((a, b) => a + b.profit, 0));
  assert.equal(DEMO.total.staked, settled.reduce((a, b) => a + b.stake, 0));
  assert.equal(DEMO.total.bets, settled.length);
});

test('every breakdown sums back to the same total', () => {
  const sum = rows => rows.reduce((a, r) => a + r.profit, 0);
  assert.equal(sum(DEMO.byBand), DEMO.total.profit, 'odds bands must partition the record');
  assert.equal(sum(DEMO.bySport), DEMO.total.profit, 'sports must partition the record');
  /* Competitions cover football only, so they sum to less. */
  assert.ok(Math.abs(sum(DEMO.byComp)) <= Math.abs(DEMO.total.profit) + 100000);
});

test('the cumulative curve ends on the total', () => {
  assert.equal(DEMO.curve.length, settled.length);
  assert.equal(DEMO.curve[DEMO.curve.length - 1], DEMO.total.profit);
});

test('void and push are excluded from the win rate', () => {
  const neutral = settled.filter(b => b.result === 'void' || b.result === 'push');
  assert.ok(neutral.length > 0, 'the record should contain both, they are distinct outcomes');
  assert.equal(DEMO.total.wins + DEMO.total.losses, settled.length - neutral.length);
});

test('the shape says something true rather than something flattering', () => {
  const band = label => DEMO.byBand.find(b => b.label === label);
  const sport = label => DEMO.bySport.find(b => b.label === label);

  /* The edge is in the middle of the book and the long shots leak. This is
     the ordinary finding, and the opposite would advertise long shots. */
  assert.ok(band('2.01 to 3.50').roi > 0, 'the middle band carries the edge');
  assert.ok(band('6.01 and above').roi < 0, 'long shots must not be the best band');
  assert.ok(band('2.01 to 3.50').roi > band('6.01 and above').roi);

  /* Racing is the sport the product refuses to settle. A demo showing it
     as the most profitable thing in the record argues against the product
     as well as against reality. */
  assert.ok(sport('Horse racing').roi < 0, 'racing must not be the winner here');

  /* Overall: a small edge, not a fortune. Anything above about 10% return
     on turnover over 480 bets is a claim nobody should believe. */
  assert.ok(DEMO.total.roi > 0 && DEMO.total.roi < 8,
    'the record should show a small edge, measured ' + DEMO.total.roi.toFixed(1) + '%');

  /* And it should lose for a while, because that is the part the page is
     about. */
  assert.ok(DEMO_DRAWDOWN.depth > 50000,
    'the record needs a real losing run for the curve caption to point at');
});

test('the win rate looks worse than the return, which is the point', () => {
  assert.ok(DEMO.total.winRate < 50,
    'most bets lose even in a profitable record, and the page says so');
});
