/** Formats. One module, so no two surfaces can disagree.
 *
 *  Money        always 2dp, totals included, thousands separator above 999
 *  Units        2dp everywhere except league surfaces, which use 1dp
 *  Percentages  1dp
 *  Odds         2dp (see lib/odds.ts for the other two formats)
 *  Axis labels  0dp
 *  Dates        day first, always. "12 Aug", "12 Aug 2025", "Aug" on axes.
 *
 *  Everything is stored in UTC and rendered in the ACCOUNT'S OWN TIME ZONE.
 *  Calendar day boundaries use it, or a 23:00 bet lands on the wrong day.
 *  See the dates section at the foot of this file: zonedParts() is the single
 *  function every day boundary in the product goes through.
 */

/** The zone an account gets before it says otherwise. Most of this product's
 *  Slippers are in the UK; the ones who are not are why the account carries
 *  a zone at all. */
export const DEFAULT_TZ = 'Europe/London';
export type TimeZone = string;

export type Currency = 'GBP' | 'EUR';

export const CURRENCY_SYMBOL: Record<Currency, string> = { GBP: '£', EUR: '€' };

/** Money is integer minor units plus a currency code. Never a float, and
 *  never two currencies summed into one net figure. */
export function money(minor: number, currency: Currency = 'GBP', opts: { sign?: boolean; symbol?: boolean } = {}): string {
  const { sign = false, symbol = true } = opts;
  const v = minor / 100;
  const abs = Math.abs(v);
  const body = new Intl.NumberFormat('en-GB', {
    style: symbol ? 'currency' : 'decimal',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(abs);
  const prefix = v < 0 ? '-' : sign ? '+' : '';
  return prefix + body;
}

/** Signed money, which is what almost every profit figure wants. */
export function pl(minor: number, currency: Currency = 'GBP'): string {
  return money(minor, currency, { sign: true });
}

/** Money for a machine to read: no symbol, no thousands separator, always two
 *  decimals, and the minus in front.
 *
 *  The export is the one edge where money is read by a spreadsheet rather
 *  than a person, and money() is wrong there twice over. Its symbol makes the
 *  cell text, and above 999 its thousands separator makes "1,234.56", which a
 *  comma-delimited file has to quote and which several locales then import as
 *  text: a stake column that will not sum is the exact failure somebody
 *  building a spreadsheet on this export would find last.
 *
 *  Integer arithmetic throughout. minor / 100 is a float and 1999 / 100 is
 *  19.990000000000002, which is a stake nobody placed. */
export function moneyPlain(minor: number): string {
  const n = Math.trunc(minor);
  const abs = Math.abs(n);
  return `${n < 0 ? '-' : ''}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`;
}

export function plClass(minor: number): '' | 'pos' | 'neg' {
  if (minor > 0) return 'pos';
  if (minor < 0) return 'neg';
  return '';
}

/** Money in the other direction: text a person typed, or a reader saw on a
 *  slip, into integer minor units. It is here rather than at the two call
 *  sites so that the parse and the format cannot disagree about what 1,234.5
 *  means.
 *
 *  It returns integer minor units or nothing at all. `Number(text) * 100`,
 *  which is what both call sites did, reads 19.99 as 1998.9999999999998 and
 *  turns a stake into a rounding argument; it also accepts "1e3", "Infinity"
 *  and "15.0001" as money, and a three decimal stake is a misread column
 *  rather than a price.
 *
 *  A currency comes back only when the text actually carried one. Deciding
 *  that a bare 15 is pounds is the silent conversion the ledger must never
 *  do: pounds and euros are never summed. */
export function parseMoneyMinor(text: unknown): { minor: number; currency: Currency | null } | null {
  if (typeof text !== 'string') return null;
  const t = text.trim();
  if (!t) return null;

  /*  A minus, a dash or a range is not a stake. The dashes are written as
   *  escapes because the literal glyphs are banned in this repository. */
  if (/[-\u2012\u2013\u2014\u2212]/.test(t)) return null;

  const symbol: Currency | null = t.includes('£') ? 'GBP' : t.includes('€') ? 'EUR' : null;
  const code: Currency | null = /\bGBP\b/i.test(t) ? 'GBP' : /\bEUR\b/i.test(t) ? 'EUR' : null;

  /*  ONE run of digits, and nothing lettered against it.
   *
   *  Stripping every non-digit and reading what is left turned "1e3" into 13
   *  and "5 to 10" into 510, both of which are a stake nobody typed. Two runs
   *  means a range, a date or a perm written out ("15 x 1.00"), and every one
   *  of those is a question rather than an amount. */
  const runs = t.match(/\d[\d.,]*/g) ?? [];
  if (runs.length !== 1) return null;
  const digits = runs[0];
  const after = t.charAt(t.indexOf(digits) + digits.length);
  if (/[a-z]/i.test(after)) return null;

  /*  Which separator is the decimal point. The LAST separator wins when both
   *  appear, which reads 1,234.56 and 1.234,56 correctly without knowing the
   *  locale of the bookmaker who printed the slip. A lone separator followed
   *  by exactly three digits is a thousands mark, because no slip prints
   *  three decimal places of money. */
  const lastDot = digits.lastIndexOf('.');
  const lastComma = digits.lastIndexOf(',');
  const cut = Math.max(lastDot, lastComma);
  const tail = cut === -1 ? '' : digits.slice(cut + 1);
  const decimal = cut !== -1 && tail.length > 0 && tail.length <= 2;

  if (cut !== -1 && !decimal && tail.length !== 3) return null;   // 15.0001 is not money

  const whole = (decimal ? digits.slice(0, cut) : digits).replace(/[.,]/g, '');
  const frac = decimal ? tail.padEnd(2, '0') : '00';
  if (!/^\d+$/.test(whole) || !/^\d{2}$/.test(frac)) return null;

  // Integer arithmetic throughout: 19.99 must not go anywhere near a float.
  const minor = Number(whole) * 100 + Number(frac);
  if (!Number.isSafeInteger(minor) || minor < 0 || minor > 100_000_000) return null;

  return { minor, currency: symbol ?? code };
}

/** Units. 2dp everywhere except a league, which is a comparison rather than
 *  a record: a column of 2dp units is unreadable. */
export function units(u: number, opts: { league?: boolean; sign?: boolean } = {}): string {
  const dp = opts.league ? 1 : 2;
  const s = Math.abs(u).toFixed(dp);
  /*  A figure that rounds to nothing takes no sign. A league at 1dp turned
      four hundredths of a unit down into "-0.0u", which reads as a rendering
      fault rather than as a level month, and a "+0.0u" beside it says a
      profit was made that the same line says was nothing. */
  const prefix = Number(s) === 0 ? '' : u < 0 ? '-' : opts.sign ? '+' : '';
  return `${prefix}${s}u`;
}

export function pct(x: number, opts: { sign?: boolean } = {}): string {
  const s = Math.abs(x).toFixed(1);
  const prefix = x < 0 ? '-' : opts.sign ? '+' : '';
  return `${prefix}${s}%`;
}

/** Chart axis labels are 0dp. */
export function axisMoney(minor: number, currency: Currency = 'GBP'): string {
  const v = Math.round(minor / 100);
  const sym = CURRENCY_SYMBOL[currency];
  if (Math.abs(v) >= 1000) return `${v < 0 ? '-' : ''}${sym}${Math.abs(Math.round(v / 100) / 10)}k`;
  return `${v < 0 ? '-' : ''}${sym}${Math.abs(v)}`;
}

/** A calendar cell is about 45px wide, so no pence, and thousands abbreviate.
 *
 *  The figure is always SIGNED rather than left to the colour: at the bottom
 *  of the ramp the tint is deliberately faint, and a faint red and a faint
 *  green are precisely the two things a red-green colour blind reader cannot
 *  separate. The minus is a real one (U+2212), not a hyphen.
 *
 *  A day that was bet on and came out level shows the currency and a zero,
 *  rather than looking like a day that was sat out. */
export function cellFigure(minor: number, currency: Currency = 'GBP'): string {
  const sym = CURRENCY_SYMBOL[currency];
  const pounds = minor / 100;
  if (Math.round(pounds) === 0) return `${sym}0`;
  const sign = pounds < 0 ? '\u2212' : '+';
  const abs = Math.abs(pounds);
  if (abs >= 1000) {
    const k = abs >= 10000 ? Math.round(abs / 1000) : Math.round(abs / 100) / 10;
    return `${sign}${sym}${k}k`;
  }
  return `${sign}${sym}${Math.round(abs)}`;
}

export function count(n: number): string {
  return new Intl.NumberFormat('en-GB').format(n);
}

/** A count and its noun, agreeing. "1 bets" appears the moment a filter
 *  leaves one row, which is exactly when somebody is reading the number
 *  most carefully. English pluralises by adding s for every noun this
 *  product counts, so this takes the singular and does that; a noun that
 *  does not follow the rule passes its own plural. */
export function plural(n: number, one: string, many = `${one}s`): string {
  return `${count(n)} ${n === 1 ? one : many}`;
}

// ------------------------------------------------------------------- dates
//
//  ONE FUNCTION OWNS EVERY DAY BOUNDARY, AND IT TAKES A ZONE.
//
//  It used to own it without one. Every boundary was computed in
//  Europe/London and the server's own day leaked into the two places that
//  built a Date rather than read one: periodStart() assembled the London
//  year, month and day and then handed them to Date.UTC, which is London
//  midnight only for the five winter months. A bet at 00:40 Irish summer
//  time is 23:40 the previous day in UTC, so "Today" on the calendar and
//  "Today" in the period selector disagreed with each other about it from
//  late March to late October.
//
//  Two things follow, and both are enforced by the shape of these
//  functions rather than by anybody remembering. There is one reader,
//  zonedParts(), and it cannot be called without naming a zone. And there
//  is one writer, startOfDay(), which turns a local wall-clock day back
//  into the instant it begins at, offset and all.

const partsOf = (d: Date, tz: TimeZone, o: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat('en-GB', { timeZone: tz, ...o }).formatToParts(d)
    .reduce<Record<string, string>>((acc, p) => { acc[p.type] = p.value; return acc; }, {});

export type ZonedParts = {
  year: number; month: number; day: number;
  hour: number; minute: number; second: number;
};

/** A timestamp broken into the wall clock somebody in `tz` is reading.
 *
 *  THE ONE READER. Everything below is built out of it, so a surface cannot
 *  quietly answer in the server's own day by using a different Date method. */
export function zonedParts(d: Date | string, tz: TimeZone): ZonedParts {
  const date = typeof d === 'string' ? new Date(d) : d;
  const p = partsOf(date, tz, {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  });
  return {
    year: Number(p.year), month: Number(p.month), day: Number(p.day),
    // Intl answers 24 for midnight in some locales, and hour 24 of one day is
    // hour 0 of the next, not an hour that exists.
    hour: Number(p.hour === '24' ? '0' : p.hour),
    minute: Number(p.minute), second: Number(p.second),
  };
}

/** The calendar day a timestamp belongs to in `tz`, as YYYY-MM-DD. Every day
 *  boundary in the product goes through this. */
export function dayKey(d: Date | string, tz: TimeZone): string {
  const p = zonedParts(d, tz);
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
}

/** How far `tz` is ahead of UTC at that instant, in milliseconds. */
function offsetMs(at: Date, tz: TimeZone): number {
  const p = zonedParts(at, tz);
  const asIfUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  // The instant, floored to the second, because the parts carry no
  // milliseconds and the difference would otherwise be off by them.
  return asIfUtc - Math.floor(at.getTime() / 1000) * 1000;
}

/** The instant a local wall-clock day begins at in `tz`.
 *
 *  THE ONE WRITER, and it is the half that was missing. Date.UTC on a zoned
 *  year, month and day is that day's midnight in UTC, which is a different
 *  instant from that day's midnight anywhere with an offset, so a period
 *  window built that way was an hour out for the whole of British summer
 *  time and every bet in that hour fell into the wrong period.
 *
 *  Two passes, because the offset depends on the instant and the instant
 *  depends on the offset. The first pass guesses with the offset in force at
 *  the naive time; the second corrects it, which is what settles the clocks
 *  going forward or back overnight. Anything the second pass cannot settle is
 *  an hour that does not exist, and midnight is never that hour in any zone
 *  this product serves. */
export function startOfDay(year: number, month: number, day: number, tz: TimeZone): Date {
  const naive = Date.UTC(year, month - 1, day, 0, 0, 0);
  let ts = naive - offsetMs(new Date(naive), tz);
  ts = naive - offsetMs(new Date(ts), tz);
  return new Date(ts);
}

/** Is this a zone the platform knows? A stored zone the runtime cannot
 *  resolve would otherwise throw inside Intl on every date on the page, so it
 *  is checked once and refused rather than carried. */
export function isKnownTimeZone(tz: unknown): tz is TimeZone {
  if (typeof tz !== 'string' || !tz) return false;
  try {
    new Intl.DateTimeFormat('en-GB', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Day first, always. "12 Aug" inside the same year, "12 Aug 2025" earlier. */
export function shortDate(d: Date | string, now: Date = new Date(), tz: TimeZone = DEFAULT_TZ): string {
  const p = zonedParts(d, tz);
  const n = zonedParts(now, tz);
  const base = `${p.day} ${MONTHS[p.month - 1]}`;
  return p.year === n.year ? base : `${base} ${p.year}`;
}

export function longDate(d: Date | string, tz: TimeZone = DEFAULT_TZ): string {
  const p = zonedParts(d, tz);
  return `${p.day} ${MONTHS[p.month - 1]} ${p.year}`;
}

export function timeOfDay(d: Date | string, tz: TimeZone = DEFAULT_TZ): string {
  const p = zonedParts(d, tz);
  return `${String(p.hour).padStart(2, '0')}:${String(p.minute).padStart(2, '0')}`;
}

export function dateTime(d: Date | string, now: Date = new Date(), tz: TimeZone = DEFAULT_TZ): string {
  return `${shortDate(d, now, tz)}, ${timeOfDay(d, tz)}`;
}

/** "Aug" on axes. */
export function axisMonth(d: Date | string, tz: TimeZone = DEFAULT_TZ): string {
  return MONTHS[zonedParts(d, tz).month - 1];
}

export function monthName(month1to12: number): string {
  return MONTHS[month1to12 - 1];
}

export const MONTH_LONG = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

/** Relative, but never a bare "now": a settlement time has to be readable. */
export function ago(d: Date | string, now: Date = new Date()): string {
  const then = typeof d === 'string' ? new Date(d) : d;
  const mins = Math.round((now.getTime() - then.getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs === 1 ? '' : 's'} ago`;
  const days = Math.round(hrs / 24);
  if (days < 8) return `${days} day${days === 1 ? '' : 's'} ago`;
  return shortDate(then, now);
}

/** The distance between two moments, with no direction on it.
 *
 *  `ago` says how long since. This says how long BETWEEN, and it has two
 *  callers that would otherwise each grow their own: how far ahead of a kick
 *  off a bet was captured, and how long until that kick off. Both are the
 *  same subtraction and both have to round the same way, or a bet reads as
 *  captured "2 hours" before an event starting "in 2 hours" while the two
 *  numbers came from different arithmetic. */
export function gap(from: Date | string, to: Date | string): string {
  const a = typeof from === 'string' ? new Date(from) : from;
  const b = typeof to === 'string' ? new Date(to) : to;
  const mins = Math.max(0, Math.round((b.getTime() - a.getTime()) / 60000));
  if (mins < 1) return 'under a minute';
  if (mins < 60) return `${mins} min`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs === 1 ? '' : 's'}`;
  const days = Math.round(hrs / 24);
  return `${days} day${days === 1 ? '' : 's'}`;
}

/** Whole days remaining, floored, never negative. */
export function daysUntil(iso: string, now: Date = new Date()): number {
  return Math.max(0, Math.floor((new Date(iso).getTime() - now.getTime()) / 86400000));
}

export function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

/** "4 of 12". Gold, silver and bronze for the top three is a class, not a
 *  colour literal, so it themes. */
export function position(rank: number, of: number): string {
  return `${rank} of ${of}`;
}

/** The each way terms, as a slip prints them: "1/5, places 1-3".
 *
 *  Both halves or neither is a lie by omission. A fifth the odds means
 *  nothing without knowing how many places it was paid on, and a place count
 *  means nothing without knowing what a place was worth, which is why
 *  places_paid was added beside ew_place_fraction rather than instead of it.
 *  Whichever half is missing is left out rather than guessed at. */
export function ewTerms(fraction: number | null, placesPaid: number | null): string {
  const bits: string[] = [];
  if (fraction && fraction > 0) bits.push(`1/${Math.round(1 / fraction)}`);
  if (placesPaid && placesPaid > 0) bits.push(`places 1-${placesPaid}`);
  return bits.join(', ');
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0] ?? '').join('').toUpperCase() || '?';
}

/** Small numbers, spelled.
 *
 *  The house voice writes "Seventeen questions", not "17 questions", and a
 *  spelled number in prose is a number nobody updates. The landing page said
 *  "Six of them" over the top six and "The other ten" under them, against a
 *  list of seventeen: correct when it was written and wrong by one the
 *  moment a question was added. Every count of a list now comes from the
 *  list. Figures are never spelled, only prose. */
const WORDS = [
  'Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
  'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen',
  'Nineteen', 'Twenty',
];

export function spell(n: number, { cap = true }: { cap?: boolean } = {}): string {
  const w = Number.isInteger(n) && n >= 0 && n <= 20 ? WORDS[n] : String(n);
  return cap ? w : w.toLowerCase();
}
