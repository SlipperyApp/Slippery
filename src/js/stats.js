/* Derived statistics.
 *
 * Every number here comes from the ledger. The previous build synthesised
 * bet counts from a day's profit magnitude (n = 8 + |profit|/40) and
 * hardcoded the bookmaker split as fixed percentages of the period total,
 * so the counts and the splits were decoration. If a figure appears on
 * screen it is counted here, from records.
 */
import {
  LEDGER, PENDING, PL, TODAY,
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
/* A week, as the seven days it actually is.
 *
 * This used to clip both ends to the displayed month, so the week of the
 * 30th was two days long and the bets either side of a month boundary were
 * silently outside every period. The clipped numbers are still returned as
 * `a` and `b` because the calendar paints them inside one month's grid, but
 * `from` and `to` are the real dates and they are what the query uses. */
export function weekRange(year, month, day, weekStart) {
  const start = new Date(year, month, day - dowOffset(new Date(year, month, day), weekStart));
  const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6);
  const dim = new Date(year, month + 1, 0).getDate();
  const raw = day - dowOffset(new Date(year, month, day), weekStart);
  return {
    from: start, to: end,
    a: Math.max(1, raw), b: Math.min(dim, raw + 6)
  };
}
/* Whole days since the epoch, so a range test is one comparison and no
   date arithmetic happens per bet. */
const dnum = (y, m, d) => Math.floor(Date.UTC(y, m, d) / 86400000);
const inWeek = (b, r) => {
  const n = dnum(b.year, b.month, b.day);
  return n >= dnum(r.from.getFullYear(), r.from.getMonth(), r.from.getDate())
      && n <= dnum(r.to.getFullYear(), r.to.getMonth(), r.to.getDate());
};
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
    const yr = (idx[b.year] || (idx[b.year] = {}));
    (yr[b.month] || (yr[b.month] = {}));
    yr[b.month][b.day] = (yr[b.month][b.day] || 0) + b.profit;
  }
  _dayCache = idx;
  return idx;
}
export function dayMap(year, month) { return (dayIndex()[year] || {})[month] || {}; }
export function monthTotal(year, month) {
  const d = dayMap(year, month);
  return Object.keys(d).reduce((a, k) => a + d[k], 0);
}
export function yearTotal(year) {
  let t = 0; for (let m = 0; m < 12; m++) t += monthTotal(year, m); return t;
}

/* Which bets fall inside the current period. */
function scopeBets(S) {
  if (S.period === 'a') return LEDGER.slice();
  if (S.period === 'y') return LEDGER.filter(b => b.year === S.year);
  if (S.period === 'd' && S.focus != null) return betsOn(S.year, S.month, S.focus);
  if (S.period === 'w' && S.focus != null) {
    const r = weekRange(S.year, S.month, S.focus, S.weekStart);
    return LEDGER.filter(b => inWeek(b, r));
  }
  return LEDGER.filter(b => b.year === S.year && b.month === S.month);
}

/* ---------------- imported figures ----------------
 *
 * Imported history is a dated profit or loss with nothing behind it: no
 * fixture, no selection, no odds. That is deliberate and it is the whole
 * simplification. Trying to reconstruct individual games from somebody's
 * old spreadsheet produced bets that could not be settled, could not be
 * checked against a slip, and polluted every per-market breakdown with
 * rows nobody could verify.
 *
 * These figures were being written and shown on the calendar and then
 * left out of every total, which is why importing a year of history moved
 * the profit and loss figure by exactly zero. They are counted here now,
 * in whatever period is on screen, with two rules:
 *
 *   · A row only counts in a period at least as wide as itself. A month's
 *     total does not belong in a single day, and counting it there would
 *     show a Tuesday that made a month's profit.
 *   · Turnover and bet counts come along, so return on turnover stays
 *     honest rather than dividing a bigger profit by the same stake.
 */
const WIDTH = { day: 0, week: 1, month: 2, year: 3 };

/* The span a row covers, as inclusive day numbers, so overlaps can be
   compared without date arithmetic at every call site. */
