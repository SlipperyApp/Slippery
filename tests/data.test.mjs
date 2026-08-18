/* Store and reconciliation tests.
 *
 * The demo dataset these used to check is gone. The property it existed to
 * protect is not, and it is the one that matters most in a profit-and-loss
 * tracker: every figure the app shows must be the same number seen from a
 * different angle. A previous build displayed "Net all time +£6,339.48"
 * directly above an "All time £15,079" KPI, and two different lifetime ROIs,
 * because the period total summed one array while the KPI read a separate
 * constant. There is no separate constant any more, everything is derived
 * from the ledger the server sent, and these tests hold that line.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  LEDGER, PENDING, DAY_TOTALS, TODAY,
  hydrate, addBet, settleLocal, monthTotal, yearTotal, betsOn
} from '../src/js/data.js';
import { lifetime, importedTotals, usablePl } from '../src/js/stats.js';

/* Imported history is a dated profit or loss with nothing behind it. There
   used to be a second store, IMPORTED, holding it as one aggregate blob
   that nothing ever wrote to, so imports moved the profit and loss figure
   by exactly zero while still drawing on the calendar. These rows are the
   one representation now. */
const iso = day => new Date(Date.UTC(TODAY.year, TODAY.month, day)).toISOString().slice(0, 10);
const plRow = (day, period, profit, over = {}) => Object.assign(
  { date: iso(day), period, profit, turnover: 0, bets: 0, source: 'import' }, over);

/* A day builder, so the fixtures below read as bets rather than as dates. */
const at = (day, over = {}) => Object.assign({
  id: 'x' + Math.random().toString(36).slice(2),
  event: 'Arsenal v Chelsea', selection: 'Over 2.5 Goals', market: 'Over/Under',
  book: 'bet365', odds: 1.9, stake: 10000, profit: 9000, outcome: 'won',
  status: 'settled',
  placedAt: new Date(TODAY.year, TODAY.month, day, 15, 30).toISOString(),
  source: 'upload'
}, over);

const load = bets => hydrate({ bets });

test('a fresh store is empty, and says so rather than inventing a figure', () => {
  load([]);
  assert.equal(LEDGER.length, 0);
  assert.equal(PENDING.length, 0);
  assert.equal(monthTotal(TODAY.year, TODAY.month), 0);
  assert.equal(yearTotal(TODAY.year), 0);
  const l = lifetime();
  assert.equal(l.profit, 0);
  assert.equal(l.bets, 0);
  assert.equal(l.roi, 0, 'no turnover must not divide by zero');
  assert.equal(l.avgOdds, 0);
});

test('hydrate splits settled from running', () => {
  load([
    at(1), at(2),
    at(3, { status: 'pending', outcome: null, profit: null }),
    at(4, { status: 'ask', outcome: null, profit: null, reason: 'Abandoned' })
  ]);
  assert.equal(LEDGER.length, 2);
  assert.equal(PENDING.length, 2, 'an asked bet is still running until the user answers');
});

test('every day sums EXACTLY to the bets in it', () => {
  load([
    at(4, { profit: 9000 }), at(4, { profit: -5000 }), at(4, { profit: 1234 }),
    at(9, { profit: -2500 }), at(9, { profit: 40000 })
  ]);
  assert.equal(DAY_TOTALS[TODAY.year][TODAY.month][4], 9000 - 5000 + 1234);
  assert.equal(DAY_TOTALS[TODAY.year][TODAY.month][9], -2500 + 40000);
  assert.equal(betsOn(TODAY.year, TODAY.month, 4).reduce((a, b) => a + b.profit, 0),
    DAY_TOTALS[TODAY.year][TODAY.month][4]);
});

test('the month is exactly the sum of its days, and the year of its months', () => {
  load([at(2, { profit: 1111 }), at(7, { profit: -222 }), at(19, { profit: 30000 })]);
  const days = DAY_TOTALS[TODAY.year][TODAY.month];
  const fromDays = Object.values(days).reduce((a, b) => a + b, 0);
  assert.equal(monthTotal(TODAY.year, TODAY.month), fromDays);
  assert.equal(yearTotal(TODAY.year), fromDays, 'one month of data means the year equals it');
});

test('all time is the ledger plus imports, and cannot drift from either', () => {
  hydrate({
    bets: [at(3, { profit: 9000, stake: 10000 }), at(5, { profit: -4000, stake: 4000 })],
    pl: [plRow(12, 'day', 1_000_000, { turnover: 20_000_000, bets: 2000 })]
  });

  const l = lifetime();
  const imp = importedTotals();
  const ledgerProfit = LEDGER.reduce((a, b) => a + b.profit, 0);
  const ledgerTurnover = LEDGER.reduce((a, b) => a + b.stake, 0);

  assert.equal(imp.profit, 1_000_000);
  assert.equal(l.profit, ledgerProfit + imp.profit);
  assert.equal(l.turnover, ledgerTurnover + imp.turnover);
  assert.equal(l.bets, LEDGER.length + imp.bets);
  /* The exact figure matters less than the fact that there is only one way
     to compute it. Recomputing it here by hand must agree. */
  assert.equal(l.roi, (ledgerProfit + imp.profit) / (ledgerTurnover + imp.turnover) * 100);
});

