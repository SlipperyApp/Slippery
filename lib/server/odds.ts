/* Odds, in the three formats the settings offer.
 *
 * Stored decimal always. Converted only for display, so changing the format
 * cannot alter a stored price, and a price that came off a slip as 10/11 and
 * one typed as 1.91 are the same bet.
 */
export type OddsFormat = 'decimal' | 'fractional' | 'american';

export function formatOdds(decimal: number, format: OddsFormat): string {
  if (!Number.isFinite(decimal) || decimal < 1) return '';
  if (format === 'decimal') return decimal.toFixed(2);

  if (format === 'american') {
    if (decimal >= 2) return '+' + Math.round((decimal - 1) * 100);
    /* Rounded toward the shorter price, which is what a bookmaker shows. */
    return String(Math.round(-100 / (decimal - 1)));
  }

  /* Fractional. The SMALLEST denominator that is close enough, not the
     closest fraction: 4.33 is 333/100 exactly and 10/3 on every board in the
     country. Bookmakers quote from a ladder of familiar denominators and
     round to it, so the tolerance is what reproduces the price somebody
     actually saw. */
  const target = decimal - 1;
  const LADDER = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 16, 20, 25, 33, 40, 50, 66, 80, 100];
  const TOLERANCE = 0.01;   // one percent of the price

  let best = { n: 1, d: 1, err: Infinity };
  for (const d of LADDER) {
    const n = Math.round(target * d);
    if (n < 1) continue;
    const err = Math.abs(target - n / d) / target;
    if (err < best.err) best = { n, d, err };
    if (err <= TOLERANCE) return reduce(best.n, best.d);
  }
  return reduce(best.n, best.d);
}

const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);
const reduce = (n: number, d: number) => {
  const g = gcd(n, d) || 1;
  return `${n / g}/${d / g}`;
};
