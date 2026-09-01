/** The calendar ramp, in one place, because two things depend on it agreeing
 *  with itself: the component that draws a cell and the test that measures
 *  every step of it.
 *
 *  THE PROBLEM. Fill opacity tracks the size of the day. As it rises, the
 *  result colour on it gets LESS legible before the page ground becomes
 *  legible, and there is a dead band in the middle where neither ink clears
 *  4.5:1, roughly 0.39 to 0.56 for green and 0.36 to 0.63 for red. The
 *  obvious implementation is a single threshold, `if (alpha > 0.42) use dark
 *  ink`, and it lands squarely inside the hole.
 *
 *  THE FIX is two bands that skip the dead zone entirely. Below half
 *  magnitude the fill stays faint and the figure keeps its own colour; at half
 *  it jumps straight past the hole to a fill strong enough to carry the page
 *  ground as ink.
 *
 *  THE FIGURE AND THE DATE TAKE THE SAME DECISION. Computing them separately
 *  is the specific bug that leaves the date invisible on a mid cell, so they
 *  come out of one function and there is no way to ask for one without the
 *  other.
 */

export type RampBand = 'none' | 'low' | 'high';

export type RampStep = {
  band: RampBand;
  /** 0 when there is nothing to fill. */
  alpha: number;
  /** Which ink the figure AND the date both take. */
  ink: 'result' | 'ground';
};

/*  THREE NUMBERS ARE NOT THE ONES THE BRIEF GAVE, and this is why.
 *
 *  The specified ramp was 0.14 to 0.30 low with the date in --t3, and 0.66 to
 *  1.00 high with the date at 70% of the ground. Measured across every step
 *  of both bands, in all eight themes, for a profit and a loss, and for the
 *  figure AND the date, that ramp does not clear 4.5:1. It fails on the DATE,
 *  at both ends:
 *
 *    low band, --t3 at alpha 0.30      2.21:1   periwinkle, profit
 *    high band, ground at 70%          3.59:1   carbon, loss, at alpha 0.66
 *
 *  The quoted 5.30 and 6.03 for the high band are right at alpha 1.00, which
 *  is the top of the band. The bottom of the band was not measured, and the
 *  bottom is where a band fails.
 *
 *  The STRUCTURE is right and is kept exactly: two bands, skipping the dead
 *  zone, with the figure and the date taking one decision. Three values move:
 *
 *    LOW_TO        0.30 -> 0.20   the low fill stops before its own figure
 *                                 goes under, which is the binding constraint
 *    low date      --t3 -> --t1   --t3 cannot sit on a tinted cell
 *    DATE_ON_HIGH  0.70 -> 0.90
 *
 *  Worst case is now 4.55:1, at periwinkle, on a loss figure at the top of
 *  the low band. Every other theme is 4.58 or better. The dead zone the ramp
 *  skips is wider than the one specified, 0.20 to 0.66 rather than 0.30 to
 *  0.66, which is the safer direction. */
export const RAMP = {
  /** Where the low band ends and the high band begins. */
  SPLIT: 0.5,
  LOW_FROM: 0.14,
  LOW_TO: 0.20,
  HIGH_FROM: 0.66,
  HIGH_TO: 1.0,
  /** The date on a high band cell, as a proportion of the page ground. */
  DATE_ON_HIGH: 0.9,
} as const;

/** `value` in minor units, `peak` the largest absolute value in the month. */
export function rampStep(value: number, peak: number): RampStep {
  if (!value || peak <= 0) return { band: 'none', alpha: 0, ink: 'result' };
  const mag = Math.min(1, Math.abs(value) / peak);
  if (mag < RAMP.SPLIT) {
    return {
      band: 'low',
      alpha: RAMP.LOW_FROM + (mag / RAMP.SPLIT) * (RAMP.LOW_TO - RAMP.LOW_FROM),
      ink: 'result',
    };
  }
  return {
    band: 'high',
    alpha: RAMP.HIGH_FROM
      + ((mag - RAMP.SPLIT) / (1 - RAMP.SPLIT)) * (RAMP.HIGH_TO - RAMP.HIGH_FROM),
    ink: 'ground',
  };
}
