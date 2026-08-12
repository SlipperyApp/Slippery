/* football-data.org, the last link in the chain.
 *
 * It is the only source here with an API key and a published contract, which
 * makes it the reliable one, but its free tier reports `fullTime` INCLUDING
 * extra time and does not expose a regular-time score. So on any tie that
 * went past 90 minutes it can only tell the engine to ask. That is why it
 * sits behind the scrapers rather than in front of them.
 */
const FD_BASE = 'https://api.football-data.org/v4';

export function configured() { return Boolean(process.env.FOOTBALL_DATA_TOKEN); }

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
     ft90a, the engine then returns {status:'ask'} rather than settling a
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


/** One cheap request, to report whether this host can reach the API. */
export async function reachable() {
  if (!configured()) return { ok: false, why: 'FOOTBALL_DATA_TOKEN not set' };
  try {
    const res = await fetch(FD_BASE + '/competitions/PL', {
      headers: { 'X-Auth-Token': process.env.FOOTBALL_DATA_TOKEN }
    });
    return res.ok ? { ok: true } : { ok: false, why: 'returned ' + res.status };
  } catch (err) {
    return { ok: false, why: err.message };
  }
}
