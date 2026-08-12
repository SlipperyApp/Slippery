/* Results feed adapter.
 *
 * The settlement engine takes a fixture shaped like
 *   { status, home, away, hg, ag, hth, hta, ft90h, ft90a }
 * and nothing else. Every feed is normalised to that shape here, so swapping
 * provider is a config change rather than a rewrite of the grader.
 *
 * football-data.org free tier to start (10 requests/minute, one competition
 * set). API-Football is the paid upgrade and implements the same interface.
 *
 * THE IMPORTANT PART: football-data.org reports `fullTime` INCLUDING extra
 * time on knockout ties. The engine settles on 90 minutes only, so the
 * 90-minute score is reported separately and left undefined when the feed
 * cannot prove it, which makes the engine ask instead of settling on a score
 * that includes extra time. That is the single most valuable line in here.
 */
import * as net from './net.js';


/* Always true: the scrapers need no key, so a deployment with nothing
   configured still settles bets. Whether a given host can reach them is a
   separate question, and the answer is /api/sources. */
export function configured() { return true; }

/* Static imports, deliberately.
 *
 * These were `await import(source.module)` with the path in a variable, and
 * Vercel's file tracer only follows literal specifiers, so espn.js was
 * never bundled and production answered
 *   Cannot find module '/var/task/api/_lib/espn.js'
 * while sofascore.js worked, because one line elsewhere imported it by
 * literal. A dynamic import with a computed path is invisible to the
 * bundler. Import them at the top and hold the modules in the table. */
import * as espn from './espn.js';
import * as sofascore from './sofascore.js';
import * as footballdata from './footballdata.js';
import * as footballdatauk from './footballdatauk.js';
import * as flashscore from './flashscore.js';

/* The scraper chain, in order of preference.
 *
 * The approach is soccerdata's (probberechts/soccerdata): never depend on
 * one site, keep several scrapers behind one interface, and let whichever is
 * reachable answer. soccerdata is Python and cannot run in a Node function,
 * so this borrows the shape, not the code.
 *
 * ORDER IS BY WHAT ANSWERS FROM A DATACENTER IP, THEN BY DATA QUALITY, AND
 * THAT IS A CHANGE. It used to be quality alone, which put ESPN and
 * SofaScore first because both can prove a 90-minute score from period
 * detail. Both refuse a serverless IP with a 403, verified live against the
 * deployment, so every single settlement run spent its first two round
 * trips being told no before reaching a source that works. Under a ten
 * second function ceiling that is not merely wasteful, it is the difference
 * between finishing the chain and being killed part way through it.
 *
 * FlashScore leads because it satisfies both tests at once: it answers from
 * a datacenter IP, because the feed is the one its own front end reads
 * rather than a page behind a bot filter, AND it publishes period scores,
 * so it can prove 90 minutes on a tie that went to extra time. It is also
 * the only source with tennis. It is the right primary on merit; it was
 * third by accident of history.
 *
 * ESPN and SofaScore stay in the chain rather than being deleted. They are
 * blocked by IP reputation, not by policy, and that changes: a different
 * region or a proxy makes them reachable again, and they are the highest
 * quality sources when they are. The circuit breaker below means being
 * blocked costs one request every five minutes instead of one per run.
 *
 * RESULTS_PROVIDER pins one source by name when you want to. */
/* How far back to widen when a bet went unmatched. A week covers the usual
   cause, which is a fixture that settled outside the day the sweep asked
   for. FlashScore serves at most six days per pull, so this is the
   practical ceiling too. */
const LOOKBACK_DAYS = 6;

const pinned = () => (process.env.RESULTS_PROVIDER || '').trim().toLowerCase();
const wanted = name => { const p = pinned(); return !p || p === 'off' ? p !== 'off' : p === name; };

const SOURCES = [
  /* Answers from a datacenter IP and publishes period scores, so it can
     prove a 90-minute score. Cup ties come back with a status the engine
     does not recognise, on purpose: the feed cannot prove 90 minutes on
     them and a bet graded on 120 is not recoverable. */
  { name: 'flashscore', mod: flashscore, enabled: () => wanted('flashscore') },
  /* Also answers, because it is a static CSV rather than an endpoint behind
     a bot filter. League fixtures only, so full time IS 90 minutes; cup
     ties are absent and stay pending, which is the right failure. */
  { name: 'football-data-uk', mod: footballdatauk, enabled: () => wanted('football-data-uk') },
  /* Highest quality of the five when reachable: per-period linescores. */
  { name: 'espn',      mod: espn,      enabled: () => wanted('espn') },
  { name: 'sofascore', mod: sofascore, enabled: () => wanted('sofascore') },
  /* Last, and mostly returns "ask": the free tier reports fullTime
     INCLUDING extra time and cannot break out 90 minutes. */
  { name: 'football-data', mod: footballdata,
    enabled: () => wanted('football-data') && Boolean(process.env.FOOTBALL_DATA_TOKEN),
    acceptEmpty: true }
];

