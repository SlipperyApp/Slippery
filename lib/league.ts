/* 16 · MONTHLY LEAGUES.
 *
 * Points from the head to head, units as goal difference. Every UK bettor
 * reads a football table with no explanation at all, which is the whole
 * reason not to invent an XP system: the format is already known, so the
 * only thing anyone has to learn is that a unit is the goal difference.
 *
 * Pure. Shared by the render layer, the API and the tests.
 */

export const WIN_POINTS = 3;
export const DRAW_POINTS = 1;
export const LOSS_POINTS = 0;

/* A draw is units within a tenth. Without a band, a head to head decided by
   0.02u is a win, which is noise dressed as a result. */
export const DRAW_BAND = 0.1;

/* ── THE CAP ───────────────────────────────────────────────────────────────
 * Three units per bet, for league purposes only. Real P&L is untouched.
 *
 * Without it the optimal strategy is one 10u punt at 12/1 on the last day of
 * the month, which is the exact behaviour a tracker should not be rewarding.
 * It is shown rather than applied quietly — "+8.4u · counts as +3.0u" — because
 * a figure silently different from the one in your ledger destroys trust in
 * both.
 */
export const UNIT_CAP = 3;

export function cappedUnits(u: number): number {
  return Math.max(-UNIT_CAP, Math.min(UNIT_CAP, u));
}

export function capNote(u: number): string | null {
  const c = cappedUnits(u);
  if (c === u) return null;
  const f = (n: number) => (n > 0 ? '+' : n < 0 ? '−' : '') + Math.abs(n).toFixed(1) + 'u';
  return `${f(u)} · counts as ${f(c)}`;
}

/* ── RESTING ───────────────────────────────────────────────────────────────
 * Under five settled bets in a month and you are resting: greyed, no
 * promotion, and PROTECTED FROM RELEGATION.
 *
 * The protection is the point. Relegating somebody for not betting enough is
 * a volume nudge with a table around it, and this product does not do that.
 */
export const RESTING_MIN_BETS = 5;

export const isResting = (settledBets: number): boolean => settledBets < RESTING_MIN_BETS;

export const RESTING_COPY = 'Resting this month. Your place is held.';

/* ── A HEAD TO HEAD ────────────────────────────────────────────────────── */
export type Fixture = { home: string; away: string; homeUnits: number; awayUnits: number };
export type Result = { home: number; away: number };   // points

export function scoreFixture(f: Fixture): Result {
  const a = cappedUnits(f.homeUnits);
  const b = cappedUnits(f.awayUnits);
  if (Math.abs(a - b) <= DRAW_BAND) return { home: DRAW_POINTS, away: DRAW_POINTS };
  return a > b ? { home: WIN_POINTS, away: LOSS_POINTS } : { home: LOSS_POINTS, away: WIN_POINTS };
}

/* ── THE TABLE ─────────────────────────────────────────────────────────── */
export type Standing = {
  name: string; played: number; won: number; drawn: number; lost: number;
  units: number; points: number; resting: boolean; form: string;
};

/* Points, then units as goal difference, then name so the order is stable
   between two people who are identical on both — a table that reorders
   itself on refresh looks broken. */
export function sortTable(rows: readonly Standing[]): Standing[] {
  return [...rows].sort((a, b) =>
    b.points - a.points || b.units - a.units || a.name.localeCompare(b.name));
}

/* ── DIVISIONS ─────────────────────────────────────────────────────────────
 * A division is a skill tier; a table is the 24 Slippers inside it. At forty
 * users that is one tier with one table; at forty thousand it is five tiers
 * with hundreds of tables each, and nothing about the model changes.
 */
export const DIVISIONS = ['Premier', 'Championship', 'League One', 'League Two', 'Conference'] as const;
export type Division = (typeof DIVISIONS)[number];

export const TABLE_SIZE = 24;
export const PROMOTED = 3;
export const RELEGATED = 3;

/* Under twelve active in a tier it merges upward, and the product says so
   rather than running a four-person Premier League in silence. */
export const MIN_ACTIVE = 12;

export type Movement = 'up' | 'down' | 'stay';

export function movementFor(
  position: number, tableSize: number, resting: boolean, division: Division,
): Movement {
  if (resting) return 'stay';                      // protected, both ways
  const top = DIVISIONS.indexOf(division) === 0;
  const bottom = DIVISIONS.indexOf(division) === DIVISIONS.length - 1;
  if (position <= PROMOTED && !top) return 'up';
  if (position > tableSize - RELEGATED && !bottom) return 'down';
  return 'stay';
}

/* Nobody starts in the Premier League. Month one is unranked and the finish
   decides the entry tier, and imported history does not count toward it —
   otherwise a CSV is a promotion. */
export const PLACEMENT_COPY =
  'Your first month is a placement season. Where you finish decides which division you start in. '
  + 'Imported history does not count toward it.';

/* ── THE WEEKLY DRAW ───────────────────────────────────────────────────────
 * Swiss: week one at random, then paired on record with no repeats — so by
 * the last week the top of the table is playing itself, which is the whole
 * reason to use Swiss rather than a fixed round robin.
 */
export function swissPairs(
  standings: readonly Standing[],
  played: ReadonlySet<string>,          // "a|b" keys, both orders inserted
): { pairs: [string, string][]; bye: string | null } {
  const pool = sortTable(standings).map((s) => s.name);
  const pairs: [string, string][] = [];
  /* An odd table gets a rotating bye worth one point — the same as a draw,
     because a bye is not a result and should not be worth more than one. */
  const bye = pool.length % 2 === 1 ? pool.pop()! : null;

  while (pool.length) {
    const a = pool.shift()!;
    let i = pool.findIndex((b) => !played.has(`${a}|${b}`));
    /* Everyone left has already played them: take the nearest on record
       rather than failing to produce a fixture. */
    if (i < 0) i = 0;
    pairs.push([a, pool.splice(i, 1)[0]]);
  }
  return { pairs, bye };
}

export const BYE_POINTS = 1;

/* ── FORM ──────────────────────────────────────────────────────────────────
 * Last five settled bets. A void is grey and does not break a run, because a
 * non-runner is not a loss and a streak that a non-runner ends is not a
 * streak of anything.
 */
export type FormMark = 'W' | 'L' | 'V';

export function formString(outcomes: readonly FormMark[]): string {
  return outcomes.slice(-5).join('');
}

export function currentStreak(outcomes: readonly FormMark[]): { kind: 'W' | 'L' | null; n: number } {
  let kind: 'W' | 'L' | null = null;
  let n = 0;
  for (let i = outcomes.length - 1; i >= 0; i--) {
    const o = outcomes[i];
    if (o === 'V') continue;                 // does not break it, does not extend it
    if (kind === null) { kind = o; n = 1; continue; }
    if (o === kind) n++; else break;
  }
  return { kind, n };
}

/* ── SLIP BACKING ──────────────────────────────────────────────────────────
 * Global divisions are slip-backed only. A group admin may allow manual
 * entries, default off, from the next season and never retroactively —
 * changing the rules of a season while it is running invalidates it.
 */
export const GLOBAL_REQUIRES_SLIP = true;
export const GROUP_ALLOWS_MANUAL_DEFAULT = false;
