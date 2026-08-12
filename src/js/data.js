/* Reference data and the live ledger store.
 *
 * There is no demo dataset any more. LEDGER, PENDING and the aggregates
 * start empty and are filled by hydrate() from GET /api/bets. Every figure
 * the app shows is computed from those records, nothing downstream
 * fabricates a number, and an empty ledger renders as an honest empty
 * state rather than as somebody else's numbers.
 *
 * The exports below are live bindings. Modules that `import { LEDGER }`
 * see the new array after hydrate() reassigns it, which is what lets the
 * renderers stay ignorant of where the data came from.
 */

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
/* Sprite ids, not emoji. An emoji rasterises from the system font, so it
   cannot take #86EFAC or #FCA5A5, the two colours the brief fixes as
   semantic, and it renders differently on every platform. These are
   decorative; every row also carries OUTCOME_LABEL as real text, because
   an icon alone is not a label. */
export const OUTCOME_ICON = {
  'won': 'i-won', 'lost': 'i-lost', 'void': 'i-void',
  'cash-profit': 'i-cash', 'cash-loss': 'i-cash', 'cash-flat': 'i-cash'
};
/** Markup for one sprite glyph. `tone` maps onto the semantic colours. */
export function ico(id, cls) {
  return '<svg class="ico' + (cls ? ' ' + cls : '') + '" viewBox="0 0 24 24" ' +
         'aria-hidden="true" focusable="false"><use href="#' + id + '"/></svg>';
}
export function outcomeGroup(o) { return o.startsWith('cash') ? 'cash' : o; }


/* ============================================================
   TODAY
   ============================================================
   Real today, not a pinned demo date. Everything that asks "is
   this cell in the past" reads it, so a stale constant here
   would grey out days that have not happened yet. */
const NOW = new Date();
export const TODAY = {
  year: NOW.getFullYear(),
  month: NOW.getMonth(),
  day: NOW.getDate(),
  dim: new Date(NOW.getFullYear(), NOW.getMonth() + 1, 0).getDate(),
  doy: Math.floor((NOW - new Date(NOW.getFullYear(), 0, 0)) / 86400000)
};

/* Monthly targets, in pence. A new account has none; the user sets one and
   it is stored per month. Absent means "no target", which renders as no
   pace marker rather than as a target of zero. */
export const TARGETS = {};

/* ============================================================
   THE LEDGER
   ============================================================
   Empty until hydrate() fills it. `let` and a re-export rather than
   mutation in place, so importers get a live binding and nobody can hold a
   stale array reference across a reload. */
export let LEDGER = [];
export let PENDING = [];
export let DAY_TOTALS = {};

/* Totals for the years that predate the account, brought across as
   aggregates by the Import flow. Zeroed for a new account, this is the
   one place the old build invented a figure, and it must not do so again:
   all time is exactly the ledger plus whatever the user actually imported. */
export let IMPORTED = { profit: 0, turnover: 0, bets: 0, won: 0, lost: 0, cash: 0, years: [] };

/* Social. Empty until the groups API exists; the views render their empty
   states rather than a cast of invented friends. */
export let PEOPLE = [];
export let GROUPS = [];

/** Everything the session knows about the signed-in user, or null. */
export let ME = null;

/* ---------- hydration ---------- */

/**
 * Replace the ledger with what the server holds.
 * @param {object} payload the body of GET /api/bets
 */
export function hydrate(payload) {
  const rows = (payload && payload.bets) || [];
  const settled = [], running = [];
  for (const r of rows) (r.status === 'settled' ? settled : running).push(fromApi(r));
  LEDGER = settled;
  PENDING = running;
  DAY_TOTALS = buildDayTotals(LEDGER);
  return { settled: LEDGER.length, pending: PENDING.length };
}

export function setImported(totals) {
  IMPORTED = Object.assign({ profit: 0, turnover: 0, bets: 0, won: 0, lost: 0, cash: 0, years: [] }, totals || {});
}
export function setMe(user) { ME = user || null; }

/** Add one bet without refetching the world, used after a confirm. */
export function addBet(row) {
  const b = fromApi(row);
  (b.outcome ? LEDGER : PENDING).unshift(b);
  if (b.outcome) DAY_TOTALS = buildDayTotals(LEDGER);
  return b;
}

/** Move a bet from running to settled in place. */
export function settleLocal(id, outcome, profit) {
  const i = PENDING.findIndex(b => b.id === id);
  if (i >= 0) {
    const b = PENDING.splice(i, 1)[0];
    b.outcome = outcome; b.profit = profit;
    LEDGER.unshift(b);
  } else {
    const b = LEDGER.find(x => x.id === id);
    if (b) { b.outcome = outcome; b.profit = profit; }
  }
  DAY_TOTALS = buildDayTotals(LEDGER);
}

/* The server speaks ISO timestamps and column names; the renderers speak
   month/day/time. Converting once here keeps the date maths out of every
   render function, and out of the hot path of a 2,000-row list. */
function fromApi(r) {
  const d = new Date(r.placedAt || Date.now());
  return {
    id: r.id,
    event: r.event || '',
    selection: r.selection || '',
    market: r.market || '',
    book: r.book || '',
    odds: r.odds == null ? 0 : r.odds,
    stake: r.stake || 0,
    profit: r.profit == null ? 0 : r.profit,
    outcome: r.outcome || '',
    status: r.status,
    reason: r.reason || '',
    tipster: r.tipster || '',
    viaTelegram: r.source === 'telegram',
    year: d.getFullYear(),
    month: d.getMonth(),
    day: d.getDate(),
    time: String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'),
    placedAt: r.placedAt
  };
}

function buildDayTotals(bets) {
  const out = {};
  for (const b of bets) {
    if (b.year !== TODAY.year) continue;
    (out[b.month] || (out[b.month] = {}));
    out[b.month][b.day] = (out[b.month][b.day] || 0) + b.profit;
  }
  return out;
}

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

/* Social helpers kept as no-ops so the views keep their shape until the
   groups API lands. They return nothing rather than inventing a curve. */
export function personMonths() { return new Array(12).fill(0); }
export function personDays() { return {}; }
