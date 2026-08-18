/* The period picker has to change the query.
 *
 * What it replaced did not. Settings held a Tracker/Lifetime toggle whose
 * whole effect was to add the imported bet count to one integer, while the
 * headline profit beside it went on describing a different set of bets.
 * Meanwhile "Yearly" did not exist at all: scopeBets had branches for a
 * day, a week, a month and all time, and every one of them assumed the
 * current year, so a bet from last March was counted in this March.
 *
 * These tests hold four properties: each period counts exactly the bets
 * inside it, the four nest (a week is inside its month, a month inside its
 * year, a year inside all time), a week that crosses a boundary keeps all
 * seven of its days, and the labels name the span they actually counted.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hydrate, TODAY } from '../src/js/data.js';
import { stats, weekRange } from '../src/js/stats.js';

const MS = new Intl.DateTimeFormat('en-GB', { month: 'short' });

const bet = (y, m, d, profit) => ({
  id: y + '-' + m + '-' + d + '-' + profit,
  event: 'A v B', selection: 'Over 2.5', market: 'Over/Under', book: 'bet365',
  odds: 2, stake: 10000, profit, outcome: profit >= 0 ? 'won' : 'lost',
  status: 'settled', placedAt: new Date(y, m, d, 15, 0).toISOString()
});
/* A fixed frame so the assertions do not move with the calendar: June of
   this year, June of last year, and a week that straddles May and June. */
const Y = TODAY.year, LAST = TODAY.year - 1;
const FIXTURE = [
  bet(Y, 5, 3, 1000),      // Wed 3 June-ish, inside the month
  bet(Y, 5, 4, 2000),
  bet(Y, 5, 28, 4000),     // late June
  bet(Y, 0, 9, 8000),      // January, same year
  bet(LAST, 5, 3, 500000)  // last June: same month number, different year
];
const period = (over) => Object.assign({
  period: 'm', year: Y, month: 5, focus: null, weekStart: 1, target: 0
}, over);

const load = () => hydrate({ bets: FIXTURE, pl: [] });

test('a month counts its own month, in its own year', () => {
  load();
  const s = stats(period(), MS);
  assert.equal(s.profit, 1000 + 2000 + 4000);
  assert.equal(s.bets, 3, 'last June must not be in this June');
});

test('a year counts every month of that year and no other', () => {
  load();
  assert.equal(stats(period({ period: 'y' }), MS).profit, 1000 + 2000 + 4000 + 8000);
  assert.equal(stats(period({ period: 'y', year: LAST }), MS).profit, 500000);
});

test('all time is every year at once', () => {
  load();
  const all = stats(period({ period: 'a' }), MS);
  assert.equal(all.profit, 1000 + 2000 + 4000 + 8000 + 500000);
  assert.equal(all.bets, FIXTURE.length);
});

test('the periods nest: week <= month <= year <= all time', () => {
  load();
  const m = stats(period(), MS).bets;
  const y = stats(period({ period: 'y' }), MS).bets;
  const a = stats(period({ period: 'a' }), MS).bets;
  const w = stats(period({ period: 'w', focus: 3 }), MS).bets;
  assert.ok(w <= m && m <= y && y === a - 1, [w, m, y, a].join(' '));
});

test('a week keeps all seven days when it crosses a month boundary', () => {
  /* weekRange used to clip both ends to the month on screen, so the week
     of the 1st was one or two days long and the bets on the other side of
     the boundary were in no period at all. */
  const r = weekRange(Y, 5, 1, 1);
  const days = Math.round((r.to - r.from) / 86400000) + 1;
  assert.equal(days, 7, 'a week is seven days wherever it starts');
  assert.ok(r.from <= new Date(Y, 5, 1), 'and it may start in the month before');
});

test('a week that starts in the previous month counts both halves', () => {
  /* Two bets three days apart across the 1st, in one week. */
  hydrate({ bets: [bet(Y, 4, 30, 700), bet(Y, 5, 2, 300)], pl: [] });
  const r = weekRange(Y, 5, 2, 1);
  const straddles = r.from.getMonth() === 4;
  const s = stats(period({ period: 'w', focus: 2 }), MS);
  assert.equal(s.profit, straddles ? 1000 : 300,
    straddles ? 'both days are in the week' : 'the 30th is in the week before');
});

test('the label names the span that was counted', () => {
  load();
  assert.equal(stats(period({ period: 'a' }), MS).label, 'all time');
  assert.equal(stats(period({ period: 'y', year: LAST }), MS).label, String(LAST));
  assert.match(stats(period({ period: 'm', year: LAST }), MS).label, new RegExp(String(LAST)));
});

test('an empty period is zero, not the month it fell back to', () => {
  load();
  const s = stats(period({ month: 10 }), MS);
  assert.equal(s.bets, 0);
  assert.equal(s.profit, 0);
});

test('imported figures land in the year they are dated, not the current one', () => {
  hydrate({
    bets: [],
    pl: [
      { date: LAST + '-06-15', period: 'month', profit: 250000, turnover: 900000, bets: 40, source: 'import' },
      { date: Y + '-06-15', period: 'month', profit: 10000, turnover: 50000, bets: 5, source: 'import' }
    ]
  });
  assert.equal(stats(period({ period: 'y', year: LAST }), MS).profit, 250000);
  assert.equal(stats(period({ period: 'y', year: Y }), MS).profit, 10000);
  assert.equal(stats(period({ period: 'a' }), MS).profit, 260000);
});