/* Tennis has one source, because only one of these has tennis at all.
   Kept separate from the football chain rather than folded into it: they
   answer different questions and a football fixture list is not a fallback
   for a tennis one. */
const TENNIS_SOURCES = [
  { name: 'flashscore', mod: flashscore, enabled: () => wanted('flashscore') }
];

/**
 * Fetch finished fixtures from whichever provider is configured.
 *
 * SofaScore first when asked for, because it publishes the 90-minute score
 * on knockout ties and football-data.org does not. But it sits behind a bot
 * filter that refuses datacenter IPs, which is what a serverless function
 * has, so a 403 falls back to football-data.org rather than returning an
 * empty day and leaving every bet pending. Falling back is the difference
 * between "settled a bit later than ideal" and "silently stopped settling".
 */
export async function resolveFinished(dateFrom, dateTo) {
  const tried = [];
  for (const source of SOURCES) {
    if (!source.enabled()) continue;
    /* Skip a host that refused us minutes ago. Two of the five refuse a
       serverless IP permanently, and re-asking them on every run spent two
       round trips of a ten second budget to be told 403 twice. */
    if (net.isBlocked(source.name)) { tried.push(source.name + ': blocked (cached)'); continue; }
    try {
      const fixtures = await source.mod.finishedBetween(dateFrom, dateTo);
      if (fixtures.length || source.acceptEmpty) {
        return { provider: source.name, fixtures, tried };
      }
      tried.push(source.name + ': no fixtures');
    } catch (err) {
      /* Blocked is the expected failure, these are scrapers and they are
         blocked by IP reputation, which differs per host. Record it and try
         the next one rather than giving up on settlement entirely.

         Only a `blocked` failure opens the breaker. A timeout is not
         evidence the host refuses us, and treating one slow response as a
         refusal would take a working source out for five minutes. */
      if (err.blocked) net.markBlocked(source.name);
      tried.push(source.name + ': ' +
        (err.blocked ? 'blocked' : err.timedOut ? 'timed out' : err.message));
    }
  }
  const err = new Error('No results source could be reached (' + tried.join('; ') + ').');
  err.statusCode = 503;
  err.tried = tried;
  err.blocked = tried.every(t => /blocked/.test(t));
  throw err;
}

/**
 * Finished tennis across a window.
 *
 * Separate from resolveFinished because the shapes are different: a tennis
 * fixture carries sets rather than goals, and the engine grades it with
 * different rules. Returning an empty list rather than throwing when nothing
 * is reachable is deliberate here, a user with no tennis bets should not see
 * a settlement failure because a tennis feed was down.
 */
export async function resolveTennis(dateFrom, dateTo) {
  const tried = [];
  for (const source of TENNIS_SOURCES) {
    if (!source.enabled()) continue;
    if (net.isBlocked(source.name)) { tried.push(source.name + ': blocked (cached)'); continue; }
    try {
      const fixtures = await source.mod.finishedTennis(dateFrom, dateTo);
      if (fixtures.length) return { provider: source.name, fixtures, tried };
      tried.push(source.name + ': no fixtures');
    } catch (err) {
      if (err.blocked) net.markBlocked(source.name);
      tried.push(source.name + ': ' +
        (err.blocked ? 'blocked' : err.timedOut ? 'timed out' : err.message));
    }
  }
  return { provider: null, fixtures: [], tried };
}

/* Ask every source whether this host can reach it. Diagnostics only.
 *
 * Deliberately ignores the circuit breaker and asks for real. The breaker
 * is an optimisation for the settlement path; this endpoint exists to
 * answer "what can production reach RIGHT NOW", and consulting a cache
 * would make it report its own memory instead. Probed in parallel, because
 * five sequential timeouts is longer than the function lives. */
export async function probeSources() {
  const results = await Promise.all(SOURCES.map(async source => {
    if (!source.enabled()) return { name: source.name, ok: false, why: 'not configured' };
    try {
      return Object.assign({ name: source.name }, await source.mod.reachable());
    } catch (err) {
      return { name: source.name, ok: false, why: err.message };
    }
  }));
  return results;
}

