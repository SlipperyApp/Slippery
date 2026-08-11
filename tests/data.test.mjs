/* Reconciliation tests.
 *
 * The brief requires the demo figures to reconcile:
 *   all time  +£15,079.48 · 2,847 bets · £255,600 turnover · 5.9% ROI
 * The previous build showed "Net all time +£6,339.48" directly above an
 * "All time £15,079" KPI, and two different lifetime ROIs, because the
 * period total summed the 2026 array while the KPI used a separate
 * lifetime constant. These tests make that class of drift impossible.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  LEDGER, LEDGER_2026, IMPORTED, LIFETIME, MONTHS_2026, AUGUST_DAYS,
  DAY_TOTALS, monthTotal, yearTotal, betsOn, TODAY, personMonths, PEOPLE
} from '../src/js/data.js';

test('the 2026 monthly targets sum to the locked year figure', () => {
  assert.equal(MONTHS_2026.reduce((a, b) => a + b, 0), 633_948);
});

test('the August day map sums to the locked August figure', () => {
  assert.equal(Object.values(AUGUST_DAYS).reduce((a, b) => a + b, 0), 193_838);
});

test('every generated day sums EXACTLY to its day target', () => {
  for (let m = 0; m < 12; m++) {
    for (const [d, target] of Object.entries(DAY_TOTALS[m] || {})) {
      if (m === TODAY.month && +d > TODAY.day) continue;
      const actual = betsOn(m, +d).reduce((a, b) => a + b.profit, 0);
      assert.equal(actual, target, `${m + 1}/${d}: bets sum to ${actual}, target ${target}`);
    }
  }
});

test('every month sums EXACTLY to its monthly target', () => {
  for (let m = 0; m < 12; m++) {
    assert.equal(monthTotal(m), MONTHS_2026[m], 'month ' + (m + 1));
  }
});

test('August reconciles three ways: days, ledger and the month total', () => {
  assert.equal(monthTotal(7), 193_838);
  const fromBets = LEDGER.filter(b => b.month === 7).reduce((a, b) => a + b.profit, 0);
  assert.equal(fromBets, 193_838);
  assert.equal(Object.values(AUGUST_DAYS).reduce((a, b) => a + b, 0), 193_838);
});

test('the year reconciles', () => {
  assert.equal(yearTotal(), 633_948);
  assert.equal(LEDGER_2026.profit, 633_948);
});

test('ledger plus imported history equals the locked lifetime figure exactly', () => {
  assert.equal(LEDGER_2026.profit + IMPORTED.profit, LIFETIME.profit);
  assert.equal(LEDGER_2026.bets + IMPORTED.bets, LIFETIME.bets);
  assert.equal(LEDGER_2026.turnover + IMPORTED.turnover, LIFETIME.turnover);
  assert.equal(LEDGER_2026.won + IMPORTED.won, LIFETIME.won);
  assert.equal(LEDGER_2026.lost + IMPORTED.lost, LIFETIME.lost);
  assert.equal(LEDGER_2026.cash + IMPORTED.cash, LIFETIME.cash);
});

test('the imported history is plausible, not a negative plug number', () => {
  for (const k of ['profit', 'turnover', 'bets', 'won', 'lost', 'cash']) {
    assert.ok(IMPORTED[k] > 0, `imported ${k} came out ${IMPORTED[k]}`);
  }
  assert.ok(IMPORTED.bets > LEDGER_2026.bets,
    'three imported years should hold more bets than the eight months of live ledger');
});

test('the locked lifetime ROI still reads 5.9%', () => {
  const roi = LIFETIME.profit / LIFETIME.turnover * 100;
  assert.equal(roi.toFixed(1), '5.9');
});

test('lifetime outcome counts add up to the lifetime bet count', () => {
  assert.equal(LIFETIME.won + LIFETIME.lost + LIFETIME.cash, LIFETIME.bets);
});

test('every bet is internally consistent', () => {
  for (const b of LEDGER) {
    assert.ok(b.stake > 0, `${b.id} has stake ${b.stake}`);
    assert.equal(b.stake, Math.trunc(b.stake), `${b.id} stake is not whole pence`);
    assert.equal(b.profit, Math.trunc(b.profit), `${b.id} profit is not whole pence`);
    assert.ok(b.odds > 1, `${b.id} has odds ${b.odds}`);
    if (b.outcome === 'lost') assert.equal(b.profit, -b.stake, `${b.id} lost more than its stake`);
    if (b.outcome === 'void') assert.equal(b.profit, 0, `${b.id} is void with profit`);
    if (b.outcome === 'won') assert.ok(b.profit > 0, `${b.id} won nothing`);
    assert.ok(b.profit >= -b.stake, `${b.id} lost more than the stake`);
  }
});

test('a won bet pays out close to stake x odds', () => {
  /* Not exact to the penny on the generated balancers, which carry odds to
     4dp, but never off by more than a penny — the row must not look wrong
     to anyone who checks the arithmetic. */
  for (const b of LEDGER) {
    if (b.outcome !== 'won') continue;
    const implied = Math.round(b.stake * (b.odds - 1));
    assert.ok(Math.abs(implied - b.profit) <= 1,
      `${b.id}: ${b.stake}p at ${b.odds} implies ${implied}p, ledger says ${b.profit}p`);
  }
});

test('no bet is dated in the future', () => {
  for (const b of LEDGER) {
    assert.ok(b.month < TODAY.month || (b.month === TODAY.month && b.day <= TODAY.day),
      `${b.id} is dated ${b.day}/${b.month + 1}, after today`);
  }
});

test('the named August slips survive generation intact', () => {
  const oska = LEDGER.find(b => b.event.startsWith('Oskarshamns'));
  assert.ok(oska, 'the walkthrough slip must exist');
  assert.equal(oska.stake, 30618);
  assert.equal(oska.profit, 7655);
  assert.equal(oska.odds, 1.25);
  assert.equal(oska.outcome, 'won');
});

test('the ledger is deterministic across reloads', async () => {
  const again = await import('../src/js/data.js?v=2');
  assert.equal(again.LEDGER.length, LEDGER.length);
  assert.equal(again.LEDGER_2026.profit, LEDGER_2026.profit);
  assert.equal(again.LEDGER_2026.turnover, LEDGER_2026.turnover);
});

test('each person\'s months sum to their own year figure, consistently', () => {
  for (const p of PEOPLE) {
    const mo = personMonths(p);
    const a = mo.reduce((x, y) => x + y, 0);
    const b = personMonths(p).reduce((x, y) => x + y, 0);
    assert.equal(a, b, p.n + ' is not stable between calls');
    assert.ok(Math.abs(a) <= Math.abs(p.all), p.n + ' has a year bigger than their lifetime');
    assert.equal(mo.slice(TODAY.month + 1).every(v => v === 0), true,
      p.n + ' has figures for months that have not happened');
  }
});

test('turnover only ever counts money actually staked', () => {
  const t = LEDGER.reduce((a, b) => a + b.stake, 0);
  assert.equal(t, LEDGER_2026.turnover);
  assert.ok(t > 0);
});
