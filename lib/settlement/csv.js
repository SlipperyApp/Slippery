/* CSV import.
 *
 * Anyone arriving with a betting history has it as a spreadsheet export,
 * and every bookmaker and tracker names its columns differently. This maps
 * whatever it is given onto the one bet shape, and, the important part,
 * reports what it could not map rather than silently dropping rows.
 *
 * The rule from the settlement engine applies here too: a wrong figure is
 * worse than no figure. A row missing a stake is rejected with its line
 * number, not imported as £0.
 *
 * Pure: no DOM, no network, no globals. It is the only way to test a parser
 * against the hundred awkward files it will actually meet.
 */

/* Column aliases, lowercased and stripped of punctuation before matching.
   Drawn from what bet365, Betfair, Smarkets, Oddsmonkey, ProfitAccumulator
   and a plain Excel sheet actually call these things. */
const ALIASES = {
  date:      ['date', 'placed', 'placedat', 'datetime', 'timestamp', 'dateplaced', 'settleddate', 'day'],
  event:     ['event', 'match', 'fixture', 'game', 'eventname', 'description', 'details'],
  selection: ['selection', 'bet', 'pick', 'runner', 'outcome', 'betdescription', 'yourbet'],
  market:    ['market', 'markettype', 'bettype', 'type'],
  book:      ['bookmaker', 'book', 'bookie', 'operator', 'site', 'exchange', 'sportsbook'],
  odds:      ['odds', 'price', 'decimalodds', 'oddsdecimal', 'avgodds', 'averageodds'],
  stake:     ['stake', 'staked', 'amount', 'risk', 'wager', 'betamount', 'stakeamount'],
  profit:    ['profit', 'pl', 'profitloss', 'netprofit', 'net', 'result', 'won', 'winloss', 'pandl'],
  returns:   ['returns', 'return', 'payout', 'returned', 'totalreturn', 'grossreturn'],
  status:    ['status', 'settled', 'state', 'betstatus']
};

const norm = h => String(h || '').toLowerCase().replace(/[^a-z0-9]/g, '');

/* ---------- the parser ----------
   Hand-written rather than a dependency, because the only hard parts are
   quoted fields containing commas, doubled quotes inside them, and CRLF,
   and every real export has all three. */
export function parseDelimited(text, delimiter) {
  const rows = [];
  let row = [], field = '', quoted = false, i = 0;
  const src = String(text || '').replace(/^﻿/, '');   // Excel writes a BOM

  while (i < src.length) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') { field += '"'; i += 2; continue; }   // "" is a literal quote
        quoted = false; i++; continue;
      }
      field += ch; i++; continue;
    }
    if (ch === '"') { quoted = true; i++; continue; }
    if (ch === delimiter) { row.push(field); field = ''; i++; continue; }
    if (ch === '\r') { i++; continue; }
    if (ch === '\n') { row.push(field); rows.push(row); row = []; field = ''; i++; continue; }
    field += ch; i++;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows.filter(r => r.some(c => c.trim() !== ''));
}

/** Guess the delimiter from the header line. Tabs and semicolons are as
    common as commas, a European Excel export uses semicolons. */
export function sniffDelimiter(text) {
  const first = String(text || '').split(/\r?\n/)[0] || '';
  const counts = [[',', 0], [';', 0], ['\t', 0], ['|', 0]];
  let quoted = false;
  for (const ch of first) {
    if (ch === '"') { quoted = !quoted; continue; }
    if (quoted) continue;
    const hit = counts.find(c => c[0] === ch);
    if (hit) hit[1]++;
  }
  counts.sort((a, b) => b[1] - a[1]);
  return counts[0][1] > 0 ? counts[0][0] : ',';
}

/* ---------- value coercion ---------- */

/** Money to integer pence. Handles "£1,234.56", "(12.50)" for negatives,
    "1.234,56" where the comma is the decimal separator, and a bare "-". */
export function toPence(raw) {
  if (raw == null) return null;
  let s = String(raw).trim();
  if (!s || s === '-' || s === '—' || s === 'n/a') return null;

  let negative = false;
  if (/^\(.*\)$/.test(s)) { negative = true; s = s.slice(1, -1); }    // accountancy negatives
  s = s.replace(/[£$€\s]/g, '');
  if (s.startsWith('-') || s.startsWith('−')) { negative = true; s = s.slice(1); }

  /* Decide which separator is the decimal point. If both appear, the last
     one wins; if only commas appear and they are not in thousands groups,
     the comma is a decimal point. */
  const lastComma = s.lastIndexOf(','), lastDot = s.lastIndexOf('.');
  if (lastComma > -1 && lastDot > -1) {
    s = lastComma > lastDot ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  } else if (lastComma > -1) {
    s = /,\d{3}(\D|$)/.test(s) ? s.replace(/,/g, '') : s.replace(',', '.');
  }

  if (!/^\d*\.?\d*$/.test(s) || s === '' || s === '.') return null;
  const pence = Math.round(parseFloat(s) * 100);
  if (!Number.isFinite(pence)) return null;
  return negative ? -pence : pence;
}

