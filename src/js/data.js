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

/* Graphite first, and first means default: it is what :root carries in
   01-tokens.css, so an account with no theme set gets it without the client
   having to write an attribute. Periwinkle is second.

   The two hexes on each row are the swatch, and they are the theme's real
   --p and --s rather than an approximation, so the picker cannot show a
   colour the theme does not use. */
export const THEMES = [
  ['graphite',   'Graphite',   '#7C8DA6', '#B4C4DA'],
  ['periwinkle', 'Periwinkle', '#5D76CB', '#7DD3FC'],
  ['ink',        'Ink',        '#7C79A0', '#B3AAD8'],
  ['tide',       'Tide',       '#3E93B5', '#8FD4EC'],
  ['chalk',      'Chalk',      '#A8998A', '#EADFC9']
];
/* The colour behind the browser chrome. */
export const THEME_BG = { graphite: '#12161D', periwinkle: '#0F172A', ink: '#09090C',
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
/* IMPORTED lived here: one aggregate blob of imported history, holding a
   profit, a turnover and a bet count. Nothing ever wrote to it, so it was
   always zeros, and importing a year of history moved the profit and loss
   figure by exactly nothing while still drawing on the calendar.

   Imported history is now the PL rows below and nothing else. A dated
   figure with no fixture behind it is what an import actually is, and
   stats.js sums those rows into whatever period is on screen. */

/* Social. Empty until the groups API exists; the views render their empty
   states rather than a cast of invented friends. */
export let PEOPLE = [];
export let GROUPS = [];

/** Everything the session knows about the signed-in user, or null. */
export let ME = null;

/* What is left of the free trial, as GET /api/bets reports it:
   {endsAt, daysLeft, slipsLeft, slipsUsed, over, active}. Null on a paid
   account, which is how the UI knows to say nothing at all. */
export let TRIAL = null;

/* Profit and loss entered for a period rather than logged as bets: typed
   in, or read off another tracker's screenshot. Never counted as bets by
   anything, because there are no bets behind them. */
export let PL = [];

/* How much of the record was captured before anything was known.
   {known, prematch, inplay, settled, rate} or null when nothing has a
   stage. Null and a rate of 0 are different facts and stay different. */
export let CAPTURE = null;

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
  /* The trial is the server's arithmetic, not ours. Counting slips in the
     browser would give a different answer to the one that actually blocks
     the next upload, and "you have 3 left" followed by a refusal is worse
     than no counter at all. Null when the account is paid. */
  TRIAL = (payload && payload.trial) || null;
  PL = (payload && payload.pl) || [];
  CAPTURE = (payload && payload.capture) || null;
  /* Period figures land on the calendar beside the bets. They are added
     after buildDayTotals so a day with both a bet and a typed figure shows
     the sum, which is what somebody who has entered both means. Only daily
     entries do this: a month's total spread across its days would invent
     thirty figures nobody gave us. */
  for (const p of PL) {
    if (p.period !== 'day') continue;
    const d = new Date(p.date + 'T12:00:00');
    if (Number.isNaN(d.getTime()) || d.getFullYear() !== TODAY.year) continue;
    const m = d.getMonth(), day = d.getDate();
    (DAY_TOTALS[m] || (DAY_TOTALS[m] = {}));
    DAY_TOTALS[m][day] = (DAY_TOTALS[m][day] || 0) + p.profit;
  }
  return { settled: LEDGER.length, pending: PENDING.length, pl: PL.length };
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

/* ---------- social ----------
   Filled by GET /api/groups. Empty until then, and empty is what a new
   account genuinely is, so the views render their empty states rather than
   a cast of invented friends. */
export function hydrateSocial(payload) {
  GROUPS = (payload && payload.groups) || [];
  /* Group members are merged rather than replacing the list, because the
     same person can be both somebody you follow and somebody in your
     Sunday league, and two sources overwriting each other made them
     flicker between having figures and not. */
  PEOPLE = merge(PEOPLE.filter(p => p.ing || p.er), (payload && payload.people) || []);
  return { groups: GROUPS.length, people: PEOPLE.length };
}

/* Search results, from GET /api/people?q=. Null while a search is in
   flight, which is different from an empty array: one is "looking", the
   other is "nobody by that name". */
export let FOUND = null;
export function setFound(list) { FOUND = list; }

/** Following and followers, from GET /api/people. */
export function hydratePeople(payload) {
  const following = (payload && payload.following) || [];
  const followers = (payload && payload.followers) || [];
  /* Keep whoever is only here because you share a group with them. */
  PEOPLE = merge(following.concat(followers), PEOPLE.filter(p => p.gr && p.gr.length));
  return { following: following.length, followers: followers.length };
}

/* One row per display name, first source wins.
 *
 * Order matters and is the caller's choice: whichever list is passed first
 * is the authority. The follow lists know about privacy and mutuality; the
 * group response knows about group membership and nothing else, so it goes
 * second and only contributes people the first list did not mention.
 *
 * `gr` is unioned rather than overwritten, or somebody you follow who is
 * also in two of your groups would lose the group links. */
function merge(primary, secondary) {
  const out = [];
  const at = new Map();
  for (const list of [primary, secondary]) {
    for (const p of list) {
      const seen = at.get(p.n);
      if (seen == null) {
        at.set(p.n, out.length);
        out.push({ ...p, gr: [...(p.gr || [])] });
      } else {
        const row = out[seen];
        for (const g of (p.gr || [])) if (!row.gr.includes(g)) row.gr.push(g);
      }
    }
  }
  return out.sort((a, b) => a.n.toLowerCase().localeCompare(b.n.toLowerCase()));
}

/* Twelve monthly totals for one person, in pence.
   The server sends them; this is the accessor the renderers use, and it
   returns zeros for anyone it has no figures for rather than undefined,
   because every caller sums it. */
export function personMonths(p) {
  return (p && Array.isArray(p.months)) ? p.months : new Array(12).fill(0);
}
/* Per-day figures are not in the group response: a board ranks in units
   over a period, and shipping every member's daily curve to every other
   member is more of their record than the ranking needs. The profile
   mini-calendar renders empty until there is an endpoint that asks the
   person first. */
export function personDays() { return {}; }
