/* football-data.co.uk — the source that is not blocked.
 *
 * ESPN and SofaScore both refuse Vercel's IPs outright (403 from iad1), and
 * TheSportsDB's free key caps at three events a day. This one answers, and
 * it is the only one on the list that is a plain static file rather than an
 * endpoint behind a bot filter — which is exactly why it keeps answering.
 *
 * THE PART THAT MAKES IT USABLE FOR SETTLEMENT: league football has no extra
 * time. These files are league fixtures only, so the full-time score IS the
 * 90-minute score — provable, not inferred. Cup ties, which are the ones
 * that go to extra time, simply are not in here, so they never match and
 * stay pending. That is the right failure: a bet nobody graded is
 * recoverable, a bet graded on a 120-minute score is not.
 *
 * Two formats, because the site has two:
 *   mmz4281/<season>/<div>.csv  the main European divisions, with half-time
 *                               columns (FTHG/FTAG/HTHG/HTAG)
 *   new/<COUNTRY>.csv           everything else, one file per country,
 *                               calendar-year seasons, no half-time columns
 * The Nordic leagues this product is full of live in the second set.
 *
 * Updated a couple of times a week, and in practice yesterday's results are
 * there. So it settles reliably but not instantly — which is the honest
 * trade for being the source that actually responds.
 */
import { parseDelimited } from '../../src/js/csv.js';

const BASE = 'https://www.football-data.co.uk';

/* Main-format divisions. Kept short deliberately: each file is ~200KB and a
   sweep fetches all of them, so this is the set worth the bandwidth. */
const DIVISIONS = ['E0', 'E1', 'E2', 'E3', 'EC', 'SC0', 'SC1', 'D1', 'D2',
                   'I1', 'I2', 'SP1', 'SP2', 'F1', 'F2', 'N1', 'B1', 'P1', 'T1', 'G1'];

/* New-format countries. Nordic first — they are most of this product's
   fixture list and the reason this source is worth having at all. */
const COUNTRIES = ['SWE', 'NOR', 'DNK', 'FIN', 'IRL', 'POL', 'AUT', 'SWZ',
                   'ROU', 'USA', 'MEX', 'BRA', 'ARG', 'JPN', 'CHN'];

export function configured() { return process.env.RESULTS_PROVIDER !== 'off'; }

/* European seasons run August to May and are named by both years: 2526 is
   2025-26. Before August we are still in the season that started last year. */
export function seasonCode(when = new Date()) {
  const y = when.getUTCFullYear(), m = when.getUTCMonth();
  const start = m >= 7 ? y : y - 1;
  return String(start % 100).padStart(2, '0') + String((start + 1) % 100).padStart(2, '0');
}

const HEADERS = {
  'User-Agent': process.env.SCRAPE_UA ||
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
    '(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Accept': 'text/csv, text/plain, */*'
};

async function getCsv(url) {
  const res = await fetch(url, { headers: HEADERS });
  if (res.status === 403 || res.status === 429) {
    const err = new Error('football-data.co.uk refused the request (' + res.status + ').');
    err.statusCode = res.status;
    err.blocked = true;
    throw err;
  }
  if (res.status === 404) return null;      // season not started, or no such file
  if (!res.ok) throw new Error('football-data.co.uk returned ' + res.status + '.');
  return res.text();
}

/* dd/mm/yy or dd/mm/yyyy — the site uses both, sometimes in one file.
   Day-first throughout; reading it month-first would move a third of every
   result by months and settle bets against the wrong day. */
export function parseDate(value) {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/.exec(String(value || '').trim());
  if (!m) return null;
  let [, d, mo, y] = m;
  y = y.length === 2 ? 2000 + Number(y) : Number(y);
  const dt = new Date(Date.UTC(y, Number(mo) - 1, Number(d), 12));
  return Number.isNaN(dt.getTime()) ? null : dt;
}

const int = v => {
  const n = parseInt(String(v == null ? '' : v).trim(), 10);
  return Number.isFinite(n) ? n : undefined;
};

/**
 * Turn one CSV into fixtures inside the window.
 * @returns {object[]}
 */
export function parseFile(text, from, to, tag) {
  const rows = parseDelimited(text || '', ',');
  if (rows.length < 2) return [];
  const head = rows[0].map(h => String(h).replace(/^﻿/, '').trim());
  const at = name => head.indexOf(name);

  /* The two formats name the same things differently. */
  const iDate = at('Date');
  const iHome = at('HomeTeam') >= 0 ? at('HomeTeam') : at('Home');
  const iAway = at('AwayTeam') >= 0 ? at('AwayTeam') : at('Away');
  const iHg = at('FTHG') >= 0 ? at('FTHG') : at('HG');
  const iAg = at('FTAG') >= 0 ? at('FTAG') : at('AG');
  const iHth = at('HTHG'), iHta = at('HTAG');
  if (iDate < 0 || iHome < 0 || iAway < 0 || iHg < 0 || iAg < 0) return [];

  const out = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    const when = parseDate(row[iDate]);
    if (!when || when < from || when > to) continue;

    const hg = int(row[iHg]), ag = int(row[iAg]);
    /* A fixture with no score has not been played, or the file has a blank
       row. Either way there is nothing to settle against. */
    if (hg === undefined || ag === undefined) continue;

    const home = String(row[iHome] || '').trim();
    const away = String(row[iAway] || '').trim();
    if (!home || !away) continue;

    const fx = {
      id: tag + ':' + when.toISOString().slice(0, 10) + ':' + home + ' v ' + away,
      status: 'FT',
      home, away,
      hg, ag,
      /* League football does not go to extra time, so full time IS the
         90-minute score. This is the whole reason the source is usable. */
      ft90h: hg,
      ft90a: ag,
      kickoff: when.toISOString()
    };
    if (iHth >= 0 && iHta >= 0) {
      const hth = int(row[iHth]), hta = int(row[iHta]);
      if (hth !== undefined && hta !== undefined) { fx.hth = hth; fx.hta = hta; }
    }
    out.push(fx);
  }
  return out;
}

/** Finished fixtures across a date window. Dates are YYYY-MM-DD. */
export async function finishedBetween(dateFrom, dateTo) {
  const from = new Date(dateFrom + 'T00:00:00Z');
  const to = new Date(dateTo + 'T23:59:59Z');
  const season = seasonCode(to);
  const out = [];
  let reached = 0;

  const files = [
    ...DIVISIONS.map(d => [BASE + '/mmz4281/' + season + '/' + d + '.csv', d]),
    ...COUNTRIES.map(c => [BASE + '/new/' + c + '.csv', c])
  ];

  for (const [url, tag] of files) {
    try {
      const text = await getCsv(url);
      if (text === null) continue;           // no file for this season yet
      reached++;
      out.push(...parseFile(text, from, to, tag));
    } catch (err) {
      if (err.blocked && reached === 0 && out.length === 0) throw err;
      /* One unavailable file is not a reason to abandon the rest. */
    }
  }
  if (!reached) {
    const err = new Error('No football-data.co.uk file could be read.');
    err.blocked = true;
    throw err;
  }
  return out;
}

/** One cheap request, to report whether this host can reach the site. */
export async function reachable() {
  try {
    const text = await getCsv(BASE + '/new/SWE.csv');
    if (text === null) return { ok: false, why: 'file not found' };
    return { ok: true, rows: text.split('\n').length - 1 };
  } catch (err) {
    return { ok: false, why: err.blocked ? 'blocked (' + err.statusCode + ')' : err.message };
  }
}
