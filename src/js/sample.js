/* The demo record: 486 fabricated bets across 120 days.
 *
 * WHY IT IS GENERATED RATHER THAN WRITTEN OUT
 * A demo page needs enough bets that the analysis means something. Four
 * hundred and eighty six hand-written rows is a file nobody maintains and
 * a payload nobody wants to download, and a smaller set makes every
 * breakdown a curiosity rather than a demonstration: a by-odds table over
 * twelve bets shows nothing except that twelve is not many.
 *
 * WHY IT IS SEEDED
 * The same seed gives the same record on every device and every reload. A
 * demo whose numbers move when you refresh cannot be discussed, screenshot
 * or checked, and the closing caption on each block refers to specific
 * figures in it.
 *
 * WHAT MAKES IT HONEST
 *  · It is labelled a fabricated sample on the page, twice, including once
 *    in a disclaimer that says it is not meant to suggest a typical result.
 *  · The arithmetic reconciles. Profit is stake x (odds - 1) on a win,
 *    minus the stake on a loss, and zero on a void or a push. Anyone who
 *    adds up the recent bets table gets the number in the headline.
 *  · It never reaches the app. Nothing here is imported by render.js, and
 *    the dashboard reads the real store only. There is one grader and one
 *    source of a user's own figures, and neither is this file.
 *  · The shape is unremarkable on purpose: a small edge, a long losing run
 *    in the middle, and a win rate that looks worse than the ROI. A demo
 *    record that climbs in a straight line is an advert.
 */
import { bookName } from './books.js';

