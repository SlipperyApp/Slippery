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

/* The scraper chain, in order of preference.
 *
 * The approach is soccerdata's (probberechts/soccerdata): never depend on
 * one site, keep several scrapers behind one interface, and let whichever is
 * reachable answer. soccerdata is Python and cannot run in a Node function,
 * so this borrows the shape, not the code.
 *
 * Order is by data quality, and quality here means one thing: can it prove
 * the 90-minute score on a tie that went to extra time? ESPN can, from its
 * per-period linescores. SofaScore can, from normaltime. football-data.org's
 * free tier cannot, and so it sits last and mostly returns "ask".
 *
 * All of these are blocked by IP reputation rather than by policy, and each
 * host gets a different answer, ESPN and SofaScore both refuse this
 * development machine. That is precisely why it is a chain and why
 * /api/sources exists: production can be asked directly.
 *
 * RESULTS_PROVIDER pins one source by name when you want to. */
const pinned = () => (process.env.RESULTS_PROVIDER || '').trim().toLowerCase();
const wanted = name => { const p = pinned(); return !p || p === 'off' ? p !== 'off' : p === name; };

const SOURCES = [
  { name: 'espn',      mod: espn,      enabled: () => wanted('espn') },
  { name: 'sofascore', mod: sofascore, enabled: () => wanted('sofascore') },
  /* The one that actually answers from a datacenter IP, because it is a
     static file rather than an endpoint behind a bot filter. League
     fixtures only, so full time IS 90 minutes; cup ties are absent and
     stay pending, which is the right failure. */
  { name: 'football-data-uk', mod: footballdatauk, enabled: () => wanted('football-data-uk') },
  { name: 'football-data', mod: footballdata,
    enabled: () => wanted('football-data') && Boolean(process.env.FOOTBALL_DATA_TOKEN),
    acceptEmpty: true }
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
    try {
      const fixtures = await source.mod.finishedBetween(dateFrom, dateTo);
      if (fixtures.length || source.acceptEmpty) {
        return { provider: source.name, fixtures, tried };
      }
      tried.push(source.name + ': no fixtures');
    } catch (err) {
      /* Blocked is the expected failure, these are scrapers and they are
         blocked by IP reputation, which differs per host. Record it and try
         the next one rather than giving up on settlement entirely. */
      tried.push(source.name + ': ' + (err.blocked ? 'blocked' : err.message));
    }
  }
  const err = new Error('No results source could be reached (' + tried.join('; ') + ').');
  err.statusCode = 503;
  err.tried = tried;
  err.blocked = tried.every(t => /blocked/.test(t));
  throw err;
}

/** Ask every source whether this host can reach it. Diagnostics only. */
export async function probeSources() {
  const out = [];
  for (const source of SOURCES) {
    if (!source.enabled()) { out.push({ name: source.name, ok: false, why: 'not configured' }); continue; }
    try {
      out.push(Object.assign({ name: source.name }, await source.mod.reachable()));
    } catch (err) {
      out.push({ name: source.name, ok: false, why: err.message });
    }
  }
  return out;
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
export async function lookupEach(eventTexts, cap = 8) {
  const found = new Map();
  /* Only SofaScore has a search endpoint. If it is pinned off or blocked
     this quietly returns nothing and the sweep's own matches stand. */
  if (pinned() && pinned() !== 'sofascore') return found;

  for (const text of eventTexts.slice(0, cap)) {
    try {
      const fx = await sofascore.searchEvent(text);
      if (fx) found.set(text, fx);
    } catch (err) {
      /* One blocked or malformed lookup must not abandon the rest, and must
         not fail the whole settle: the sweep's matches are already good. */
      if (err.blocked) break;
    }
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
