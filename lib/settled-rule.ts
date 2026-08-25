/* 17 · WHEN A SETTLEMENT IS WORTH ANNOUNCING.
 *
 * Pure, and in `lib/` rather than `lib/server/` so it can be imported without
 * dragging a database connection behind it — which is also what makes it
 * testable without one.
 */

/* THE TRAP THIS EXISTS TO CLOSE. A recompute over an already-settled bet also
 * returns 'settled', because the fold is a fold: it replays every event and
 * arrives at the same answer. So "is it settled now?" is the wrong question —
 * the bot would announce the same bet on every edit, every Rule 4, every
 * manual correction. The question is whether it BECAME settled. */
export function isTransitionToSettled(
  previousStatus: string | null | undefined,
  nextStatus: string,
): boolean {
  return nextStatus === 'settled' && previousStatus !== 'settled';
}

/* A multiple's legs settle within a second or two of each other, and one
 * message per leg is how a bot gets muted. */
export const BATCH_MS = 90_000;
