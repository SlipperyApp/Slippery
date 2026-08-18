/* Two ledgers, counted apart.
 *
 * A bet logged through Slippery has a slip behind it: a selection, a
 * price, a stake, a result that can be checked against a feed. An imported
 * figure is a date and an amount and nothing else, brought across from
 * wherever somebody kept their record before.
 *
 * Both are true, and both belong in the profit for the period they fall
 * in — the previous build wrote imported history, drew it on the calendar,
 * and then left it out of every total, so importing a year moved the P/L
 * by exactly zero. But only one of the two can be checked, so anything
 * that describes HOW the bets went must come from the bets alone. A figure
 * with no result cannot be a win; a day that is one number cannot be a run
 * of good days.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hydrate, TODAY } from '../src/js/data.js';
import { stats, reconcile } from '../src/js/stats.js';

const MS = new Intl.DateTimeFormat('en-GB', { month: 'short' });
const Y = TODAY.year, M = TODAY.month;
const iso = d => Y + '-' + String(M + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0');

const bet = (d, profit, over = {}) => Object.assign({
  id: 'b' + d + profit, event: 'A v B', selection: 'Over 2.5', market: 'Over/Under',
  book: 'bet365', odds: 2, stake: 10000, profit,
  outcome: profit >= 0 ? 'won' : 'lost', status: 'settled',
  placedAt: new Date(Y, M, d, 15, 0).toISOString()
}, over);
const fig = (d, profit, over = {}) => Object.assign({
  id: 'p' + d, date: iso(d), period: 'day', profit, turnover: 0, bets: 0, source: 'import'
}, over);

const period = over => Object.assign({
  period: 'm', year: Y, month: M, focus: null, weekStart: 1
}, over);

/* Two won bets, one lost, and a fat imported day that dwarfs all three. */
const load = () => hydrate({
  bets: [bet(3, 1000), bet(4, 2000), bet(5, -3000)],
  pl: [fig(20, 500000, { turnover: 2000000, bets: 300 })]
});

test('an imported figure moves the profit for its period', () => {
  load();
  assert.equal(stats(period(), MS).profit, 1000 + 2000 - 3000 + 500000);
});

test('an imported figure never moves the win rate', () => {
  load();
  const s = stats(period(), MS);
  /* Two won of three graded, whatever the imported day says. */
  assert.equal(s.won, 2);
  assert.equal(s.lost, 1);
  assert.equal(s.winRate, 67);
});

test('an imported figure is never the best or the worst day', () => {
  load();
  const s = stats(period(), MS);
  assert.equal(s.best, 2000, '£5,000 imported is not a day this tracker saw');
  assert.equal(s.worst, -3000);
});

test('an imported figure cannot extend a winning streak', () => {
  /* Two winning days, then a loss, then a large imported day. If the
     imported day counted, the streak would read three. */
  hydrate({ bets: [bet(3, 1000), bet(4, 2000), bet(5, -3000)], pl: [fig(6, 900000)] });
  assert.equal(stats(period(), MS).streak, 2);
});

test('turnover and ROI take the imported turnover with the imported profit', () => {
  /* Adding the profit without the turnover would divide a bigger number by
     the same stake and inflate the ROI. */
  load();
  const s = stats(period(), MS);
  assert.equal(s.turnover, 30000 + 2000000);
  assert.equal(Math.round(s.roi * 100) / 100, Math.round((s.profit / s.turnover * 100) * 100) / 100);
});

test('the reconciliation adds up, and says which side each figure is on', () => {
  load();
  const r = reconcile(period());
  assert.equal(r.logged, 0, 'the three bets net to zero');
  assert.equal(r.loggedBets, 3);
  assert.equal(r.imported, 500000);
  assert.equal(r.importedRows.length, 1);
  assert.equal(r.total, r.logged + r.imported);
  assert.equal(r.total, stats(period(), MS).profit,
    'the reconciliation and the headline must be the same number');
});

test('the reconciliation follows the period, not the whole store', () => {
  hydrate({
    bets: [bet(3, 1000)],
    pl: [fig(3, 4000), { id: 'old', date: (Y - 1) + '-03-03', period: 'day',
                         profit: 999999, turnover: 0, bets: 0, source: 'import' }]
  });
  const here = reconcile(period());
  assert.equal(here.imported, 4000, 'last year is not in this month');
  const all = reconcile(period({ period: 'a' }));
  assert.equal(all.imported, 4000 + 999999);
});

test('with nothing imported the two sides agree and the total is the ledger', () => {
  hydrate({ bets: [bet(3, 1000)], pl: [] });
  const r = reconcile(period());
  assert.equal(r.imported, 0);
  assert.equal(r.importedRows.length, 0);
  assert.equal(r.total, r.logged);
  assert.equal(stats(period(), MS).includesImported, false);
});
