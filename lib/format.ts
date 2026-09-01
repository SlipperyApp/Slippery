/** Formats. One module, so no two surfaces can disagree.
 *
 *  Money        always 2dp, totals included, thousands separator above 999
 *  Units        2dp everywhere except league surfaces, which use 1dp
 *  Percentages  1dp
 *  Odds         2dp (see lib/odds.ts for the other two formats)
 *  Axis labels  0dp
 *  Dates        day first, always. "12 Aug", "12 Aug 2025", "Aug" on axes.
 *
 *  Everything is stored in UTC and rendered in Europe/London. Calendar day
 *  boundaries use it, or a 23:00 bet lands on the wrong day.
 */

export const TZ = 'Europe/London';
export const TZ_LABEL = 'Times in UK time';

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

export function plClass(minor: number): '' | 'pos' | 'neg' {
  if (minor > 0) return 'pos';
  if (minor < 0) return 'neg';
  return '';
}

/** Units. 2dp everywhere except a league, which is a comparison rather than
 *  a record: a column of 2dp units is unreadable. */
export function units(u: number, opts: { league?: boolean; sign?: boolean } = {}): string {
  const dp = opts.league ? 1 : 2;
  const s = Math.abs(u).toFixed(dp);
  const prefix = u < 0 ? '-' : opts.sign ? '+' : '';
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

// ------------------------------------------------------------------- dates

const partsOf = (d: Date, o: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat('en-GB', { timeZone: TZ, ...o }).formatToParts(d)
    .reduce<Record<string, string>>((acc, p) => { acc[p.type] = p.value; return acc; }, {});

/** The London calendar day a timestamp belongs to, as YYYY-MM-DD. Every day
 *  boundary in the product goes through this. */
export function londonDay(d: Date | string): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  const p = partsOf(date, { year: 'numeric', month: '2-digit', day: '2-digit' });
  return `${p.year}-${p.month}-${p.day}`;
}

export function londonParts(d: Date | string) {
  const date = typeof d === 'string' ? new Date(d) : d;
  const p = partsOf(date, {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  });
  return {
    year: Number(p.year), month: Number(p.month), day: Number(p.day),
    hour: Number(p.hour === '24' ? '0' : p.hour), minute: Number(p.minute),
  };
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Day first, always. "12 Aug" inside the same year, "12 Aug 2025" earlier. */
export function shortDate(d: Date | string, now: Date = new Date()): string {
  const p = londonParts(d);
  const n = londonParts(now);
  const base = `${p.day} ${MONTHS[p.month - 1]}`;
  return p.year === n.year ? base : `${base} ${p.year}`;
}

export function longDate(d: Date | string): string {
  const p = londonParts(d);
  return `${p.day} ${MONTHS[p.month - 1]} ${p.year}`;
}

export function timeOfDay(d: Date | string): string {
  const p = londonParts(d);
  return `${String(p.hour).padStart(2, '0')}:${String(p.minute).padStart(2, '0')}`;
}

export function dateTime(d: Date | string, now: Date = new Date()): string {
  return `${shortDate(d, now)}, ${timeOfDay(d)}`;
}

/** "Aug" on axes. */
export function axisMonth(d: Date | string): string {
  return MONTHS[londonParts(d).month - 1];
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
