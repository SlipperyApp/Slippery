/* Money, odds and number formatting.
 *
 * Everything internal is integer pence. Formatting happens only at the
 * edge, right before text hits the DOM. Every money string gets tabular
 * figures via the .m class or font-variant-numeric, or columns misalign
 * and digits jitter when values update. */

/* GBP and EUR only, as decided. USD is not a currency this product supports
   and offering it would let a bet be logged that no figure can total. */
export const CURRENCIES = { GBP: '£', EUR: '€' };

/* CURRENCY IS A PARAMETER, NOT A SINGLETON.
 *
 * This module used to hold the selected currency in a module-level `let` and
 * rebuild two formatters when it changed. In a browser serving one person
 * that is merely untidy. On a server it is a data leak: one request setting
 * EUR would format the next person's figures in EUR, because the module is
 * shared across every request the instance handles. So the currency travels
 * with the call, and the formatters are memoised per currency instead. */
const _fmts = new Map();
function fmts(cur) {
  const key = CURRENCIES[cur] ? cur : 'GBP';
  let f = _fmts.get(key);
  if (!f) {
    f = {
      two: new Intl.NumberFormat('en-GB', { style: 'currency', currency: key }),
      zero: new Intl.NumberFormat('en-GB', { style: 'currency', currency: key, maximumFractionDigits: 0 }),
    };
    _fmts.set(key, f);
  }
  return f;
}

/** £123.45 from 12345 */
export function money(pence, cur = 'GBP') { return fmts(cur).two.format(pence / 100); }
/** £123 from 12345, no decimals, for compact stats */
export function money0(pence, cur = 'GBP') { return fmts(cur).zero.format(Math.abs(pence) / 100); }
/** −£123 from -12345, signed, no decimals */
export function money0s(pence, cur = 'GBP') {
  return (pence < 0 ? '−' : '') + fmts(cur).zero.format(Math.abs(pence) / 100);
}
/** +£123.45 / −£123.45, always signed. The minus is U+2212, not a hyphen. */
export function signed(pence, cur = 'GBP') {
  return (pence > 0 ? '+' : pence < 0 ? '−' : '') + fmts(cur).two.format(Math.abs(pence) / 100);
}
/**
 * The semantic class for an amount. Zero is neither, and must not be green:
 * #86EFAC means profit, and a void returns the stake for no profit at all.
 * Every place that colours money goes through this so the rule holds once.
 */
export function tone(pence) {
  return pence > 0 ? 'pos' : pence < 0 ? 'neg' : 'mut';
}
/** +1.94u, profit expressed in the user's unit stake */
export function units(pence, unitPence) {
  const v = unitPence ? pence / unitPence : 0;
  return (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v).toFixed(2) + 'u';
}
/** +5.9% */
export function pct(n) {
  return (n >= 0 ? '+' : '−') + Math.abs(n).toFixed(1) + '%';
}
/** +1.9k for calendar cells, where space is 40px */
export function compact(pence) {
  /* Zero gets no sign. "−0" appeared on every calendar day whose bets all
     voided, which reads as a small loss and is not one. */
  const a = Math.abs(pence) / 100, s = pence > 0 ? '+' : pence < 0 ? '−' : '';
  if (a >= 1e4) { const k = a / 1e3; return s + (k >= 99.95 ? Math.round(k) : k.toFixed(1)) + 'k'; }
  return s + Math.round(a).toLocaleString('en-GB');
}
export function plain(n) { return n.toLocaleString('en-GB'); }

/* ---- odds ----
   The fractional ladder is the set bookmakers actually print. We snap to
   it when the decimal is close, and fall back to an exact reduced
   fraction when it is not, rather than printing something no bookmaker
   would ever show. */
const LADDER = [[1,10],[1,9],[1,8],[1,7],[1,6],[1,5],[2,9],[1,4],[2,7],[3,10],[1,3],[2,5],
  [4,9],[1,2],[4,7],[3,5],[2,3],[4,5],[5,6],[1,1],[11,10],[6,5],[5,4],[7,5],[3,2],[8,5],
  [7,4],[9,5],[2,1],[9,4],[5,2],[11,4],[3,1],[7,2],[4,1],[9,2],[5,1],[6,1],[7,1],[8,1],
  [9,1],[10,1],[12,1],[14,1],[16,1],[20,1],[25,1],[33,1],[40,1],[50,1],[66,1],[100,1]];

function gcd(a, b) { while (b) { const t = b; b = a % b; a = t; } return a || 1; }

export function odds(decimal, format) {
  if (format === 'Fractional') {
    const f = decimal - 1;
    let best = null;
    for (const [n, d] of LADDER) {
      const e = Math.abs(f - n / d);
      if (!best || e < best.e) best = { n, d, e };
    }
    if (best && best.e / Math.max(f, 0.01) <= 0.02) return best.n + '/' + best.d;
    const nu = Math.round(f * 100), g = gcd(nu, 100);
    return (nu / g) + '/' + (100 / g);
  }
  if (format === 'American') {
    return decimal >= 2 ? '+' + Math.round((decimal - 1) * 100)
                        : '−' + Math.round(100 / (decimal - 1));
  }
  return decimal.toFixed(2);
}

/** Parse a user-typed money string into pence. Returns null if unusable. */
export function parseMoney(str) {
  const s = String(str == null ? '' : str).replace(/[^0-9.\-]/g, '');
  if (!s || s === '-' || s === '.') return null;
  const n = parseFloat(s);
  if (!isFinite(n)) return null;
  return Math.round(n * 100);
}