const DAYNUM = iso => Math.floor(Date.parse(iso + 'T00:00:00Z') / 86400000);
function span(p) {
  const t = Date.parse(p.date + 'T00:00:00Z');
  if (!Number.isFinite(t)) return null;
  const d = new Date(t);
  if (p.period === 'day') return [DAYNUM(p.date), DAYNUM(p.date)];
  if (p.period === 'week') return [DAYNUM(p.date), DAYNUM(p.date) + 6];
  if (p.period === 'month') {
    const a = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1);
    const b = Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0);
    return [Math.floor(a / 86400000), Math.floor(b / 86400000)];
  }
  const a = Date.UTC(d.getUTCFullYear(), 0, 1);
  const b = Date.UTC(d.getUTCFullYear(), 11, 31);
  return [Math.floor(a / 86400000), Math.floor(b / 86400000)];
}

/* THE OVERLAP RULE.
 *
 * Somebody can hold a figure for March and figures for four days in March.
 * Both are things they told us, and adding them together counts March
 * twice. A coarser row is therefore dropped whenever a finer row falls
 * inside it: the more detailed record wins, because it is the one that can
 * be checked against a calendar.
 *
 * Computed once per call rather than per period, because it is the same
 * answer whatever is on screen. */
export function usablePl() {
  const rows = PL.map(p => ({ p, s: span(p), w: WIDTH[p.period] }))
    .filter(x => x.s && x.w != null)
    .sort((a, b) => a.w - b.w);
  const kept = [];
  for (const x of rows) {
    const covered = kept.some(k => k.w < x.w && k.s[0] >= x.s[0] && k.s[1] <= x.s[1]);
    if (!covered) kept.push(x);
  }
  return kept.map(x => x.p);
}

export function plInScope(S) {
  /* 4 is all time, 3 is one year. They were the same number before, which
     is how "all time" and "this year" came to be the same query. */
  const scope = S.period === 'a' ? 4
    : S.period === 'y' ? 3
    : S.period === 'd' && S.focus != null ? 0
    : S.period === 'w' && S.focus != null ? 1
    : 2;
  const out = [];
  for (const p of usablePl()) {
    const w = WIDTH[p.period];
    if (w == null || w > scope) continue;
    if (scope === 4) { out.push(p); continue; }

    const d = new Date(p.date + 'T12:00:00');
    if (Number.isNaN(d.getTime())) continue;
    if (d.getFullYear() !== S.year) continue;
    if (scope === 3) { out.push(p); continue; }

    /* A week can start in the month before the one on screen, so the week
       branch is checked against real dates rather than against S.month. */
    if (scope === 1) {
      const r = weekRange(S.year, S.month, S.focus, S.weekStart);
      if (inWeek({ year: d.getFullYear(), month: d.getMonth(), day: d.getDate() }, r)) out.push(p);
      continue;
    }
    if (d.getMonth() !== S.month) continue;
    if (scope === 2) { out.push(p); continue; }
    if (d.getDate() === S.focus) out.push(p);
  }
  return out;
}

