/* FlashScore, via the feed its own front end reads.
 *
 * ESPN and SofaScore both refuse Vercel's addresses outright. This one
 * answers, and it answers for tennis as well as football, which is what
 * makes it worth having: football-data.co.uk is league football only and has
 * no tennis at all.
 *
 * The feed is not JSON. It is a flat list of `KEY÷value` pairs joined by
 * U+00AC, with `~AA÷` starting each event and `~ZA÷` starting each
 * competition block. Ugly, but it is one request per day for every fixture
 * in every competition, which is exactly the shape a sweep wants.
 *
 * FIELDS
 *   ZA  competition heading, "COUNTRY: Competition - Stage"
 *   AA  event id            AD  kick-off, unix seconds
 *   AE  home name           AF  away name
 *   AG  home score          AH  away score
 *   AB  stage: 1 scheduled, 2 in progress, 3 finished
 *   AC  sub-status within that stage
 *   BC/BD  football: half-time score
 *   BA/BB, BC/BD, BE/BF, BG/BH, BI/BJ  tennis: games in sets one to five
 *
 * THE 90-MINUTE PROBLEM, AND WHAT IS DONE ABOUT IT
 * The feed gives a final score and a half-time score. Neither proves that a
 * match did not go to extra time, and the engine settles on 90 minutes only.
 * So the same reasoning football-data.co.uk relies on is applied per
 * competition instead of per file: LEAGUE football cannot go to extra time,
 * so in a league the final score IS the 90-minute score. Anything that looks
 * like a cup, a play-off, a final or a qualifier is returned with a status
 * the engine does not recognise, which makes it ask rather than settle.
 * A bet nobody graded is recoverable. A bet graded on a 120-minute score is
 * not.
 *
 * Only AC=3 is read as a clean finish. The other finished sub-codes (9, 11,
 * 54 and friends) are undocumented, and one of them is very likely "after
 * extra time", so they get the same unrecognised status and the same ask.
 */

const BASE = 'https://global.flashscore.ninja/2/x/feed/';
/* The feed requires this header. It is not a secret or a credential: it is a
   fixed string the public front end sends on every request. */
const FSIGN = process.env.FLASHSCORE_SIGN || 'SW9D1eZo';

export const SPORT_ID = { football: 1, tennis: 2 };

const HEADERS = {
  'x-fsign': FSIGN,
  'User-Agent': process.env.SCRAPE_UA ||
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
    '(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Accept': '*/*',
  'Referer': 'https://www.flashscore.com/'
};

export function configured() { return process.env.RESULTS_PROVIDER !== 'off'; }

/* Competitions where extra time cannot happen, so full time is 90 minutes.
   Written as "what disqualifies a competition" rather than "what qualifies
   one", because the safe default is to disqualify: a competition nobody
   thought about asks the user instead of being settled. */
export const KNOCKOUT_WORDS = [
  'cup', 'copa', 'coppa', 'pokal', 'beker', 'taca', 'taça', 'kupa', 'kubok',
  'trophy', 'troph', 'shield', 'supercup', 'super cup', 'supercopa',
  'play off', 'play-off', 'playoff', 'promotion', 'relegation',
  'final', 'semi', 'quarter', 'knockout', 'round of',
  'qualification', 'qualifying', 'qualifier', 'preliminary',
  'champions league', 'europa', 'conference league', 'libertadores',
  'sudamericana', 'friendly', 'friendlies', 'world cup', 'euro ', 'nations league',
  'olympic', 'concacaf', 'afc ', 'caf ', 'club world'
];

export function isLeague(competition) {
  const c = String(competition || '').toLowerCase();
  if (!c) return false;
  return !KNOCKOUT_WORDS.some(w => c.includes(w));
}

/* AC=3 is the ordinary "Finished". 4 and 5 are postponed and cancelled,
   which the engine voids. Everything else finished is left unrecognised on
   purpose, so it reaches the engine's "an unrecognised status never
   settles" path. */
export const AC_STATUS = { 3: 'FT', 4: 'POSTPONED', 5: 'CANCELLED' };

async function getFeed(sportId, dayOffset) {
  const url = BASE + 'f_' + sportId + '_' + dayOffset + '_3_en_1';
  const res = await fetch(url, { headers: HEADERS });
  if (res.status === 403 || res.status === 429) {
    const err = new Error('FlashScore refused the request (' + res.status + ').');
    err.statusCode = res.status;
    err.blocked = true;
    throw err;
  }
  if (!res.ok) throw new Error('FlashScore returned ' + res.status + '.');
  return res.text();
}

const int = v => {
  const n = parseInt(String(v == null ? '' : v).trim(), 10);
  return Number.isFinite(n) ? n : undefined;
};

/** Split one feed into `{competition, fields}` records. */
export function parseFeed(text) {
  const out = [];
  let competition = '';
  for (const block of String(text || '').split('~')) {
    if (!block) continue;
    const fields = {};
    for (const pair of block.split('¬')) {
      const at = pair.indexOf('÷');
      if (at > 0) fields[pair.slice(0, at)] = pair.slice(at + 1);
    }
    /* A competition heading and its first event arrive in the same block,
       so the heading is read before the event is emitted. */
    if (fields.ZA) competition = fields.ZA;
    if (fields.AA) out.push({ competition, fields });
  }
  return out;
}