/**
 * Look up single fixtures by name, for bets the day sweep did not match.
 *
 * A sweep only sees the days it pulled and the competitions the provider
 * lists there. A bet on something outside that window would otherwise stay
 * pending forever, which looks identical to "still running" and is the more
 * annoying of the two failures. Capped, because this is one request each.
 *
 * @param {string[]} eventTexts the `event` field of each unmatched bet
 * @returns {Promise<Map<string, object>>} eventText -> fixture
 */
export async function lookupEach(eventTexts, cap = 8, dateFrom, dateTo) {
  const found = new Map();
  if (!eventTexts.length) return found;

  /* PATH ONE: SofaScore's search endpoint, which is exact and per bet.
     Only worth trying if it is reachable, and it usually is not from a
     serverless IP. Skipped entirely when the breaker knows it is blocked,
     so the common case costs nothing. */
  const canSearch = (!pinned() || pinned() === 'sofascore') && !net.isBlocked('sofascore');
  if (canSearch) {
    for (const text of eventTexts.slice(0, cap)) {
      try {
        const fx = await sofascore.searchEvent(text);
        if (fx) found.set(text, fx);
      } catch (err) {
        /* One blocked or malformed lookup must not abandon the rest, and
           must not fail the whole settle: the sweep's matches are good. */
        if (err.blocked) { net.markBlocked('sofascore'); break; }
      }
    }
    if (found.size === eventTexts.length) return found;
  }

  /* PATH TWO: widen the window on whatever source does answer.
   *
   * This is the half that was missing, and its absence was a silent hole
   * rather than a visible failure. lookupEach only ever went through
   * SofaScore's search, SofaScore is 403 from a serverless IP, so in
   * production this function returned an empty map every time. A bet the
   * day sweep did not cover stayed pending forever, which on screen is
   * indistinguishable from "still running" and is the more annoying of the
   * two failures.
   *
   * One widened pull rather than one request per bet: the day feeds are
   * cheap and shared, so ten unmatched bets cost the same as one. The
   * window reaches a week back, because the reason a bet went unmatched is
   * usually that it settled outside the day the sweep asked for.
   */
  if (!dateFrom) return found;
  const outstanding = eventTexts.filter(t => !found.has(t));
  if (!outstanding.length) return found;

  const from = new Date(dateFrom + 'T00:00:00Z');
  from.setUTCDate(from.getUTCDate() - LOOKBACK_DAYS);
  const wideFrom = from.toISOString().slice(0, 10);
  const wideTo = dateTo || dateFrom;

  try {
    const { fixtures } = await resolveFinished(wideFrom, wideTo);
    for (const text of outstanding) {
      const fx = matchFixture(text, fixtures);
      /* matchFixture returns null unless exactly one fixture matches, so an
         ambiguous name settles nothing rather than settling wrongly. */
      if (fx) found.set(text, fx);
    }
  } catch {
    /* Nothing reachable. The sweep's own matches stand and the rest stay
       pending, which is the honest outcome. */
  }
  return found;
}

/* Match a stored bet to a fixture by team names. The engine already has
   tolerant team matching for selections; this is the coarser job of pairing a
   bet's event string against a day's fixtures. Deliberately conservative: an
   unmatched bet stays pending, which is recoverable. A WRONGLY matched bet is
   graded against another game's score, which is not. */

/* Fold the letters that do not decompose under NFD. Slips are typed or
   OCR'd in ASCII ("BODO GLIMT") while the feed uses the real spelling
   ("Bodø/Glimt"); without this the two never match and every Norwegian,
   Danish and Icelandic fixture silently stays pending. NFD alone does not
   fix it, ø, æ, å and ð are distinct letters, not accented vowels. */
const NON_DECOMPOSING = { 'ø': 'o', 'æ': 'ae', 'å': 'a', 'ð': 'd', 'þ': 'th', 'ł': 'l', 'đ': 'd', 'ı': 'i', 'ß': 'ss' };

export function foldName(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')   // é -> e, ö -> o
    .replace(/[øæåðþłđıß]/g, ch => NON_DECOMPOSING[ch] || ch)
    .replace(/\b(fc|afc|cf|sk|if|ff|bk|sc|ac|as|us|ss|club|team|women|w)\b/g, '')
    .replace(/[^a-z0-9]/g, '');
}

export function matchFixture(eventText, fixtures) {
  const norm = foldName;
  const text = norm(eventText);
  if (text.length < 6) return null;

  const hits = fixtures.filter(fx => {
    const home = norm(fx.home), away = norm(fx.away);
    if (home.length < 3 || away.length < 3) return false;
    return text.includes(home) && text.includes(away);
  });
  /* Exactly one candidate, or we do not settle. */
  return hits.length === 1 ? hits[0] : null;
}