/** Decimal odds. Accepts "5/2" and "evens" as well as "3.50". */
export function toOdds(raw) {
  if (raw == null) return null;
  const s = String(raw).trim().toLowerCase();
  if (!s) return null;
  if (s === 'evs' || s === 'evens' || s === 'even') return 2;
  const frac = s.match(/^(\d+(?:\.\d+)?)\s*[/-]\s*(\d+(?:\.\d+)?)$/);
  if (frac) {
    const d = parseFloat(frac[2]);
    if (!d) return null;
    return +(parseFloat(frac[1]) / d + 1).toFixed(4);
  }
  const n = parseFloat(s.replace(/[^\d.]/g, ''));
  if (!Number.isFinite(n) || n <= 1) return null;
  return n;
}

/** A date, tolerant of the orders people actually write.
    Ambiguous d/m vs m/d is resolved as day-first: this is a UK product, and
    guessing American would silently move a third of every import. */
export function toDate(raw) {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s) return null;

  const dmy = s.match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2,4})/);
  if (dmy) {
    let [, d, m, y] = dmy;
    y = y.length === 2 ? '20' + y : y;
    const dt = new Date(Date.UTC(+y, +m - 1, +d, 12));
    return Number.isNaN(dt.getTime()) ? null : dt.toISOString();
  }
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) {
    const dt = new Date(s.length > 10 ? s : s + 'T12:00:00Z');
    return Number.isNaN(dt.getTime()) ? null : dt.toISOString();
  }
  const dt = new Date(s);
  return Number.isNaN(dt.getTime()) ? null : dt.toISOString();
}

/* An explicit outcome column, where one exists. Anything unrecognised is
   left null so the bet imports as unsettled rather than as a guess. */
export function toOutcome(raw) {
  const s = String(raw == null ? '' : raw).trim().toLowerCase();
  if (!s) return null;
  if (/^(w|won|win|winner|success)/.test(s)) return 'won';
  if (/^(l|lost|lose|loss|failed)/.test(s)) return 'lost';
  if (/^(v|void|push|cancelled|canceled|refund)/.test(s)) return 'void';
  if (/cash/.test(s)) return 'cash';
  return null;
}

/* ---------- the mapping ---------- */

/** Match the file's headers onto our fields. Returns {field: columnIndex}. */
export function mapHeaders(headers) {
  const map = {};
  headers.forEach((h, i) => {
    const n = norm(h);
    for (const field of Object.keys(ALIASES)) {
      if (map[field] === undefined && ALIASES[field].includes(n)) { map[field] = i; return; }
    }
  });
  return map;
}

/**
 * Turn a CSV/TSV export into bets ready for POST /api/bets.
 * @returns {{bets: object[], errors: {line:number, why:string}[], mapped: string[], skipped:number}}
 */
export function parseBetsCsv(text) {
  const delimiter = sniffDelimiter(text);
  const rows = parseDelimited(text, delimiter);
  if (rows.length < 2) {
    return { bets: [], errors: [{ line: 1, why: 'That file has no rows under its header.' }],
             mapped: [], skipped: 0 };
  }
  const headers = rows[0];
  const map = mapHeaders(headers);

  /* Without a stake column there is nothing to import: every figure the app
     computes is stake-weighted, and inventing one would corrupt the ROI of
     every period it touches. */
  if (map.stake === undefined) {
    return { bets: [], mapped: Object.keys(map), skipped: rows.length - 1,
             errors: [{ line: 1, why: 'No stake column found. Headers seen: ' +
               headers.filter(Boolean).join(', ') }] };
  }

  const bets = [], errors = [];
  const cell = (row, key) => (map[key] === undefined ? '' : (row[map[key]] || '').trim());

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    const line = r + 1;
    const stake = toPence(cell(row, 'stake'));
    if (stake == null || stake <= 0) { errors.push({ line, why: 'No usable stake' }); continue; }

    const selection = cell(row, 'selection') || cell(row, 'event');
    if (!selection) { errors.push({ line, why: 'No selection or event' }); continue; }

    const odds = toOdds(cell(row, 'odds'));
    /* Profit may be given directly, or derived from returns. Returns minus
       stake is the definition, so both routes give the same pence. */
    let profit = toPence(cell(row, 'profit'));
    if (profit == null) {
      const returns = toPence(cell(row, 'returns'));
      if (returns != null) profit = returns - stake;
    }
    const outcome = toOutcome(cell(row, 'status')) ||
      (profit == null ? null : profit > 0 ? 'won' : profit < 0 ? 'lost' : 'void');

    bets.push({
      event: cell(row, 'event') || selection,
      selection,
      market: cell(row, 'market') || '',
      book: cell(row, 'book') || '',
      odds,
      stakePence: stake,
      profitPence: profit,
      outcome,
      placedAt: toDate(cell(row, 'date')),
      source: 'import'
    });
  }
  return { bets, errors, mapped: Object.keys(map), skipped: errors.length };
}