/** Football fixtures, normalised to the shape the engine takes. */
export function toFootball(record) {
  const f = record.fields;
  const status = AC_STATUS[int(f.AC)] || 'FINISHED_UNKNOWN';
  if (int(f.AB) === 1) return null;                 // not started
  if (int(f.AB) === 2) return null;                 // in progress
  const home = (f.AE || '').trim(), away = (f.AF || '').trim();
  if (!home || !away) return null;

  const hg = int(f.AG), ag = int(f.AH);
  const fx = {
    id: 'fs:' + f.AA,
    sport: 'football',
    competition: record.competition,
    status: status === 'FT' && !isLeague(record.competition) ? 'FINISHED_UNKNOWN' : status,
    home, away,
    kickoff: f.AD ? new Date(Number(f.AD) * 1000).toISOString() : null
  };
  if (hg !== undefined && ag !== undefined) {
    fx.hg = hg; fx.ag = ag;
    /* League football has no extra time, so full time IS 90 minutes. Cup
       ties never get here: their status was already replaced above, and the
       engine refuses to settle on a status it does not recognise. */
    if (fx.status === 'FT') { fx.ft90h = hg; fx.ft90a = ag; }
  }
  const hth = int(f.BC), hta = int(f.BD);
  if (hth !== undefined && hta !== undefined) { fx.hth = hth; fx.hta = hta; }
  return fx;
}

/* Tennis. The set pairs run BA/BB, BC/BD, BE/BF, BG/BH, BI/BJ, and a set
   that was not played simply is not there. */
const SET_KEYS = [['BA', 'BB'], ['BC', 'BD'], ['BE', 'BF'], ['BG', 'BH'], ['BI', 'BJ']];

export function toTennis(record) {
  const f = record.fields;
  if (int(f.AB) === 1 || int(f.AB) === 2) return null;
  const home = (f.AE || '').trim(), away = (f.AF || '').trim();
  if (!home || !away) return null;

  const sets = [];
  for (const [a, b] of SET_KEYS) {
    const x = int(f[a]), y = int(f[b]);
    if (x === undefined || y === undefined) break;
    sets.push([x, y]);
  }
  const fx = {
    id: 'fs:' + f.AA,
    sport: 'tennis',
    competition: record.competition,
    /* A tennis match has no extra time, so a clean finish needs no
       qualification the way a cup tie does. Every other sub-code stays
       unrecognised and asks: a retirement settles differently at every
       bookmaker and must never be graded here. */
    status: int(f.AC) === 3 ? 'FT' : 'FINISHED_UNKNOWN',
    home, away,
    kickoff: f.AD ? new Date(Number(f.AD) * 1000).toISOString() : null
  };
  const hg = int(f.AG), ag = int(f.AH);
  if (hg !== undefined && ag !== undefined) { fx.hg = hg; fx.ag = ag; }
  if (sets.length) fx.sets = sets;
  return fx;
}

/* The feed is addressed by days from today, not by date. */
export function dayOffset(date, today = new Date()) {
  const a = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  const b = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  return Math.round((a - b) / 86400000);
}

const MAX_DAYS = 6;

async function pull(sport, dateFrom, dateTo) {
  const from = new Date(dateFrom + 'T00:00:00Z');
  const to = new Date(dateTo + 'T00:00:00Z');
  const first = dayOffset(from), last = dayOffset(to);
  const out = [];
  let reached = 0;
  const shape = sport === 'tennis' ? toTennis : toFootball;

  for (let d = first; d <= last && d - first < MAX_DAYS; d++) {
    try {
      const text = await getFeed(SPORT_ID[sport], d);
      reached++;
      for (const record of parseFeed(text)) {
        const fx = shape(record);
        if (fx) out.push(fx);
      }
    } catch (err) {
      /* One unreachable day is not a reason to abandon the rest, but every
         day refusing is, and the caller needs to know it was a block rather
         than an empty afternoon. */
      if (err.blocked && reached === 0 && d === last) throw err;
    }
  }
  if (!reached) {
    const err = new Error('No FlashScore day could be read.');
    err.blocked = true;
    throw err;
  }
  return out;
}

/** Finished football across a date window. Dates are YYYY-MM-DD. */
export function finishedBetween(dateFrom, dateTo) { return pull('football', dateFrom, dateTo); }

/** Finished tennis across a date window. */
export function finishedTennis(dateFrom, dateTo) { return pull('tennis', dateFrom, dateTo); }

/** One cheap request, to report whether this host can reach the feed. */
export async function reachable() {
  try {
    const text = await getFeed(SPORT_ID.football, 0);
    const n = parseFeed(text).length;
    return n ? { ok: true, events: n } : { ok: false, why: 'feed was empty' };
  } catch (err) {
    return { ok: false, why: err.blocked ? 'blocked (' + (err.statusCode || '') + ')' : err.message };
  }
}
