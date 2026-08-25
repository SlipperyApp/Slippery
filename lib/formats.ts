/* 11 · FORMATS AND LOCALE.
 *
 * Pure, and shared by the render layer, the API and the tests, so a figure
 * cannot be formatted one way on the dashboard and another in an export.
 */

/* ── CURRENCY ──────────────────────────────────────────────────────────────
 * "Irish" appears nine times on the marketing site and the euro symbol
 * appeared zero times in the product. One currency per account, never summed
 * across: adding £ and € into one Net is not a number of anything.
 */
export type Currency = 'GBP' | 'EUR';
export const CURRENCY_SYMBOL: Record<Currency, string> = { GBP: '£', EUR: '€' };
export const CURRENCY_LOCALE: Record<Currency, string> = { GBP: 'en-GB', EUR: 'en-IE' };

/* Money is ALWAYS two decimals, totals included. A £25 beside a £25.00 in the
   same column is the most common way a figure column stops lining up. */
export function money(pence: number, currency: Currency = 'GBP', signed = false): string {
  const n = Math.abs(pence) / 100;
  const body = CURRENCY_SYMBOL[currency]
    + n.toLocaleString(CURRENCY_LOCALE[currency], { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (!signed) return body;
  /* A minus sign, U+2212, not a hyphen: at tabular widths a hyphen is too
     short to read as negative. */
  return (pence > 0 ? '+' : pence < 0 ? '−' : '') + body;
}

/* ── UNITS ─────────────────────────────────────────────────────────────────
 * Two decimals everywhere, with one exception the brief is explicit about:
 * every league surface uses one, because a column of 2dp units is unreadable
 * and a league is a comparison rather than a record.
 */
export function units(u: number, place: 'record' | 'league' = 'record'): string {
  const dp = place === 'league' ? 1 : 2;
  return (u > 0 ? '+' : u < 0 ? '−' : '') + Math.abs(u).toFixed(dp) + 'u';
}

export const percent = (p: number): string =>
  (p > 0 ? '+' : p < 0 ? '−' : '') + Math.abs(p).toFixed(1) + '%';

/* Chart axis labels and in-chart annotations round to nothing. They are
   labels, not figures, and £1,184.00 on an axis is unreadable at 10px. */
export function axisLabel(pence: number, currency: Currency = 'GBP'): string {
  const n = Math.abs(pence) / 100;
  const sign = pence < 0 ? '−' : '';
  const s = CURRENCY_SYMBOL[currency];
  if (n >= 1000) return sign + s + (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
  return sign + s + Math.round(n);
}

/* ── DATES ─────────────────────────────────────────────────────────────────
 * The product held three formats: "12 Aug" 44 times, "Aug 12" 13 times and
 * "2 Sep 2026" 7. One rule, day first, because month-first reads as American
 * and 12/08/2026 is ambiguous to half the world.
 */
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

export function shortDate(d: Date | string, now: Date = new Date()): string {
  const x = new Date(d);
  const same = x.getFullYear() === now.getFullYear();
  return `${x.getDate()} ${MONTHS[x.getMonth()]}` + (same ? '' : ` ${x.getFullYear()}`);
}

export const axisMonth = (d: Date | string): string => MONTHS[new Date(d).getMonth()];

/* ── ODDS ──────────────────────────────────────────────────────────────────
 * Stored decimal, displayed as chosen.
 *
 * FRACTIONAL IS A LOOKUP, NOT ARITHMETIC. A best-fit search returns the
 * mathematically smallest fraction, which is not what a bookmaker prints:
 * 2.50 is 6/4 on every UK board, and a tracker showing 3/2 looks wrong
 * against the slip it just read. The ladder below is the standard one; prices
 * off it fall back to the nearest rung rather than inventing a fraction.
 */
const FRACTIONAL: [number, string][] = [
  [1.01,'1/100'],[1.02,'1/50'],[1.04,'1/25'],[1.05,'1/20'],[1.06,'1/16'],[1.07,'1/14'],
  [1.08,'1/12'],[1.10,'1/10'],[1.11,'1/9'],[1.12,'2/17'],[1.13,'1/8'],[1.14,'1/7'],
  [1.17,'1/6'],[1.20,'1/5'],[1.22,'2/9'],[1.25,'1/4'],[1.29,'2/7'],[1.30,'3/10'],
  [1.33,'1/3'],[1.36,'4/11'],[1.40,'2/5'],[1.44,'4/9'],[1.45,'9/20'],[1.50,'1/2'],
  [1.53,'8/15'],[1.57,'4/7'],[1.60,'3/5'],[1.62,'8/13'],[1.67,'4/6'],[1.73,'8/11'],
  [1.80,'4/5'],[1.83,'5/6'],[1.90,'9/10'],[1.91,'10/11'],[2.00,'1/1'],[2.10,'11/10'],[2.20,'6/5'],
  [2.25,'5/4'],[2.38,'11/8'],[2.50,'6/4'],[2.63,'13/8'],[2.75,'7/4'],[2.88,'15/8'],
  [3.00,'2/1'],[3.20,'11/5'],[3.25,'9/4'],[3.50,'5/2'],[3.75,'11/4'],[4.00,'3/1'],
  [4.33,'10/3'],[4.50,'7/2'],[5.00,'4/1'],[5.50,'9/2'],[6.00,'5/1'],[6.50,'11/2'],
  [7.00,'6/1'],[7.50,'13/2'],[8.00,'7/1'],[9.00,'8/1'],[10.00,'9/1'],[11.00,'10/1'],
  [12.00,'11/1'],[13.00,'12/1'],[15.00,'14/1'],[17.00,'16/1'],[21.00,'20/1'],
  [26.00,'25/1'],[34.00,'33/1'],[41.00,'40/1'],[51.00,'50/1'],[67.00,'66/1'],
  [101.00,'100/1'],
];

export function toFractional(dec: number): string {
  let best = FRACTIONAL[0];
  let err = Math.abs(dec - best[0]);
  for (const rung of FRACTIONAL) {
    const e = Math.abs(dec - rung[0]);
    if (e < err) { err = e; best = rung; }
  }
  return best[1];
}

export function toAmerican(dec: number): string {
  if (!(dec > 1)) return '—';
  return dec >= 2 ? '+' + Math.round((dec - 1) * 100) : String(Math.round(-100 / (dec - 1)));
}

export type OddsFormat = 'Decimal' | 'Fractional' | 'American';

export function formatOdds(dec: number, fmt: OddsFormat = 'Decimal'): string {
  if (!(dec > 0)) return '—';
  if (fmt === 'Fractional') return toFractional(dec);
  if (fmt === 'American') return toAmerican(dec);
  return dec.toFixed(2);
}

/* ── TIME ──────────────────────────────────────────────────────────────────
 * Twenty-nine clock times appeared with no indicator of which clock. Stored
 * UTC, rendered in the account's zone, and the zone is stated once per screen
 * rather than on every row.
 *
 * The calendar's day boundaries must use the same zone, or a 23:00 bet lands
 * on the wrong day and the whole month is one cell out.
 */
export function clock(d: Date | string, timeZone = 'Europe/London'): string {
  return new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit', minute: '2-digit', hour12: false, timeZone,
  }).format(new Date(d));
}

export function zoneNote(timeZone = 'Europe/London'): string {
  return `Times in ${timeZone.replace('_', ' ')}`;
}

/* Which local day a moment falls on, in the account's zone. */
export function localDayKey(d: Date | string, timeZone = 'Europe/London'): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric', month: '2-digit', day: '2-digit', timeZone,
  }).format(new Date(d));
  return parts;
}
