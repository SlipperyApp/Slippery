/** Odds. Stored as decimal, displayed in the account's chosen format.
 *
 *  The fractional ladder is a real one, not a naive fraction reducer:
 *  2.50 is 6/4, not 3/2, and 1.90 is 9/10, not 10/11. A reducer gets both
 *  of those wrong, which is why there is a lookup table.
 */

export type OddsFormat = 'decimal' | 'fractional' | 'american';

/** The traditional ladder, odds-on first, evens, then odds-against.
 *  Each entry is [numerator, denominator]. */
export const LADDER: ReadonlyArray<readonly [number, number]> = [
  [1, 100], [1, 66], [1, 50], [1, 40], [1, 33], [1, 25], [1, 20], [1, 16],
  [1, 14], [1, 12], [1, 10], [1, 9], [1, 8], [2, 15], [1, 7], [2, 13],
  [1, 6], [2, 11], [1, 5], [2, 9], [1, 4], [2, 7], [3, 10], [1, 3],
  [4, 11], [2, 5], [4, 9], [40, 85], [1, 2], [8, 15], [4, 7], [8, 13],
  [4, 6], [8, 11], [4, 5], [5, 6], [9, 10], [10, 11], [20, 21],
  [1, 1],
  [21, 20], [11, 10], [6, 5], [5, 4], [11, 8], [6, 4], [13, 8], [7, 4],
  [15, 8], [2, 1], [85, 40], [9, 4], [5, 2], [11, 4], [3, 1], [100, 30],
  [7, 2], [4, 1], [9, 2], [5, 1], [11, 2], [6, 1], [13, 2], [7, 1],
  [15, 2], [8, 1], [17, 2], [9, 1], [10, 1], [11, 1], [12, 1], [14, 1],
  [16, 1], [18, 1], [20, 1], [22, 1], [25, 1], [28, 1], [33, 1], [40, 1],
  [50, 1], [66, 1], [80, 1], [100, 1], [125, 1], [150, 1], [200, 1],
  [250, 1], [300, 1], [400, 1], [500, 1], [750, 1], [1000, 1],
];

/** Nearest rung on the ladder. Ties go to the earlier rung, which is the
 *  smaller denominator, which is how a board would print it. */
export function toFractional(decimal: number): string {
  if (!Number.isFinite(decimal) || decimal <= 1) return 'SP';
  const target = decimal - 1;
  let best = LADDER[0];
  let bestDiff = Infinity;
  for (const rung of LADDER) {
    const diff = Math.abs(rung[0] / rung[1] - target);
    if (diff < bestDiff - 1e-12) { bestDiff = diff; best = rung; }
  }
  if (best[0] === 1 && best[1] === 1) return 'evens';
  return `${best[0]}/${best[1]}`;
}

export function toAmerican(decimal: number): string {
  if (!Number.isFinite(decimal) || decimal <= 1) return 'SP';
  if (decimal >= 2) return `+${Math.round((decimal - 1) * 100)}`;
  return `${Math.round(-100 / (decimal - 1))}`;
}

export function fromFractional(text: string): number | null {
  const t = text.trim().toLowerCase();
  if (t === 'evens' || t === 'evs' || t === 'even') return 2;
  const m = /^(\d+(?:\.\d+)?)\s*[/-]\s*(\d+(?:\.\d+)?)$/.exec(t);
  if (!m) return null;
  const n = Number(m[1]);
  const d = Number(m[2]);
  if (!d) return null;
  return Number((n / d + 1).toFixed(4));
}

export function formatOdds(decimal: number, format: OddsFormat = 'decimal'): string {
  if (!Number.isFinite(decimal) || decimal <= 1) return 'SP';
  if (format === 'fractional') return toFractional(decimal);
  if (format === 'american') return toAmerican(decimal);
  return decimal.toFixed(2);
}

/** Accumulated price of a set of legs. Void legs are dropped by the caller
 *  before this is reached, which is what makes the odds recalculate. */
export function accaOdds(legOdds: number[]): number {
  return Number(legOdds.reduce((a, b) => a * b, 1).toFixed(4));
}

/** A Rule 4 deduction is pence in the pound off net winnings. */
export function rule4Multiplier(deductionPencePerPound: number): number {
  const p = Math.max(0, Math.min(90, deductionPencePerPound));
  return 1 - p / 100;
}
