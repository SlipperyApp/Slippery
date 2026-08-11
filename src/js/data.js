/* The demo dataset.
 *
 * THE RULE HERE: every figure the app shows is computed from these records.
 * Nothing is hardcoded downstream. The previous build fabricated bet counts
 * from a day's profit magnitude and hardcoded the bookmaker split as fixed
 * percentages, so "141 bets" and "Paddy Power 55%" were decoration rather
 * than data — and "all time" showed the 2026 total next to a lifetime KPI
 * that disagreed with it.
 *
 * Reconciliation targets, locked by the brief:
 *   all time  +£15,079.48 · 2,847 bets · £255,600 turnover · 5.9% ROI
 *   2026       +£6,339.48
 *   August     +£1,938.38
 *
 * How it holds together: 2026 is a real ledger of individual slips,
 * generated deterministically so every day, month and year sums exactly.
 * 2023-2025 predate the account and exist as imported aggregates, which is
 * the product's own "this day came from an imported total" concept. All
 * time = ledger + imports, so the headline and the KPI are the same number
 * by construction rather than by coincidence.
 */

const YEAR_NOW = 2026;

/* Locked headline figures, in pence where money. */
export const LIFETIME = {
  profit: 1_507_948,
  bets: 2847,
  turnover: 25_560_000,
  won: 1537,
  lost: 1082,
  cash: 228
};

/* 2026 by month, in pence. Sums to 633,948. */
export const MONTHS_2026 = [
  82_040, -24_010, 113_000, 46_025, -18_050, 99_075, 142_030, 193_838, 0, 0, 0, 0
];

/* August day by day, in pence. Sums to 193,838. */
export const AUGUST_DAYS = {
  1: 74_250, 2: 29_200, 3: 17_500, 5: 17_918, 6: 49_070, 7: 16_500, 8: -10_600
};

export const TODAY = { year: YEAR_NOW, month: 7, day: 9, dim: 31, doy: 221 };

export const TARGETS = { 0: 200_000, 1: 200_000, 2: 200_000, 3: 220_000, 4: 220_000,
  5: 250_000, 6: 250_000, 7: 250_000, 8: 250_000, 9: 250_000, 10: 250_000, 11: 250_000 };

export const BOOKS = {
  Flutter: ['Paddy Power', 'Betfair', 'Sky Bet'],
  Kambi: ['Unibet', 'LeoVegas', '32Red'],
  Other: ['bet365', 'William Hill', 'Betfred', 'Ladbrokes', 'Coral', 'Smarkets']
};
export const ALL_BOOKS = Object.values(BOOKS).flat();
export const TIPSTERS = ['Self', 'HB', 'Zhang', 'James'];

export const THEMES = [
  ['periwinkle', 'Periwinkle', '#5D76CB', '#38BDF8'],
  ['graphite',   'Graphite',   '#64748B', '#9FB0C6'],
  ['ink',        'Ink',        '#5F5D74', '#9A92BC'],
  ['tide',       'Tide',       '#3E93B5', '#8FD4EC'],
  ['chalk',      'Chalk',      '#9A9080', '#E8DFCB']
];
export const THEME_BG = { periwinkle: '#0F172A', graphite: '#12161D', ink: '#09090C',
  tide: '#0A1A22', chalk: '#1B1813' };

export const OUTCOME_LABEL = {
  'won': 'Won', 'lost': 'Lost', 'void': 'Void',
  'cash-profit': 'Cashed out', 'cash-loss': 'Cashed out', 'cash-flat': 'Cashed out'
};
/* Emoji are decorative only; every row also carries a text outcome for
   screen readers, because an emoji alone is not a label. */
export const OUTCOME_ICON = {
  'won': '✅', 'lost': '❌', 'void': '↩',
  'cash-profit': '💰', 'cash-loss': '💰', 'cash-flat': '💰'
};
export function outcomeGroup(o) { return o.startsWith('cash') ? 'cash' : o; }

/* ---------- deterministic PRNG ----------
   mulberry32. Same seed, same ledger, on every device and every reload,
   so screenshots and tests are stable. */
