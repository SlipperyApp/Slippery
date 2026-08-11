/* SofaScore results provider.
 *
 * WHY THIS EXISTS AT ALL, given football-data.org already worked:
 * football-data.org's free tier reports `fullTime` INCLUDING extra time and
 * does not expose a regular-time score, so every knockout tie that went past
 * 90 minutes had to come back as {status:'ask'}. SofaScore publishes period
 * scores — `homeScore.normaltime` is the score at 90 minutes — which is
 * exactly the number the settlement rules are written against. That turns a
 * whole class of "ask" into a correct automatic grade.
 *
 * TWO THINGS TO KNOW BEFORE RELYING ON IT:
 *   1. This is an undocumented endpoint behind an aggressive bot filter.
 *      Datacenter IPs — which is what a Vercel function has — are refused
 *      with a 403 and a JSON body, not a challenge page. It was 403 from
 *      every host tried during development. So this provider is written to
 *      fail loudly and cheaply, and `fixtures.js` falls back to
 *      football-data.org rather than leaving bets unsettled.
 *   2. Scraping it is not covered by any published API terms. Flagged for
 *      the owner: a paid feed (API-Football, Opta) is the durable answer if
 *      this becomes load-bearing.
 *
 * The engine never sees any of this. Everything here is normalised to the
 * one fixture shape settlement.js accepts:
 *   { id, status, home, away, hg, ag, hth, hta, ft90h, ft90a }
 */
import { foldName } from './fixtures.js';

const BASE = 'https://api.sofascore.com/api/v1';

/* A browser-shaped request. Not an attempt to defeat the bot filter — it is
   the minimum that makes the endpoint answer at all for a legitimate
   client, and it is what a support request would be asked for. */
const HEADERS = {
  'User-Agent': process.env.SOFASCORE_UA ||
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
    '(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'en-GB,en;q=0.9',
  'Referer': 'https://www.sofascore.com/',
  'Origin': 'https://www.sofascore.com'
};

/** Default on: it needs no key. Set RESULTS_PROVIDER=football-data to pin
    the other one. */
export function configured() {
  return process.env.RESULTS_PROVIDER !== 'football-data';
}

/* SofaScore reports both a coarse `status.type` and a fine `status.code`.
   The code is what carries the distinction the settlement rules turn on —
   whether a finish was inside 90 minutes — so it is what we map. Anything
   unrecognised deliberately falls through to UNKNOWN, which the engine
   treats as "do not settle", because a wrong grade is worse than no grade. */
const CODES = {
  100: 'FT',          // ended in normal time
  110: 'AET',         // after extra time
  120: 'AET',         // after penalties
  60:  'POSTPONED',
  70:  'CANCELLED',
  90:  'ABANDONED',   // the brief: bookmakers differ, so the engine asks
  91:  'ABANDONED',
  0:   'SCHEDULED'
};

export function normalise(ev) {
  if (!ev || !ev.homeTeam || !ev.awayTeam) return null;
  const st = ev.status || {};
  let status = CODES[st.code];
  if (!status) {
    /* Fall back to the coarse type, which is stable across code changes. */
    status = st.type === 'finished' ? 'FT'
      : st.type === 'notstarted' ? 'SCHEDULED'
      : st.type === 'inprogress' ? 'SCHEDULED'
      : st.type === 'postponed' ? 'POSTPONED'
      : st.type === 'canceled' ? 'CANCELLED'
      : 'UNKNOWN';
  }

  const H = ev.homeScore || {}, A = ev.awayScore || {};
  const fixture = {
    id: String(ev.id),
    status,
    home: ev.homeTeam.shortName || ev.homeTeam.name,
    away: ev.awayTeam.shortName || ev.awayTeam.name,
    kickoff: ev.startTimestamp ? new Date(ev.startTimestamp * 1000).toISOString() : undefined
  };

  /* `current` is the headline score and, on a knockout tie, includes extra
     time — the same trap football-data.org sets. It is recorded as hg/ag
     because some markets legitimately use it, but 90-minute settlement
     never reads it. */
  if (num(H.current) && num(A.current)) { fixture.hg = H.current; fixture.ag = A.current; }
  if (num(H.period1) && num(A.period1)) { fixture.hth = H.period1; fixture.hta = A.period1; }

  if (status === 'FT') {
    /* Ended inside 90. The full-time score IS the 90-minute score. */
    if (num(H.current) && num(A.current)) { fixture.ft90h = H.current; fixture.ft90a = A.current; }
  } else if (status === 'AET') {
    /* The whole reason for this provider. `normaltime` is the score as it
       stood at 90 minutes; if it is absent, ft90 stays undefined and the
       engine asks rather than settling on a score including extra time. */
    if (num(H.normaltime) && num(A.normaltime)) {
      fixture.ft90h = H.normaltime;
      fixture.ft90a = A.normaltime;
    } else if (num(H.period1) && num(A.period1) && num(H.period2) && num(A.period2)) {
      /* Both halves present is an equally provable 90 minutes. */
      fixture.ft90h = H.period1 + H.period2;
      fixture.ft90a = A.period1 + A.period2;
    }
  }
  return fixture;
}

