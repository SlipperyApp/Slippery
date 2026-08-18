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
import { DEMO, DEMO_BETS, DEMO_WINDOW, DEMO_DAYS, DEMO_DRAWDOWN, demoPayload } from '../src/js/sample.js';

/* Everything the demo PAGE claims is about the 120 day window. The two
   years behind it exist for the tutorial, which needs a Yearly period and
   a year-on-year comparison to walk somebody through, and they are checked
   separately at the bottom. */
const settled = DEMO_WINDOW.filter(b => b.result !== 'pending');

test('the record is the size the page says it is', () => {
  assert.equal(DEMO_WINDOW.length, 486);
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

/* ONE GENERATOR, TWO WINDOWS.
   The demo claims 486 bets over 120 days. The tutorial needs a Yearly
   period and a year-on-year comparison, which 120 days cannot show. Both
   come out of the same seeded set, so the two claims cannot drift apart. */
test('two years sit behind the window the demo shows', () => {
  assert.ok(DEMO_BETS.length > DEMO_WINDOW.length,
    'there should be history behind the demo window');
  const back = Math.max(...DEMO_BETS.map(b => b.dayBack));
  assert.ok(back > 700, 'the set should reach back about two years, reached ' + back);
  /* And the window really is the most recent part of it. */
  for (const b of DEMO_WINDOW) assert.ok(b.dayBack < DEMO_DAYS);
});

test('the demo loads the window, the tutorial can ask for the rest', () => {
  assert.equal(demoPayload().bets.length, DEMO_WINDOW.length);
  assert.equal(demoPayload({ full: true }).bets.length, DEMO_BETS.length);
});

test('the payload is shaped the way the API answers', () => {
  const one = demoPayload().bets[0];
  for (const k of ['id', 'event', 'selection', 'market', 'odds', 'stake', 'status', 'placedAt']) {
    assert.ok(k in one, 'a bet from the API has ' + k);
  }
  assert.equal(demoPayload().trial, null, 'there is no account, so there is no trial');
  assert.deepEqual(demoPayload().pl, [], 'and nothing imported');
  /* Midday UTC, so no timezone can move a bet to the day before and make
     the calendar disagree with the ledger. */
  for (const b of demoPayload().bets) assert.match(b.placedAt, /T12:00:00/);
});