/* mulberry32: small, fast, and identical everywhere. */
function rng(seed) {
  return function () {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

const TEAMS = [
  'Arsenal', 'Aston Villa', 'Brentford', 'Brighton', 'Chelsea', 'Crystal Palace',
  'Everton', 'Fulham', 'Liverpool', 'Man City', 'Man Utd', 'Newcastle',
  'Nott\'m Forest', 'Spurs', 'West Ham', 'Wolves', 'Bournemouth', 'Leeds',
  'Real Madrid', 'Barcelona', 'Atletico Madrid', 'Sevilla', 'Villarreal', 'Real Betis',
  'Bayern Munich', 'Dortmund', 'Leverkusen', 'Stuttgart',
  'Inter', 'Milan', 'Juventus', 'Napoli', 'Roma', 'Lazio',
  'PSG', 'Marseille', 'Lyon', 'Monaco'
];
const TENNIS = [
  'Sinner J.', 'Alcaraz C.', 'Djokovic N.', 'Zverev A.', 'Medvedev D.',
  'Rune H.', 'Fritz T.', 'Rublev A.', 'Tsitsipas S.', 'De Minaur A.'
];
const HORSES = [
  'Ascot 14:05', 'Newmarket 15:20', 'Cheltenham 13:50', 'York 16:10',
  'Kempton 19:45', 'Doncaster 14:35', 'Haydock 15:05', 'Sandown 16:40'
];
const MARKETS = [
  'Full Time Result', 'Over 2.5 Goals', 'Under 2.5 Goals', 'Both Teams to Score',
  'Asian Handicap', 'Double Chance', 'Draw No Bet', 'Over 9.5 Corners'
];
/* Real brands from the registry, so a sample bet cannot name a bookmaker
   the settlement engine and the reference pages have never heard of. */
const BOOKS = ['bet365', 'Paddy Power', 'Sky Bet', 'William Hill', 'Ladbrokes', 'Betfred', 'Coral']
  .map(bookName);
const COMPS = ['Premier League', 'La Liga', 'Bundesliga', 'Serie A', 'Ligue 1', 'Champions League'];

/* Odds bands, their share of the record, and the return on turnover each
   one is built to produce.
 *
 * `roi` is a TARGET, not a probability, and the winners in each band are
 * assigned by quota to hit it. An independent coin flip per bet does not
 * work here: at 54 bets the variance in the 6.01+ band swamped the
 * intended edge, and the first version of this file produced a record
 * where the longest odds were the most profitable at +29% and the middle
 * band lost 14%. That is not a shape any real ledger has, and a demo that
 * says "your long shots are where the money is" is worse than no demo.
 *
 * The shape here is the ordinary one: a small edge in the middle of the
 * book, and money leaking out of the long shots. It is the finding most
 * people are surprised by, which is the point of measuring. */
const BANDS = [
  { lo: 1.00, hi: 2.00, label: '1.00 to 2.00', weight: 0.34, roi: 0.031 },
  { lo: 2.01, hi: 3.50, label: '2.01 to 3.50', weight: 0.36, roi: 0.072 },
  { lo: 3.51, hi: 6.00, label: '3.51 to 6.00', weight: 0.20, roi: -0.081 },
  { lo: 6.01, hi: 15.0, label: '6.01 and above', weight: 0.10, roi: -0.223 }
];

/* What each sport adds to or takes off its band's return. Racing loses,
   which is both the ordinary finding and the one consistent with the rest
   of the product: racing is the sport Slippery refuses to settle, and a
   demo showing it as the best thing in the record would be arguing
   against itself. */
const SPORT_ADJ = { football: 0.005, tennis: 0.058, horses: -0.135 };

/* ONE GENERATOR, TWO WINDOWS.
 *
 * The demo presents and claims the most recent 120 days and 486 bets,
 * which is the figure quoted on the page. The dataset itself runs back two
 * years, because the tutorial walks somebody through a Yearly period and a
 * year-on-year comparison, and a 120 day set cannot show either. Both
 * claims are true of the same seeded data: DEMO_DAYS is what the demo
 * says, HISTORY_DAYS is what exists behind it.
 *
 * Density is deliberately not uniform. The recent window is the active
 * record somebody would recognise; the older two years are thinner,
 * because that is what a record looks like when you have been importing it
 * rather than living in it. */
const DAYS = 120;
const COUNT = 486;
const HISTORY_DAYS = 730;
const HISTORY_COUNT = 540;

function build() {
  const r = rng(20260813);
  const pick = arr => arr[Math.floor(r() * arr.length)];
  const bets = [];

  /* Dates run backwards from today so the demo is never stale. The day
     offsets are deterministic; only the calendar dates move. */
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const dateAt = back => {
    const d = new Date(today);
    d.setDate(d.getDate() - back);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') +
      '-' + String(d.getDate()).padStart(2, '0');
  };

  for (let i = 0; i < COUNT + HISTORY_COUNT; i++) {
    /* Weighted band choice. */
    let x = r(), band = BANDS[0];
    for (const b of BANDS) { if (x < b.weight) { band = b; break; } x -= b.weight; }

    /* The floor is 1.10, not the band's own 1.00. A price of 1.00 is not a
       bet, and rounding one produced a "won" bet with a profit of exactly
       zero, which then counted as neither a win nor a loss and left the
       win rate two bets short of the settled count. */
    const lo = Math.max(band.lo, 1.10);
    const odds = Math.round((lo + r() * (band.hi - lo)) * 100) / 100;

    /* Sport mix: mostly football, some tennis, a little racing. Racing is
       here because racing is tracked and never auto-settled, and a demo
       that hides that is selling something the product does not do. */
    const s = r();
    const sport = s < 0.72 ? 'football' : s < 0.90 ? 'tennis' : 'horses';
    let event, selection, market, competition = '';
    if (sport === 'football') {
      let a = pick(TEAMS), b = pick(TEAMS);
      while (b === a) b = pick(TEAMS);
      event = a + ' v ' + b;
      market = pick(MARKETS);
      competition = pick(COMPS);
      selection = market === 'Full Time Result' ? a
        : market === 'Both Teams to Score' ? (r() < 0.6 ? 'Yes' : 'No')
        : market === 'Asian Handicap' ? a + ' -1'
        : market;
    } else if (sport === 'tennis') {
      let a = pick(TENNIS), b = pick(TENNIS);
      while (b === a) b = pick(TENNIS);
      event = a + ' - ' + b;
      market = r() < 0.7 ? 'Match Winner' : 'Total Games';
      selection = market === 'Match Winner' ? a : 'Over 22.5';
    } else {
      event = pick(HORSES);
      market = r() < 0.75 ? 'Win' : 'Each Way';
      selection = 'Selection ' + (1 + Math.floor(r() * 12));
    }

    /* Stakes cluster around a 25 pound unit with the occasional larger one,
       because that is what a real ledger looks like. Integer pence
       throughout, as everywhere else in this codebase. */
    const unit = 2500;
    const mult = r() < 0.72 ? 1 : r() < 0.9 ? 2 : r() < 0.97 ? 0.5 : 4;
    const stake = Math.round(unit * mult / 100) * 100;

    /* The first COUNT bets land in the demo window; the rest spread back
       over the two years behind it. */
    const dayBack = i < COUNT
      ? Math.floor(r() * DAYS)
      : DAYS + Math.floor(r() * (HISTORY_DAYS - DAYS));
    const date = dateAt(dayBack);

    bets.push({ id: 'd' + i, date, dayBack, event, selection, market, competition, sport,
      odds, stake, band, result: '', profit: 0, book: pick(BOOKS) });
  }

  /* ---- results, assigned by quota ----
     Pending first, and only on today and yesterday, so the pending stake
     on the dashboard is a real figure rather than decoration. */
  {
    const recent = bets.filter(b => b.dayBack <= 2);
    for (const b of recent) if (r() < 0.5) b.result = 'pending';
    /* Today's tile has to mean something. Left to chance, every bet placed
       today comes out pending and the tile reads a flat zero, which looks
       like a broken figure rather than a true one. Two of today's bets are
       early enough to have settled, which is also what a real day looks
       like by the evening. */
    const today = recent.filter(b => b.dayBack === 0);
    for (const b of today.slice(0, 2)) b.result = '';
  }

  /* A few voids and pushes. Both return the stake and neither counts in
     the win rate, which is exactly the distinction the product makes and
     a demo without them cannot show. */
  for (const b of bets) {
    if (b.result) continue;
    if (r() < 0.035) { b.result = r() < 0.6 ? 'void' : 'push'; b.profit = 0; }
  }

  /* Now the winners, by quota, over BOTH dimensions the demo reports on.
     Controlling the bands alone was not enough: the sports then inherited
     whatever fell out, and one run had horse racing at +37.7% over 46 bets
     while tennis lost 12%. That is a worse lie than the band problem it
     replaced, because it contradicts what the product itself says about
     racing, so the quota runs per band-and-sport cell and both margins
     come out close to their targets.

     Solving the number of winners exactly is not possible when stakes
     vary, so each cell is shuffled and bets are promoted from lost to won
     until the cell's running profit crosses its target. That lands within
     one bet of the target and leaves which bets won unpredictable. */
  for (const band of BANDS) {
    for (const sport of ['football', 'tennis', 'horses']) {
      const list = bets.filter(b => b.band === band && b.sport === sport && !b.result);
      if (!list.length) continue;
      /* Deterministic shuffle, same seed stream as everything else. */
      for (let i = list.length - 1; i > 0; i--) {
        const j = Math.floor(r() * (i + 1));
        const t = list[i]; list[i] = list[j]; list[j] = t;
      }
      const staked = list.reduce((a, b) => a + b.stake, 0);
      const target = staked * (band.roi + SPORT_ADJ[sport]);
      let profit = -staked;
      /* Promote a bet only when doing so moves the cell CLOSER to its
         target, rather than simply while the cell is still short of it.
         Stopping at the first crossing overshoots badly in a small cell:
         one winner at 10.0 on a 25 pound stake is 225 pounds of profit,
         which in a five bet cell turned a target of minus 20% into plus
         26%. Scanning the whole list rather than breaking also lets a
         later, smaller bet fine-tune what a big one overshot. */
      for (const b of list) {
        const win = Math.round(b.stake * (b.odds - 1));
        const after = profit + b.stake + win;
        if (Math.abs(after - target) < Math.abs(profit - target)) {
          b.result = 'won'; b.profit = win; profit = after;
        } else {
          b.result = 'lost'; b.profit = -b.stake;
        }
      }
    }
  }

  /* A handful of cash outs, because six outcomes is the real set and a
     demo showing four of them demonstrates a different product. Taken out
     of settled bets, so they change the outcome mix without moving a
     band's return much. */
  for (const b of bets) {
    if (b.result === 'lost' && r() < 0.035) {
      b.result = 'cash-loss'; b.profit = -Math.round(b.stake * (0.3 + r() * 0.4));
    } else if (b.result === 'won' && r() < 0.045) {
      b.result = 'cash-profit'; b.profit = Math.round(b.profit * (0.45 + r() * 0.35));
    }
  }

  for (const b of bets) delete b.band;
  bets.sort((a, b) => a.dayBack - b.dayBack || a.id.localeCompare(b.id));
  return bets;
}

export const DEMO_BETS = build();
export const DEMO_DAYS = DAYS;

/* ---------- derived figures ----------
   Scoped to the demo window, because the page says 486 bets over 120 days
   and every figure beside that sentence has to be the same 486 bets. The
   two years behind them are still there, reachable by the Yearly period
   once the set is loaded into the dashboard. */
export const DEMO_WINDOW = DEMO_BETS.filter(b => b.dayBack < DAYS);
const settled = DEMO_WINDOW.filter(b => b.result !== 'pending');
const counted = settled.filter(b => b.result !== 'void' && b.result !== 'push');

const sum = (arr, f) => arr.reduce((a, b) => a + f(b), 0);

/* Wins and losses are counted by RESULT, not by the sign of the profit.
   Cashing out flat makes zero and is still a settled bet with an outcome,
   and a bet whose profit rounds to nothing is not a third category. Void
   and push are the only outcomes excluded from the win rate, because they
   returned the stake and decided nothing. */
const WON = { won: 1, 'cash-profit': 1 };
const LOST = { lost: 1, 'cash-loss': 1, 'cash-flat': 1 };

function bucket(list) {
  const staked = sum(list, b => b.stake);
  const profit = sum(list, b => b.profit);
  const wins = list.filter(b => WON[b.result]).length;
  const losses = list.filter(b => LOST[b.result]).length;
  return {
    bets: list.length, staked, profit,
    roi: staked ? profit / staked * 100 : 0,
    winRate: (wins + losses) ? wins / (wins + losses) * 100 : 0,
    wins, losses
  };
}

const inLastDays = n => settled.filter(b => b.dayBack < n);

export const DEMO = {
  total: bucket(settled),
  today: bucket(settled.filter(b => b.dayBack === 0)),
  week: bucket(inLastDays(7)),
  month: bucket(inLastDays(30)),
  pendingStake: sum(DEMO_WINDOW.filter(b => b.result === 'pending'), b => b.stake),
  pendingCount: DEMO_WINDOW.filter(b => b.result === 'pending').length,
  avgOdds: counted.length ? sum(counted, b => b.odds) / counted.length : 0,

  byBand: BANDS.map(band => {
    const list = settled.filter(b => b.odds >= band.lo && b.odds <= band.hi);
    return Object.assign({ label: band.label }, bucket(list));
  }),

  bySport: ['football', 'tennis', 'horses'].map(sport => {
    const list = settled.filter(b => b.sport === sport);
    const name = sport === 'horses' ? 'Horse racing' : sport === 'tennis' ? 'Tennis' : 'Football';
    return Object.assign({ label: name }, bucket(list));
  }),

  byComp: (() => {
    const seen = new Map();
    for (const b of settled) {
      if (!b.competition) continue;
      if (!seen.has(b.competition)) seen.set(b.competition, []);
      seen.get(b.competition).push(b);
    }
    return [...seen.entries()]
      .map(([label, list]) => Object.assign({ label }, bucket(list)))
      .sort((a, b) => b.profit - a.profit);
  })(),

  recent: settled.slice(0, 12),

  /* Days, for the tappable calendar strip. */
  days: (() => {
    const m = new Map();
    for (const b of DEMO_WINDOW) {
      if (!m.has(b.date)) m.set(b.date, { date: b.date, dayBack: b.dayBack, bets: [], net: 0 });
      const d = m.get(b.date);
      d.bets.push(b);
      if (b.result !== 'pending') d.net += b.profit;
    }
    return [...m.values()].sort((a, b) => a.dayBack - b.dayBack);
  })()
};


/* ---------- the demo, as the API would have sent it ----------
 *
 * The demo used to be a second dashboard: its own tiles, its own table,
 * its own period picker, its own everything, built in demo.js against
 * these figures directly. Two implementations of one screen means the
 * thing a stranger looks at before signing up is not the thing they get,
 * and it drifted exactly as you would expect.
 *
 * So the demo loads the sample through the same hydrate() the real ledger
 * uses and renders through the same renderers. This turns the fabricated
 * bets into the shape GET /api/bets returns, and nothing else about it is
 * special.
 *
 * `trial: null` because there is no account, and `capture` is stated
 * rather than invented: every sample bet carries a stage, so the split is
 * real arithmetic over fabricated bets rather than a number typed in.
 */
const API_OUTCOME = {
  won: 'won', lost: 'lost', void: 'void', push: 'push',
  'cash-profit': 'cash-profit', 'cash-loss': 'cash-loss', 'cash-flat': 'cash-flat'
};

/**
 * @param {{full?:boolean}} [opts] `full` returns the whole two year set,
 *   which the tutorial needs to walk somebody through a Yearly period.
 *   The demo takes the default, the 120 day window, because 486 bets over
 *   120 days is what the page says and the figures beside that sentence
 *   have to be the same 486 bets.
 */
export function demoPayload(opts) {
  const source = opts && opts.full ? DEMO_BETS : DEMO_WINDOW;
  const bets = source.map(b => ({
    id: b.id,
    event: b.event,
    selection: b.selection,
    market: b.market,
    bookmaker: b.book,
    book: b.book,
    odds: b.odds,
    stake: b.stake,
    profit: b.result === 'pending' ? null : b.profit,
    outcome: b.result === 'pending' ? null : (API_OUTCOME[b.result] || null),
    status: b.result === 'pending' ? 'pending' : 'settled',
    source: 'demo',
    competition: b.competition,
    sport: b.sport,
    /* Midday, so a timezone cannot move a bet to the day before and make
       the calendar disagree with the ledger. */
    placedAt: b.date + 'T12:00:00.000Z'
  }));
  return { bets, pl: [], trial: null, capture: null };
}
