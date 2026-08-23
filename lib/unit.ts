/* 58 · CHANGING YOUR UNIT DOES NOT REWRITE YOUR HISTORY.
 *
 * Group leaderboards already display each member's unit — 1u = £100, 1u = £25
 * — so a unit is plainly a per-person, per-time thing. Nothing said what
 * happened to past bets when somebody changed theirs, and the two possible
 * answers produce completely different history:
 *
 *   recalculate   January's +£250 at a £25 unit reads +10.0u, then you raise
 *                 your unit to £50 in August and January reads +5.0u. The
 *                 past changed while you were asleep.
 *   freeze        January keeps the unit it was placed at and still reads
 *                 +10.0u.
 *
 * Freeze. A curve that rewrites itself is not a record of anything, and
 * freezing is consistent with what the leaderboard already shows.
 *
 * This is only reversible before data exists: once bets are stored without
 * the unit they were placed at, it cannot be backfilled truthfully and any
 * attempt is a guess at somebody's history.
 */

export type UnitChange = { effectiveFrom: Date | string; unitPence: number };

/* The unit in force on a given date, for an imported bet whose own placement
   predates nothing we recorded. Falls back to the current unit and the caller
   says so in the dry run rather than importing silently at the wrong scale. */
export function unitOn(
  history: readonly UnitChange[],
  when: Date | string,
  currentUnitPence: number | null,
): { unitPence: number | null; source: 'history' | 'current' } {
  const at = new Date(when).getTime();
  let best: UnitChange | null = null;
  for (const h of history) {
    const from = new Date(h.effectiveFrom).getTime();
    if (from <= at && (!best || from > new Date(best.effectiveFrom).getTime())) best = h;
  }
  if (best) return { unitPence: best.unitPence, source: 'history' };
  return { unitPence: currentUnitPence, source: 'current' };
}

/* What a settled bet is worth in units, using the unit it was placed at and
   never today's. Null when the bet predates any unit being set, so the
   interface shows an em dash rather than dividing by zero. */
export function unitsFor(realisedPlPence: number, unitAtPlacementPence: number | null): number | null {
  if (!unitAtPlacementPence || unitAtPlacementPence <= 0) return null;
  return Math.round((realisedPlPence / unitAtPlacementPence) * 100) / 100;
}

export const UNIT_CHANGE_COPY =
  'Changing your unit affects new bets. Past bets keep the unit they were placed at, ' +
  'so your history does not change.';
