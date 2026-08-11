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
 * cannot prove it — which makes the engine ask instead of settling on a score
 * that includes extra time. That is the single most valuable line in here.
 */

const FD_BASE = 'https://api.football-data.org/v4';

export function configured() {
  return Boolean(process.env.FOOTBALL_DATA_TOKEN);
}

/** Map a football-data.org status onto what the engine understands. */
function mapStatus(fd) {
  switch (fd) {
    case 'FINISHED':  return 'FT';
    case 'AWARDED':   return 'AWARDED';
    case 'POSTPONED': return 'POSTPONED';
    case 'CANCELLED': return 'CANCELLED';
    case 'SUSPENDED': return 'SUSPENDED';
    case 'IN_PLAY':
    case 'PAUSED':
    case 'TIMED':
    case 'SCHEDULED': return 'SCHEDULED';
    default:          return String(fd || 'UNKNOWN');
  }
}

/**
 * Normalise one football-data.org match.
 * @returns fixture in engine shape, or null if unusable
 */
export function normalise(match) {
  if (!match || !match.score) return null;
  const score = match.score;
  const ft = score.fullTime || {};
  const ht = score.halfTime || {};
  const status = mapStatus(match.status);

  const fixture = {
    id: String(match.id),
    status,
    home: match.homeTeam && (match.homeTeam.shortName || match.homeTeam.name),
    away: match.awayTeam && (match.awayTeam.shortName || match.awayTeam.name),
    kickoff: match.utcDate
  };

  if (typeof ft.home === 'number' && typeof ft.away === 'number') {
    fixture.hg = ft.home;
    fixture.ag = ft.away;
  }
  if (typeof ht.home === 'number' && typeof ht.away === 'number') {
    fixture.hth = ht.home;
    fixture.hta = ht.away;
  }

  /* Extra time and penalties.
     football-data.org's `fullTime` on a knockout tie is the score AFTER extra
     time, and `regularTime` is not on the free tier. So when the match went
     beyond 90 minutes we mark it AET and deliberately do NOT supply ft90h /
     ft90a — the engine then returns {status:'ask'} rather than settling a
     "90 minutes only" market on a score that includes extra time.
     Do not be tempted to derive a 90-minute score from halfTime; it is only
     the first half. */
  const wentToExtraTime =
    (score.duration && score.duration !== 'REGULAR') ||
    score.extraTime && typeof score.extraTime.home === 'number' ||
    score.penalties && typeof score.penalties.home === 'number';

  if (status === 'FT' && wentToExtraTime) {
    fixture.status = 'AET';
    if (score.regularTime && typeof score.regularTime.home === 'number' &&
        typeof score.regularTime.away === 'number') {
      /* Present on paid tiers. When we have it, 90-minute settlement is
         provable and the engine can grade normally. */
      fixture.ft90h = score.regularTime.home;
      fixture.ft90a = score.regularTime.away;
    }
  }
  return fixture;
}

/** Fetch finished matches in a date window. Dates are YYYY-MM-DD. */
export async function finishedBetween(dateFrom, dateTo) {
  if (!configured()) {
    const err = new Error('No results feed is configured.');
    err.statusCode = 503;
    throw err;
  }
  const url = FD_BASE + '/matches?dateFrom=' + dateFrom + '&dateTo=' + dateTo;
  const res = await fetch(url, { headers: { 'X-Auth-Token': process.env.FOOTBALL_DATA_TOKEN } });
  if (res.status === 429) {
    const err = new Error('The results feed is rate limiting us. Try again shortly.');
    err.statusCode = 429;
    throw err;
  }
  if (!res.ok) {
    const err = new Error('The results feed returned ' + res.status + '.');
    err.statusCode = 502;
    throw err;
  }
  const body = await res.json();
  return (body.matches || []).map(normalise).filter(Boolean);
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
   fix it — ø, æ, å and ð are distinct letters, not accented vowels. */
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