test('imports alone still reconcile, with an empty ledger', () => {
  hydrate({ bets: [], pl: [plRow(9, 'day', 500_000, { turnover: 10_000_000, bets: 1200 })] });
  const l = lifetime();
  assert.equal(l.profit, 500_000);
  assert.equal(l.bets, 1200);
  assert.equal(l.turnover, 10_000_000);
});

test('an imported figure actually reaches the profit and loss', () => {
  /* The bug this exists for: rows were written, drawn on the calendar, and
     then left out of every total, so importing a year of history moved the
     headline figure by nothing at all. */
  hydrate({ bets: [], pl: [] });
  const before = lifetime().profit;
  hydrate({ bets: [], pl: [plRow(6, 'day', 25_000)] });
  assert.equal(lifetime().profit, before + 25_000);
});

test('a month figure and its own days never both count', () => {
  /* Somebody can hold a total for the month and totals for four days in
     it. Adding both counts the month twice; the finer record wins. */
  hydrate({
    bets: [],
    pl: [
      plRow(1, 'month', 90_000, { bets: 40 }),
      plRow(4, 'day', 10_000, { bets: 3 }),
      plRow(11, 'day', -6_000, { bets: 2 })
    ]
  });
  const kept = usablePl();
  assert.equal(kept.length, 2, 'the month is dropped, its two days survive');
  assert.ok(kept.every(p => p.period === 'day'));
  assert.equal(importedTotals().profit, 4_000);
  assert.equal(importedTotals().bets, 5);
});

test('a month figure with no days inside it still counts', () => {
  hydrate({ bets: [], pl: [plRow(1, 'month', 90_000, { bets: 40 })] });
  assert.equal(importedTotals().profit, 90_000);
  assert.equal(importedTotals().bets, 40);
});

test('money stays integer pence through the whole store', () => {
  load([at(1, { profit: 7655, stake: 30618 }), at(2, { profit: -22500, stake: 22500 })]);
  for (const b of LEDGER) {
    assert.equal(Number.isInteger(b.profit), true, b.profit + ' is not whole pence');
    assert.equal(Number.isInteger(b.stake), true, b.stake + ' is not whole pence');
  }
  assert.equal(Number.isInteger(monthTotal(TODAY.year, TODAY.month)), true);
});

test('adding a bet lands it in the right list and moves the day total', () => {
  load([]);
  addBet({ id: 'n1', event: 'A v B', selection: 'Over 2.5', stake: 5000, odds: 2,
           profit: null, outcome: null, status: 'pending',
           placedAt: new Date(TODAY.year, TODAY.month, 6, 12, 0).toISOString() });
  assert.equal(PENDING.length, 1);
  assert.equal(LEDGER.length, 0, 'an unsettled bet is not profit');
  assert.equal(monthTotal(TODAY.year, TODAY.month), 0, 'and must not move the calendar');
});

test('settling a running bet moves it, and every view moves with it', () => {
  load([]);
  addBet({ id: 'n2', event: 'A v B', selection: 'Over 2.5', stake: 10000, odds: 1.9,
           profit: null, outcome: null, status: 'pending',
           placedAt: new Date(TODAY.year, TODAY.month, 8, 12, 0).toISOString() });
  assert.equal(monthTotal(TODAY.year, TODAY.month), 0);

  settleLocal('n2', 'won', 9000);
  assert.equal(PENDING.length, 0);
  assert.equal(LEDGER.length, 1);
  /* The calendar, the month and all time all move together, because they
     are the same records counted three ways. */
  assert.equal(DAY_TOTALS[TODAY.year][TODAY.month][8], 9000);
  assert.equal(monthTotal(TODAY.year, TODAY.month), 9000);
  assert.equal(lifetime().profit, 9000);
});

test('a void settles to zero profit with the stake returned', () => {
  load([]);
  addBet({ id: 'n3', event: 'A v B', selection: 'Over 2.5', stake: 12000, odds: 2.1,
           profit: null, outcome: null, status: 'pending',
           placedAt: new Date(TODAY.year, TODAY.month, 11, 12, 0).toISOString() });
  settleLocal('n3', 'void', 0);
  assert.equal(LEDGER[0].outcome, 'void');
  assert.equal(LEDGER[0].profit, 0, 'void is stake returned, so zero profit');
  assert.equal(monthTotal(TODAY.year, TODAY.month), 0);
});

test('bets from other years are kept apart, not thrown away', () => {
  /* buildDayTotals used to drop every bet outside the current year, so a
     Yearly period could never have shown one and last June's figures were
     simply absent. They are filed under their own year now. */
  load([
    at(3, { profit: 5000 }),
    at(3, { profit: 999999, placedAt: new Date(TODAY.year - 1, 5, 3, 12, 0).toISOString() })
  ]);
  assert.equal(LEDGER.length, 2, 'both are in the ledger');
  assert.equal(yearTotal(TODAY.year), 5000, 'this year is only this year');
  assert.equal(yearTotal(TODAY.year - 1), 999999, 'and last year is still there');
  assert.equal(DAY_TOTALS[TODAY.year - 1][5][3], 999999);
});

test('TODAY is actually today', () => {
  const now = new Date();
  assert.equal(TODAY.year, now.getFullYear());
  assert.equal(TODAY.month, now.getMonth());
  assert.equal(TODAY.day, now.getDate());
  assert.equal(TODAY.dim, new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate());
});