function rng(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pick = (r, arr) => arr[Math.floor(r() * arr.length) % arr.length];

/* ---------- the fixed August slips ----------
   These appear in the walkthrough, the Telegram preview and the day sheet,
   so they are written out rather than generated. Each one is internally
   consistent: stake x (odds - 1) equals the profit to the penny. */
const AUG_SLIPS = [
  ['Oskarshamns AIK v IFK Karlshamn', 'Under 5.5 Goals', 1.25, 30618, 7655, 'won', 'Paddy Power', 8, '16:48', 'HB', 1],
  ['Köln and Augsburg double', 'Under 3.5 and Under 5.5', 1.40, 6630, 2652, 'won', 'Paddy Power', 8, '21:12', '', 0],
  ['Treble, cashed out', '3 legs', 4.10, 12000, 4820, 'cash-profit', 'bet365', 8, '19:35', '', 1],
  ['Bet builder, cashed out', '3 legs', 2.25, 12500, -3227, 'cash-loss', 'Sky Bet', 8, '18:02', '', 0],
  ['SK Brann (W) v PAOK (W)', 'Under 4.5 Goals', 1.17, 22500, -22500, 'lost', 'Paddy Power', 8, '20:44', 'Zhang', 0],

  ['Sevenfold bet builder', '7 legs', 1.4979, 10000, 4979, 'won', 'Betfair', 7, '22:05', 'Zhang', 1],
  ['Legia Warsaw v Rakow', 'Legia Warsaw', 2.30, 8862, 11521, 'won', 'bet365', 7, '19:50', '', 0],

  ['Brommapojkarna v Sirius', 'Over 2.5 Goals', 1.95, 30600, 29070, 'won', 'Betfair', 6, '20:18', 'HB', 1],
  ['Molde v Bodø/Glimt', 'BTTS Yes', 1.80, 25000, 20000, 'won', 'Paddy Power', 6, '18:40', '', 0],

  ['Vaasa v Honka', 'Under 3.5 Goals', 1.55, 32578, 17918, 'won', 'Paddy Power', 5, '17:22', '', 1],
  ['Ranheim v Skeid, abandoned', 'Over 1.5 Goals', 1.50, 14000, 0, 'void', 'Betfair', 5, '16:35', '', 0],

  ['Sarpsborg v Odd', 'Over 2.5 Goals', 1.85, 30000, 25500, 'won', 'Betfair', 3, '17:05', 'HB', 1],
  ['Djurgården v Hammarby', 'Over 1.5 Goals', 1.30, 20000, 6000, 'won', 'bet365', 3, '16:05', 'James', 1],
  ['Rosenborg v Viking', 'BTTS No', 2.05, 14000, -14000, 'lost', 'Sky Bet', 3, '19:14', '', 0],

  ['Fivefold acca', '5 legs', 6.20, 6000, 31200, 'won', 'Betfair', 2, '21:40', 'Zhang', 1],
  ['Sandefjord v Tromsø', 'Under 3.5 Goals', 1.50, 20000, 10000, 'won', 'Paddy Power', 2, '20:15', '', 0],
  ['Sarpsborg v Lillestrøm', 'Lillestrøm', 2.60, 12000, -12000, 'lost', 'Paddy Power', 2, '18:55', '', 0],
  ['Aalesund v Sogndal, postponed', 'Over 2.5 Goals', 1.70, 16000, 0, 'void', 'bet365', 2, '14:10', '', 1],

  ['Treble, Nordic overs', '3 legs', 3.50, 13652, 34130, 'won', 'Betfair', 1, '22:10', 'HB', 1],
  ['Haugesund v Tromsø', 'Over 2.5 Goals', 1.72, 18000, 12960, 'won', 'bet365', 1, '17:30', 'HB', 1],
  ['Vålerenga v Odd', 'Under 3.5 Goals', 1.45, 26000, 11700, 'won', 'Paddy Power', 1, '16:12', '', 1],
  ['Strømsgodset v Bodø/Glimt', 'BTTS Yes', 1.66, 15000, 9900, 'won', 'Sky Bet', 1, '19:28', 'James', 0],
  ['Kristiansund v Sandefjord', 'Over 1.5 Goals', 1.28, 30000, 8400, 'won', 'Paddy Power', 1, '15:44', '', 0],
  ['Double, cashed out', '2 legs', 2.90, 10000, 0, 'cash-flat', 'Betfair', 1, '20:02', '', 0],
  ['Treble, cashed out', '3 legs', 3.40, 9000, -2840, 'cash-loss', 'bet365', 1, '21:55', '', 1]
];

const HOME = ['Molde', 'Rosenborg', 'Viking', 'Brann', 'Lillestrøm', 'Sarpsborg', 'Odd',
  'Vålerenga', 'Bodø/Glimt', 'Tromsø', 'Djurgården', 'Hammarby', 'AIK', 'Malmö FF',
  'Elfsborg', 'Häcken', 'Sirius', 'Norrköping', 'HJK', 'KuPS', 'Inter Turku', 'Ilves',
  'Legia Warsaw', 'Raków', 'Lech Poznań', 'Slavia Prague', 'Sparta Prague', 'Ferencváros'];
const MARKETS = [
  ['Over 1.5 Goals', 'Over/Under'], ['Over 2.5 Goals', 'Over/Under'],
  ['Under 3.5 Goals', 'Over/Under'], ['Under 4.5 Goals', 'Over/Under'],
  ['BTTS Yes', 'Both to score'], ['BTTS No', 'Both to score'],
  ['Match result', 'Match result'], ['Double chance 1X', 'Match result'],
  ['Draw no bet', 'Match result'], ['Over 1.5 Goals', 'Over/Under']
];
const MULTIS = [['Double', '2 legs'], ['Treble', '3 legs'], ['Fourfold acca', '4 legs'],
  ['Bet builder', '3 legs'], ['Fivefold acca', '5 legs']];
const NICE_ODDS = [1.20, 1.25, 1.30, 1.40, 1.50, 1.55, 1.60, 1.65, 1.70, 1.75, 1.80,
  1.85, 1.90, 2.00, 2.10, 2.20, 2.30, 2.50, 2.75, 3.00, 3.50, 4.00];

let _uid = 0;
function makeBet(f) {
  return {
    id: 'b' + (++_uid),
    event: f.event, selection: f.selection, market: f.market,
    odds: f.odds, stake: f.stake, profit: f.profit, outcome: f.outcome,
    book: f.book, tipster: f.tipster || '', viaTelegram: !!f.tg,
    year: f.year, month: f.month, day: f.day, time: f.time
  };
}

/* Realistic stake ladder. Stakes are chosen independently of the day's
   result, which is the whole point: turnover has to be a believable
   multiple of profit or the ROI comes out at a number no bettor has ever
   achieved. Tying stake size to the day's profit produced a 29% ROI. */
const STAKES = [2500, 5000, 5000, 7500, 10000, 10000, 12500, 15000, 15000,
  20000, 20000, 25000, 30000, 30000, 40000, 50000];

/* Build a day's slips whose profits sum EXACTLY to the day target.
   Outcomes are steered toward the target as the day progresses, the way a
   real day drifts, and a single winner then absorbs whatever is left by
   adjusting its odds. Nothing is rounded away: the day is exact. */
function buildDay(r, year, month, day, targetPence) {
  const out = [];
  const n = 4 + Math.floor(r() * 6);
  let running = 0;

  for (let i = 0; i < n; i++) {
    const isMulti = r() < 0.16;
    const [ev, sel, mk] = isMulti
      ? (() => { const m = pick(r, MULTIS); return [m[0], m[1], 'Multiple']; })()
      : (() => {
          const h = pick(r, HOME);
          let a = pick(r, HOME); if (a === h) a = HOME[(HOME.indexOf(h) + 3) % HOME.length];
          const m = pick(r, MARKETS);
          return [h + ' v ' + a, m[0], m[1]];
        })();
    const o = isMulti ? +(2 + r() * 5).toFixed(2) : pick(r, NICE_ODDS);
    const stake = pick(r, STAKES);
    const roll = r();
    let profit, outcome;
    if (roll < 0.04) { profit = 0; outcome = 'void'; }
    else if (roll < 0.10) {
      const d = Math.round(stake * (r() * 0.6 - 0.3) / 100) * 100;
      profit = d; outcome = d > 0 ? 'cash-profit' : d < 0 ? 'cash-loss' : 'cash-flat';
    } else {
      /* Lean toward a win while the day is still short of target, toward a
         loss once it is ahead. Never certain either way, so the sequence
         still reads like chance rather than a ramp. */
      const behind = running < targetPence;
      const win = r() < (behind ? 0.70 : 0.28);
      if (win) { profit = Math.round(stake * (o - 1)); outcome = 'won'; }
      else { profit = -stake; outcome = 'lost'; }
    }
    running += profit;
    out.push(makeBet({ event: ev, selection: sel, market: mk, odds: o, stake,
      profit, outcome, book: pick(r, ALL_BOOKS),
      tipster: r() < 0.4 ? pick(r, TIPSTERS.slice(1)) : '',
      tg: r() < 0.72, year, month, day,
      time: String(13 + Math.floor(r() * 9)).padStart(2, '0') + ':' +
            String(Math.floor(r() * 60)).padStart(2, '0') }));
  }

  /* Land the day exactly. Preference order: nudge an existing winner's
     odds, which leaves the bet count and turnover untouched; otherwise add
     one more slip sized to the residual. */
  let residual = targetPence - running;
  if (residual !== 0) {
    const winners = out.filter(b => b.outcome === 'won');
    const target = winners.find(b => {
      const p = b.profit + residual;
      const impliedOdds = 1 + p / b.stake;
      return p > 0 && impliedOdds >= 1.05 && impliedOdds <= 15;
    });
    if (target) {
      target.profit += residual;
      target.odds = +(1 + target.profit / target.stake).toFixed(6);
      residual = 0;
    }
  }
  if (residual !== 0) {
    const h = pick(r, HOME);
    let a2 = pick(r, HOME); if (a2 === h) a2 = HOME[(HOME.indexOf(h) + 5) % HOME.length];
    const mk = pick(r, MARKETS);
    let bal;
    if (residual > 0) {
      const o = pick(r, NICE_ODDS.filter(x => x >= 1.4 && x <= 3));
      const stake = Math.max(500, Math.round(residual / (o - 1)));
      bal = { odds: +(1 + residual / stake).toFixed(6), stake, profit: residual, outcome: 'won' };
    } else {
      bal = { odds: pick(r, NICE_ODDS), stake: -residual, profit: residual, outcome: 'lost' };
    }
    out.push(makeBet({ event: h + ' v ' + a2, selection: mk[0], market: mk[1],
      odds: bal.odds, stake: bal.stake, profit: bal.profit, outcome: bal.outcome,
      book: pick(r, ALL_BOOKS), tipster: r() < 0.4 ? pick(r, TIPSTERS.slice(1)) : '',
      tg: r() < 0.72, year, month, day,
      time: String(15 + Math.floor(r() * 7)).padStart(2, '0') + ':' +
            String(Math.floor(r() * 60)).padStart(2, '0') }));
  }
  return out;
}

/* Spread a month total across active days, exactly. */
function daysForMonth(r, month, totalPence) {
  if (month === 7) return { ...AUGUST_DAYS };
  if (!totalPence) return {};
  const dim = new Date(YEAR_NOW, month + 1, 0).getDate();
  const active = [];
  for (let d = 1; d <= dim; d++) if (r() < 0.42) active.push(d);
  while (active.length < 6) active.push(active.length * 4 + 3);
  const w = active.map(() => r() * 2 - 0.55);
  const sum = w.reduce((a, b) => a + b, 0) || 1;
  const out = {};
  let run = 0;
  active.forEach((d, i) => { const v = Math.round(totalPence * (w[i] / sum)); out[d] = v; run += v; });
  out[active[active.length - 1]] += totalPence - run;
  return out;
}

function buildLedger() {
  const bets = [];
  const dayTotals = {};

  for (let m = 0; m < 12; m++) {
    const target = MONTHS_2026[m];
    const r = rng(m * 7919 + 104729);
    const days = daysForMonth(r, m, target);
    dayTotals[m] = days;
    if (m === 7) continue;
    for (const d of Object.keys(days).map(Number).sort((a, b) => a - b)) {
      if (m === TODAY.month && d > TODAY.day) continue;
      bets.push(...buildDay(r, YEAR_NOW, m, d, days[d]));
    }
  }

  /* August's handcrafted slips are the ones the walkthrough and the bot
     preview quote, so they are fixed. On their own they made August far
     thinner than the rest of the year — 25 bets where other months carry
     ~80 — which also pushed its ROI to an implausible 43%. Fill each
     active day with extra churn that nets to exactly zero, so the day, the
     month and the year totals are untouched while turnover and bet count
     land where a real August would. */
  {
    const r = rng(880_301);
    for (const d of Object.keys(AUGUST_DAYS).map(Number)) {
      bets.push(...buildDay(r, YEAR_NOW, 7, d, 0));
    }
  }

  for (const s of AUG_SLIPS) {
    bets.push(makeBet({ event: s[0], selection: s[1], market: s[1].includes('leg') ? 'Multiple'
        : s[1].startsWith('Over') || s[1].startsWith('Under') ? 'Over/Under'
        : s[1].startsWith('BTTS') ? 'Both to score' : 'Match result',
      odds: s[2], stake: s[3], profit: s[4], outcome: s[5], book: s[6],
      year: YEAR_NOW, month: 7, day: s[7], time: s[8], tipster: s[9], tg: !!s[10] }));
  }

  bets.sort((a, b) => (b.month - a.month) || (b.day - a.day) || b.time.localeCompare(a.time));
  return { bets, dayTotals };
}

const { bets: LEDGER, dayTotals: DAY_TOTALS } = buildLedger();
export { LEDGER, DAY_TOTALS };

/* Everything before the account existed, brought across as totals. The
   figures are LIFETIME minus the 2026 ledger, so all time always equals
   ledger plus imports and can never drift. */
function computeImported() {
  const y = LEDGER.reduce((a, b) => ({
    profit: a.profit + b.profit,
    turnover: a.turnover + b.stake,
    bets: a.bets + 1,
    won: a.won + (b.outcome === 'won' ? 1 : 0),
    lost: a.lost + (b.outcome === 'lost' ? 1 : 0),
    cash: a.cash + (b.outcome.startsWith('cash') ? 1 : 0)
  }), { profit: 0, turnover: 0, bets: 0, won: 0, lost: 0, cash: 0 });

  return {
    ledger2026: y,
    imported: {
      profit: LIFETIME.profit - y.profit,
      turnover: LIFETIME.turnover - y.turnover,
      bets: LIFETIME.bets - y.bets,
      won: LIFETIME.won - y.won,
      lost: LIFETIME.lost - y.lost,
      cash: LIFETIME.cash - y.cash,
      years: [2023, 2024, 2025]
    }
  };
}
export const { ledger2026: LEDGER_2026, imported: IMPORTED } = computeImported();

export function monthTotal(m) {
  const d = DAY_TOTALS[m] || {};
  return Object.keys(d).reduce((a, k) => a + d[k], 0);
}
export function yearTotal() {
  let t = 0; for (let m = 0; m < 12; m++) t += monthTotal(m); return t;
}
export function betsOn(month, day) {
  return LEDGER.filter(b => b.month === month && b.day === day);
}

/* ---------- people and groups ---------- */
export const PEOPLE = [
  { n: 'James',   a: 'JA', pv: 'public',  mu: true,  un: 5000,  all: 537_000,   roi: 4.8,  b: 1920, v: false, ing: true,  er: true,  gr: [0, 1] },
  { n: 'AuntJem', a: 'AJ', pv: 'friends', mu: true,  un: 2500,  all: 120_200,   roi: 3.1,  b: 1105, v: false, ing: true,  er: true,  gr: [0] },
  { n: 'Nella',   a: 'NE', pv: 'friends', mu: false, un: 2000,  all: 41_600,    roi: 2.2,  b: 742,  v: false, ing: true,  er: false, gr: [0] },
  { n: 'Fitzy',   a: 'FI', pv: 'public',  mu: false, un: 10000, all: 2_011_000, roi: 11.4, b: 1214, v: false, ing: true,  er: false, gr: [1] },
  { n: 'HB',      a: 'HB', pv: 'public',  mu: false, un: 20000, all: 5_880_000, roi: 9.8,  b: 3180, v: true,  ing: true,  er: true,  gr: [1] },
  { n: 'Mo',      a: 'MO', pv: 'private', mu: true,  un: 10000, all: 1_107_000, roi: 7.6,  b: 964,  v: false, ing: true,  er: true,  gr: [0] },
  { n: 'Priya',   a: 'PR', pv: 'public',  mu: false, un: 1000,  all: -9_200,    roi: -1.9, b: 498,  v: false, ing: false, er: true,  gr: [0] },
  { n: 'BigTez',  a: 'BT', pv: 'friends', mu: false, un: 5000,  all: 796_500,   roi: 6.4,  b: 2051, v: false, ing: false, er: true,  gr: [1] },
  { n: 'Zhang',   a: 'ZH', pv: 'public',  mu: false, un: 10000, all: 445_000,   roi: 4.2,  b: 780,  v: true,  ing: false, er: false, gr: [1] }
];

/* Each person's year is derived from their all-time figure with a stable
   seed, so their month, their sparkline and their rank in a group are the
   same number seen three ways. */
export function personMonths(p) {
  if (p._mo) return p._mo;
  const r = rng(p.n.split('').reduce((a, c) => a + c.charCodeAt(0), 0) * 31 + 7);
  const share = 0.28 + r() * 0.14;
  const total = Math.round(p.all * share);
  const w = [];
  for (let m = 0; m <= TODAY.month; m++) w.push(r() * 2 - 0.42);
  const sum = w.reduce((a, b) => a + b, 0) || 1;
  const mo = new Array(12).fill(0);
  let run = 0;
  for (let m = 0; m <= TODAY.month; m++) { mo[m] = Math.round(total * (w[m] / sum)); run += mo[m]; }
  mo[TODAY.month] += total - run;
  p._mo = mo;
  return mo;
}
export function personDays(p, m) {
  const total = personMonths(p)[m] || 0;
  if (!total) return {};
  const r = rng((p.n.charCodeAt(0) * 31 + m * 7919 + p.n.length * 13) >>> 0);
  const dim = new Date(YEAR_NOW, m + 1, 0).getDate();
  const last = m === TODAY.month ? TODAY.day : dim;
  const act = [];
  for (let d = 1; d <= last; d++) if (r() < 0.38) act.push(d);
  while (act.length < 4) act.push(act.length * 5 + 2);
  const w = act.map(() => r() * 2 - 0.55);
  const sum = w.reduce((a, b) => a + b, 0) || 1;
  const o = {}; let run = 0;
  act.forEach((d, i) => { const v = Math.round(total * (w[i] / sum)); o[d] = v; run += v; });
  o[act[act.length - 1]] += total - run;
  return o;
}

export const GROUPS = [
  { name: 'Sunday League', code: 'SUN-4K2', mem: ['You', 'James', 'AuntJem', 'Nella', 'Priya', 'Mo'], since: 'March 2025' },
  { name: 'Ultras', code: 'ULT-9Q7', mem: ['You', 'HB', 'Fitzy', 'BigTez', 'Zhang', 'James'], since: 'November 2025' }
];

/* ---------- bets still running, logged at placement ---------- */
export const PENDING = [
  { id: 'p1', event: 'Arsenal v Chelsea', selection: 'Over 2.5 Goals', odds: 1.85, stake: 20000, book: 'bet365', placed: '18:12', ko: '20:00', tipster: 'HB', live: false },
  { id: 'p2', event: 'Brighton v Everton', selection: 'Over 1.5 Goals', odds: 1.44, stake: 15000, book: 'Paddy Power', placed: '20:34', ko: '20:00', tipster: '', live: true, at: '0-0, 34 mins' },
  { id: 'p3', event: 'Bet builder, 3 legs', selection: 'Saka 1+ shot, over 9.5 corners, Arsenal win', odds: 4.20, stake: 6000, book: 'Sky Bet', placed: '19:05', ko: '20:00', tipster: 'James', live: false },
  { id: 'p4', event: 'Molde v Bodø/Glimt', selection: 'Molde -1 handicap', odds: 2.10, stake: 12000, book: 'Paddy Power', placed: '17:30', ko: '19:00', tipster: '', live: false },
  { id: 'p5', event: 'Legia Warsaw v Raków', selection: 'Legia -1 handicap', odds: 2.05, stake: 12000, book: 'bet365', placed: '17:40', ko: '19:00', tipster: '', live: false },
  { id: 'p6', event: 'Vaasa v Honka', selection: 'Over 1.5 Goals', odds: 1.60, stake: 18000, book: 'Betfair', placed: '16:50', ko: '18:00', tipster: '', live: false },
  { id: 'p7', event: 'Sirius v Djurgården', selection: 'Over 2.5 Goals', odds: 1.90, stake: 10000, book: 'bet365', placed: '18:00', ko: '19:45', tipster: 'Zhang', live: false }
];

/* Fixture results the demo grader runs against. In production these come
   from the results feed keyed on fixture id. Fixed here so every branch of
   the engine has a real case: a clean win, a European handicap that loses
   on the push scoreline, an Asian one that wins, an abandoned game and a
   tie that went to extra time. */
export const DEMO_RESULTS = {
  p1: { status: 'FT', home: 'Arsenal', away: 'Chelsea', hg: 2, ag: 1, hth: 1, hta: 0 },
  p2: { status: 'FT', home: 'Brighton', away: 'Everton', hg: 1, ag: 2, hth: 0, hta: 1 },
  p3: { status: 'FT', home: 'Arsenal', away: 'Chelsea', hg: 2, ag: 1, hth: 1, hta: 0 },
  p4: { status: 'FT', home: 'Molde', away: 'Bodø/Glimt', hg: 2, ag: 1, hth: 1, hta: 1 },
  p5: { status: 'FT', home: 'Legia Warsaw', away: 'Raków', hg: 3, ag: 0, hth: 1, hta: 0 },
  p6: { status: 'ABANDONED', home: 'Vaasa', away: 'Honka', hg: 2, ag: 0 },
  p7: { status: 'AET', home: 'Sirius', away: 'Djurgården', hg: 3, ag: 2 }
};
