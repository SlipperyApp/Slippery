/* Derived statistics.
 *
 * Every number here comes from the ledger. The previous build synthesised
 * bet counts from a day's profit magnitude (n = 8 + |profit|/40) and
 * hardcoded the bookmaker split as fixed percentages of the period total,
 * so the counts and the splits were decoration. If a figure appears on
 * screen it is counted here, from records.
 */
import {
  LEDGER, DAY_TOTALS, IMPORTED, TODAY, monthTotal as monthTotalOf,
  TARGETS, outcomeGroup, betsOn
} from './data.js';
import { S } from './state.js';

export const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function dowOffset(dt, weekStart) { return (dt.getDay() - weekStart + 7) % 7; }
export function dowLabels(weekStart) {
  const o = [];
  for (let i = 0; i < 7; i++) o.push(DOW[(i + weekStart) % 7]);
  return o;
}
export function weekRange(month, day, weekStart) {
  const off = dowOffset(new Date(TODAY.year, month, day), weekStart);
  const dim = new Date(TODAY.year, month + 1, 0).getDate();
  return { a: Math.max(1, day - off), b: Math.min(dim, day - off + 6) };
}
/* The target for a month: the one set for it, else the standing target the
   user chose at setup. Falls back to S.target rather than a hardcoded
   £2,500, which was a figure nobody had asked for appearing on a brand new
   account as though it were theirs. */
export function targetFor(month) {
  return TARGETS[month] !== undefined ? TARGETS[month] : S.target;
}
/* Day totals are COUNTED from the ledger, never held as a separate map.
   The old build kept an AUG{} object alongside the bet list and wrote
   settled bets into only one of them, so settling a bet made the month
   calendar and the year calendar disagree permanently. Deriving means
   that cannot happen: add a bet and every view moves together. */
let _dayCache = null;
export function invalidateDays() { _dayCache = null; }
function dayIndex() {
  if (_dayCache) return _dayCache;
  const idx = {};
  for (const b of LEDGER) {
    (idx[b.month] || (idx[b.month] = {}));
    idx[b.month][b.day] = (idx[b.month][b.day] || 0) + b.profit;
  }
  _dayCache = idx;
  return idx;
}
export function dayMap(month) { return dayIndex()[month] || {}; }
export function monthTotal(month) {
  const d = dayMap(month);
  return Object.keys(d).reduce((a, k) => a + d[k], 0);
}

/* Which bets fall inside the current period. All time is the only period
   that reaches past the ledger into imported history, and it says so. */
function scopeBets(S) {
  if (S.period === 'a') return LEDGER.slice();
  if (S.period === 'd' && S.focus != null) return betsOn(S.month, S.focus);
  if (S.period === 'w' && S.focus != null) {
    const r = weekRange(S.month, S.focus, S.weekStart);
    return LEDGER.filter(b => b.month === S.month && b.day >= r.a && b.day <= r.b);
  }
  return LEDGER.filter(b => b.month === S.month);
}

function label(S, MS) {
  if (S.period === 'a') return 'all time';
  if (S.period === 'd' && S.focus != null) {
    return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' })
      .format(new Date(TODAY.year, S.month, S.focus));
  }
  if (S.period === 'w' && S.focus != null) {
    const r = weekRange(S.month, S.focus, S.weekStart);
    return 'week to ' + new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' })
      .format(new Date(TODAY.year, S.month, r.b));
  }
  return S.month === TODAY.month ? 'this month'
    : MS.format(new Date(TODAY.year, S.month, 1)) + ' ' + TODAY.year;
}

function splitBy(bets, key) {
  const m = new Map();
  for (const b of bets) {
    const k = b[key] || 'Unspecified';
    m.set(k, (m.get(k) || 0) + b.profit);
  }
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}

/**
 * Everything the dashboard needs for the selected period, counted from
 * records. `includesImported` tells the UI to say so, because a lifetime
 * figure that quietly folds in aggregates the ledger cannot show would be
 * the same lie the old build told.
 */
export function stats(S, MS) {
  const bets = scopeBets(S);
  const all = S.period === 'a';

  let profit = 0, turnover = 0, won = 0, lost = 0, cash = 0, voided = 0, oddsSum = 0, oddsN = 0;
  for (const b of bets) {
    profit += b.profit;
    turnover += b.stake;
    const g = outcomeGroup(b.outcome);
    if (g === 'won') won++;
    else if (g === 'lost') lost++;
    else if (g === 'cash') cash++;
    else voided++;
    if (b.odds > 1) { oddsSum += b.odds; oddsN++; }
  }

  if (all) {
    profit += IMPORTED.profit;
    turnover += IMPORTED.turnover;
    won += IMPORTED.won;
    lost += IMPORTED.lost;
    cash += IMPORTED.cash;
  }

  /* All time is the ledger plus whatever the user imported. There is no
     separate lifetime constant to disagree with it. */
  const count = all ? bets.length + IMPORTED.bets : bets.length;
  const settled = won + lost + cash;
  const graded = won + lost;

  /* Day-level series for streaks, best and worst. Void-only days count as
     days with bets but no movement, which is what the calendar shows. */
  const days = new Map();
  for (const b of bets) {
    const k = b.month + ':' + b.day;
    days.set(k, (days.get(k) || 0) + b.profit);
  }
  const dayVals = [...days.values()];
  const best = dayVals.length ? Math.max(...dayVals) : 0;
  const worst = dayVals.length ? Math.min(...dayVals) : 0;

  const ordered = [...days.entries()]
    .sort((a, b) => {
      const [am, ad] = a[0].split(':').map(Number), [bm, bd] = b[0].split(':').map(Number);
      return am - bm || ad - bd;
    })
    .map(e => e[1]);
  let streak = 0, run = 0;
  for (const v of ordered) { if (v > 0) { run++; streak = Math.max(streak, run); } else run = 0; }

  return {
    label: label(S, MS),
    bets: count,
    profit, turnover,
    roi: turnover ? profit / turnover * 100 : 0,
    won, lost, cash, voided, settled,
    winRate: graded ? Math.round(won / graded * 100) : 0,
    avgOdds: oddsN ? oddsSum / oddsN : 0,
    best, worst, streak,
    activeDays: days.size,
    byBook: splitBy(bets, 'book'),
    byMarket: splitBy(bets, 'market'),
    byTipster: splitBy(bets.filter(b => b.tipster), 'tipster'),
    includesImported: all,
    ledgerBets: bets.length
  };
}

/** Lifetime figures, always the same numbers wherever they appear.
    Derived, never stored: ledger + imports, computed the one way. */
export function lifetime() {
  let profit = IMPORTED.profit, turnover = IMPORTED.turnover, oddsSum = 0, oddsN = 0;
  for (const b of LEDGER) {
    profit += b.profit;
    turnover += b.stake;
    if (b.odds > 1) { oddsSum += b.odds; oddsN++; }
  }
  return {
    profit, turnover,
    bets: LEDGER.length + IMPORTED.bets,
    roi: turnover ? profit / turnover * 100 : 0,
    avgOdds: oddsN ? oddsSum / oddsN : 0
  };
}

export function yearProfit() {
  let t = 0;
  for (let m = 0; m < 12; m++) t += monthTotalOf(m);
  return t;
}