function label(S, MS) {
  if (S.period === 'a') return 'all time';
  if (S.period === 'y') return S.year === TODAY.year ? 'this year' : String(S.year);
  if (S.period === 'd' && S.focus != null) {
    return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' })
      .format(new Date(S.year, S.month, S.focus));
  }
  if (S.period === 'w' && S.focus != null) {
    const r = weekRange(S.year, S.month, S.focus, S.weekStart);
    return 'week to ' + new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' })
      .format(r.to);
  }
  return S.year === TODAY.year && S.month === TODAY.month ? 'this month'
    : MS.format(new Date(S.year, S.month, 1)) + ' ' + S.year;
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

  /* Imported figures, in whatever period is on screen. They carry no
     outcome, so they move profit and turnover and never touch the win
     rate: a figure with no bets behind it cannot be a win or a loss, and
     counting it as either would corrupt the one number people check. */
  const pl = plInScope(S);
  let importedProfit = 0, importedTurnover = 0, importedBets = 0;
  for (const p of pl) {
    importedProfit += p.profit || 0;
    importedTurnover += p.turnover || 0;
    importedBets += p.bets || 0;
  }
  profit += importedProfit;
  turnover += importedTurnover;

  const count = bets.length + importedBets;
  const settled = won + lost + cash;
  const graded = won + lost;

  /* Day-level series for streaks, best and worst. Void-only days count as
     days with bets but no movement, which is what the calendar shows. */
  const days = new Map();
  for (const b of bets) {
    const k = b.year + ':' + b.month + ':' + b.day;
    days.set(k, (days.get(k) || 0) + b.profit);
  }
  const dayVals = [...days.values()];
  const best = dayVals.length ? Math.max(...dayVals) : 0;
  const worst = dayVals.length ? Math.min(...dayVals) : 0;

  const ordered = [...days.entries()]
    .sort((a, b) => {
      const [ay, am, ad] = a[0].split(':').map(Number), [by, bm, bd] = b[0].split(':').map(Number);
      return ay - by || am - bm || ad - bd;
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
    includesImported: importedBets > 0 || importedProfit !== 0,
    ledgerBets: bets.length
  };
}

/* How many bets to claim.
 *
 * Two honest answers to one question, and they differ by whatever was
 * imported as an aggregate. The tracker count is what Slippery has seen:
 * it starts at 0 on a new account and every number in it has a slip
 * behind it. The lifetime count adds the history brought across, which is
 * the true total and is also a figure this tracker cannot show the
 * workings for.
 *
 * Period figures (typed P/L, imported P/L rows) are in NEITHER. They have
 * no bets behind them at all, so counting them would be inventing bets. */
export function importedTotals() {
  let profit = 0, turnover = 0, bets = 0;
  for (const p of usablePl()) {
    profit += p.profit || 0;
    turnover += p.turnover || 0;
    bets += p.bets || 0;
  }
  return { profit, turnover, bets };
}

/* The count for whatever is on screen. There used to be a Tracker/Lifetime
   toggle here that changed this integer and nothing else, so the headline
   figure beside it still described a different set of bets. The period
   picker changes the query instead, and this just reports it. */
export function betCount(S, scoped) {
  return scoped == null ? LEDGER.length + PENDING.length : scoped;
}

/** Lifetime figures, always the same numbers wherever they appear.
    Derived, never stored: ledger + imports, computed the one way. */
export function lifetime() {
  const imp = importedTotals();
  let profit = imp.profit, turnover = imp.turnover, oddsSum = 0, oddsN = 0;
  for (const b of LEDGER) {
    profit += b.profit;
    turnover += b.stake;
    if (b.odds > 1) { oddsSum += b.odds; oddsN++; }
  }
  return {
    profit, turnover,
    /* This one is always the true lifetime total; the toggle decides what
       gets DISPLAYED, and callers pick. */
    bets: LEDGER.length + imp.bets,
    trackerBets: LEDGER.length,
    roi: turnover ? profit / turnover * 100 : 0,
    avgOdds: oddsN ? oddsSum / oddsN : 0
  };
}

/* yearProfit() lived here as a second, subtly different way of summing a
   year, with no callers left once the period picker gained a real Yearly
   branch. yearTotal above is the one sum. */

/* ---------------- the two ledgers, side by side ----------------
 *
 * There are two kinds of record in here and they are not the same kind of
 * fact. A bet was logged through Slippery and has a slip behind it: a
 * selection, a price, a stake, a result that can be checked. An imported
 * figure is a dated profit or loss and nothing else, brought across from
 * wherever somebody kept their record before.
 *
 * Both are true and both belong in the totals for the period they fall in.
 * Only one of them can be checked, so they are counted apart and shown
 * apart, and the reconciliation below is what makes the headline figure
 * add up in public rather than in a comment.
 *
 * What imported history NEVER touches, because there are no bets behind it:
 * the win rate, the streak, the best and worst day, the capture rate, and
 * the trial slip count. A figure with no result cannot be a win, and a day
 * that is one number cannot be a run of good days.
 */
export function reconcile(S) {
  let logged = 0, loggedBets = 0, loggedTurnover = 0;
  for (const b of scopeBets(S)) {
    logged += b.profit;
    loggedTurnover += b.stake;
    loggedBets++;
  }
  const rows = plInScope(S);
  let imported = 0, importedBets = 0, importedTurnover = 0;
  for (const p of rows) {
    imported += p.profit || 0;
    importedBets += p.bets || 0;
    importedTurnover += p.turnover || 0;
  }
  return {
    logged, loggedBets, loggedTurnover,
    imported, importedBets, importedTurnover, importedRows: rows,
    total: logged + imported,
    turnover: loggedTurnover + importedTurnover
  };
}