const num = v => typeof v === 'number' && Number.isFinite(v);

/* ---------------- network ---------------- */

async function get(path) {
  const res = await fetch(BASE + path, { headers: HEADERS });
  if (res.status === 403 || res.status === 429) {
    /* The bot filter. Distinct error so the caller can fall back rather
       than treat it as "no fixtures today" and leave bets pending forever. */
    const err = new Error('SofaScore refused the request (' + res.status + ').');
    err.statusCode = res.status;
    err.blocked = true;
    throw err;
  }
  if (!res.ok) {
    const err = new Error('SofaScore returned ' + res.status + '.');
    err.statusCode = 502;
    throw err;
  }
  return res.json();
}

/** Every football event SofaScore lists for a date. Dates are YYYY-MM-DD. */
export async function eventsOn(date) {
  const body = await get('/sport/football/scheduled-events/' + date);
  return (body.events || []).map(normalise).filter(Boolean);
}

/** Finished football fixtures across a date window, inclusive. */
export async function finishedBetween(dateFrom, dateTo) {
  const out = [];
  for (const date of datesBetween(dateFrom, dateTo)) {
    const day = await eventsOn(date);
    for (const fx of day) {
      if (fx.status === 'FT' || fx.status === 'AET' || fx.status === 'ABANDONED' ||
          fx.status === 'POSTPONED' || fx.status === 'CANCELLED') out.push(fx);
    }
  }
  return out;
}

function datesBetween(a, b) {
  const out = [];
  const start = new Date(a + 'T00:00:00Z'), end = new Date(b + 'T00:00:00Z');
  for (let d = start; d <= end; d = new Date(d.getTime() + 86400000)) {
    out.push(d.toISOString().slice(0, 10));
    if (out.length > 14) break;          // a sweep is days, never months
  }
  return out;
}

/* ---------------- exact match ----------------
   The owner's requirement is the exact match, and that is also the only
   safe rule: settling a bet against another game's score is unrecoverable,
   whereas leaving it pending is not. So both team names must appear in the
   slip text, and exactly one candidate may survive. Anything less returns
   null and the bet stays pending. */
export function findExact(eventText, fixtures) {
  const text = foldName(eventText);
  if (text.length < 6) return null;
  const hits = fixtures.filter(fx => {
    const home = foldName(fx.home), away = foldName(fx.away);
    if (home.length < 3 || away.length < 3) return false;
    return text.includes(home) && text.includes(away);
  });
  return hits.length === 1 ? hits[0] : null;
}

/** Search SofaScore directly for one fixture. Used for a single bet rather
    than a sweep, where pulling a whole day would be wasteful. */
export async function searchEvent(eventText) {
  const q = String(eventText || '').replace(/\s+v(?:s|s\.)?\s+|\s+-\s+/i, ' ').trim();
  if (q.length < 4) return null;
  const body = await get('/search/all?q=' + encodeURIComponent(q) + '&page=0');
  const events = (body.results || [])
    .filter(r => r.type === 'event' && r.entity)
    .map(r => normalise(r.entity))
    .filter(Boolean);
  return findExact(eventText, events);
}

/** One cheap request, to report whether this host can reach SofaScore. */
export async function reachable() {
  try {
    const body = await get('/sport/football/scheduled-events/' +
      new Date().toISOString().slice(0, 10));
    return { ok: true, events: (body.events || []).length };
  } catch (err) {
    return { ok: false, why: err.blocked ? 'blocked (' + err.statusCode + ')' : err.message };
  }
}
