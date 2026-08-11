/* ESPN results provider.
 *
 * Modelled on what soccerdata (probberechts/soccerdata) does: don't depend
 * on one site, keep several scrapers behind one interface, and let whichever
 * is reachable answer. soccerdata itself is Python and cannot run in a Node
 * serverless function, so this borrows the approach rather than the code.
 *
 * ESPN earns first place among the scrapers because of `linescores`: each
 * competitor carries its score period by period, so a tie that went to extra
 * time still yields a provable 90-minute score. That is the number the
 * settlement rules are written against, and most feeds do not publish it.
 *
 * No key, no account, no quota. It is an undocumented endpoint behind
 * Akamai, and Akamai blocks by IP reputation — it refused this development
 * machine outright. Whether it answers a Vercel function is a question only
 * production can settle, which is what /api/sources exists to ask.
 */

const BASE = 'https://site.api.espn.com/apis/site/v2/sports/soccer';

/* The competitions worth sweeping. ESPN wants a slug per league and there
   is no "all football" endpoint, so this is the list that gets checked —
   the leagues this product's users actually bet on, Nordic included. */
export const LEAGUES = [
  'eng.1', 'eng.2', 'esp.1', 'ita.1', 'ger.1', 'fra.1', 'ned.1', 'por.1',
  'sco.1', 'usa.1', 'mex.1', 'bra.1', 'arg.1', 'tur.1', 'bel.1',
  'nor.1', 'swe.1', 'den.1', 'fin.1',
  'uefa.champions', 'uefa.europa', 'uefa.europa.conf',
  'eng.fa', 'eng.league_cup'
];

const HEADERS = {
  'User-Agent': process.env.SCRAPE_UA ||
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
    '(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'en-GB,en;q=0.9'
};

export function configured() { return process.env.RESULTS_PROVIDER !== 'off'; }

/* ESPN's status names, mapped onto what the engine understands. Anything
   unrecognised becomes UNKNOWN and never settles, because a wrong grade is
   worse than no grade. */
const STATUS = {
  STATUS_FULL_TIME: 'FT',
  STATUS_FINAL: 'FT',
  STATUS_FINAL_AET: 'AET',
  STATUS_FINAL_PEN: 'AET',
  STATUS_POSTPONED: 'POSTPONED',
  STATUS_CANCELED: 'CANCELLED',
  STATUS_CANCELLED: 'CANCELLED',
  STATUS_ABANDONED: 'ABANDONED',
  STATUS_SUSPENDED: 'ABANDONED',
  STATUS_FORFEIT: 'AWARDED',
  STATUS_SCHEDULED: 'SCHEDULED',
  STATUS_IN_PROGRESS: 'SCHEDULED',
  STATUS_HALFTIME: 'SCHEDULED',
  STATUS_FIRST_HALF: 'SCHEDULED',
  STATUS_SECOND_HALF: 'SCHEDULED'
};

const num = v => {
  const n = typeof v === 'string' ? parseInt(v, 10) : v;
  return typeof n === 'number' && Number.isFinite(n) ? n : undefined;
};

/**
 * Normalise one ESPN event into the fixture shape settlement.js accepts.
 * @returns {object|null}
 */
export function normalise(ev) {
  const comp = ev && ev.competitions && ev.competitions[0];
  if (!comp || !comp.competitors || comp.competitors.length < 2) return null;

  const home = comp.competitors.find(c => c.homeAway === 'home');
  const away = comp.competitors.find(c => c.homeAway === 'away');
  if (!home || !away) return null;

  const type = (comp.status && comp.status.type) || {};
  let status = STATUS[type.name] || 'UNKNOWN';
  /* `completed` is the reliable signal; the name occasionally lags. */
  if (status === 'SCHEDULED' && type.completed) status = 'FT';

  const name = c => (c.team && (c.team.shortDisplayName || c.team.displayName || c.team.name)) || '';
  const fixture = {
    id: String(ev.id),
    status,
    home: name(home),
    away: name(away),
    kickoff: ev.date
  };
  if (!fixture.home || !fixture.away) return null;

  const hg = num(home.score), ag = num(away.score);
  if (hg !== undefined && ag !== undefined) { fixture.hg = hg; fixture.ag = ag; }

  /* The whole reason ESPN leads the chain. linescores is per period:
     [first half, second half, extra time 1, extra time 2, penalties].
     The first two summed are the 90-minute score, provable rather than
     inferred, so an extra-time tie still settles correctly. */
  const periods = c => (c.linescores || []).map(l => num(l && l.value));
  const hp = periods(home), ap = periods(away);
  if (hp.length >= 2 && ap.length >= 2 &&
      hp[0] !== undefined && hp[1] !== undefined &&
      ap[0] !== undefined && ap[1] !== undefined) {
    fixture.hth = hp[0];
    fixture.hta = ap[0];
    if (status === 'FT' || status === 'AET') {
      fixture.ft90h = hp[0] + hp[1];
      fixture.ft90a = ap[0] + ap[1];
    }
  } else if (status === 'FT' && hg !== undefined && ag !== undefined) {
    /* Ended inside 90 with no period breakdown: full time IS 90 minutes. */
    fixture.ft90h = hg;
    fixture.ft90a = ag;
  }
  /* An AET tie with no period detail deliberately leaves ft90 undefined,
     so the engine asks rather than settling on a score including extra
     time. That is the single rule this whole file exists to protect. */
  return fixture;
}

async function get(url) {
  const res = await fetch(url, { headers: HEADERS });
  if (res.status === 403 || res.status === 429) {
    const err = new Error('ESPN refused the request (' + res.status + ').');
    err.statusCode = res.status;
    err.blocked = true;
    throw err;
  }
  if (!res.ok) {
    const err = new Error('ESPN returned ' + res.status + '.');
    err.statusCode = 502;
    throw err;
  }
  return res.json();
}

/** Finished fixtures across a date window. Dates are YYYY-MM-DD. */
export async function finishedBetween(dateFrom, dateTo) {
  const range = dateFrom.replace(/-/g, '') + '-' + dateTo.replace(/-/g, '');
  const out = [];
  let blocked = 0, ok = 0;

  /* One request per league, sequential. ESPN has no combined endpoint, and
     firing 24 requests at once is the kind of thing that earns a block. */
  for (const league of LEAGUES) {
    try {
      const body = await get(BASE + '/' + league + '/scoreboard?dates=' + range + '&limit=200');
      ok++;
      for (const ev of body.events || []) {
        const fx = normalise(ev);
        if (fx && fx.status !== 'SCHEDULED' && fx.status !== 'UNKNOWN') out.push(fx);
      }
    } catch (err) {
      if (err.blocked) {
        blocked++;
        /* If the first few are all refused it is the IP, not the league.
           Give up rather than making 24 requests to a wall. */
        if (blocked >= 3 && ok === 0) throw err;
      }
      /* A single league being unavailable is not a reason to abandon the
         rest — the bet is probably in one of the others. */
    }
  }
  if (!ok) {
    const err = new Error('No ESPN competition could be reached.');
    err.blocked = true;
    throw err;
  }
  return out;
}

/** One cheap request, to report whether this host can reach ESPN at all. */
export async function reachable() {
  try {
    const body = await get(BASE + '/eng.1/scoreboard');
    return { ok: true, events: (body.events || []).length };
  } catch (err) {
    return { ok: false, why: err.blocked ? 'blocked (' + err.statusCode + ')' : err.message };
  }
}
