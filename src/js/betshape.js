/* WHAT A BET HAS TO LOOK LIKE, IN ONE PLACE.
 *
 * This lived in api/bets.js, which the browser cannot import, so the
 * import review had no way to tell somebody a row would be rejected until
 * after it had been sent and rejected. Two validators would have been
 * worse: the review would have said one thing and the server another, and
 * the difference would only ever show up on somebody's real spreadsheet.
 *
 * So it is a pure module, imported by both sides, exactly as
 * settlement.js and books.js already are.
 *
 * PURITY CONTRACT, the same one settlement.js carries: no DOM, no globals,
 * no I/O, no clock reads. Money is integer pence. Never floats.
 */

/* Rejects what is structurally impossible rather than what looks unusual.
   A £2 bet at 501.0 is rare; a £2 bet at 0.4 is not a bet. */
export function betProblem(b) {
  if (!b || typeof b !== 'object') return 'Nothing to log.';
  const stake = Number(b.stakePence);
  if (!Number.isFinite(stake) || stake <= 0) return 'A bet needs a stake.';
  if (stake > 100_000_000) return 'That stake is larger than this tracker supports.';
  if (Math.round(stake) !== stake) return 'Stakes are whole pence.';
  if (b.odds != null) {
    const o = Number(b.odds);
    if (!Number.isFinite(o) || o <= 1) return 'Decimal odds are greater than 1.';
    if (o > 5000) return 'Those odds are not readable.';
  }
  if (!trimmed(b.selection)) return 'A bet needs a selection.';
  for (const [k, max] of [['event', 200], ['selection', 200], ['market', 80], ['book', 80]]) {
    if (b[k] != null && String(b[k]).length > max) return 'The ' + k + ' is too long.';
  }
  if (b.placedAt && Number.isNaN(new Date(b.placedAt).getTime())) return 'That is not a date.';
  return legProblem(b);
}

/* ---------------- bet types ----------------
 *
 * Four shapes, and the difference between two of them is a settlement
 * rule rather than a label:
 *
 *   single       one selection, one stake
 *   multiple     an accumulator. Several legs across DIFFERENT fixtures,
 *                one stake. Grades only when every leg grades; void legs
 *                drop out and the odds recalculate on the survivors.
 *   bet_builder  several legs in the SAME fixture, one stake. NEVER
 *                auto-graded, because a same-game multi's legs are
 *                correlated and the 90-minute score does not settle them.
 *   system       Yankees, Lucky 15s and the rest. Always by hand.
 */
export const BET_TYPES = ['single', 'multiple', 'bet_builder', 'system'];

/** True when the type carries legs rather than one selection. */
export const isMulti = t => t === 'multiple' || t === 'bet_builder' || t === 'system';

/**
 * Which type a set of legs looks like, when the reader could not say.
 *
 * ONE FIXTURE MEANS ONE GAME MEANS A BUILDER. Legs that all name the same
 * event cannot be an accumulator: bookmakers do not let you combine
 * correlated selections at accumulator odds, which is the whole reason
 * same-game multis are priced separately.
 *
 * Returns null when it genuinely cannot tell — a leg with no event, or
 * fewer than two legs — and null is the answer that makes the interface
 * ask rather than guess.
 */
export function inferBetType(legs) {
  if (!Array.isArray(legs) || legs.length < 2) return null;
  const events = legs.map(l => String((l && l.event) || '').trim().toLowerCase());
  if (events.some(e => !e)) return null;
  return new Set(events).size === 1 ? 'bet_builder' : 'multiple';
}

/** Structural check on the legs, if there are any. */
export function legProblem(b) {
  const legs = b && b.legs;
  if (legs == null) return '';
  if (!Array.isArray(legs)) return 'Legs must be a list.';
  if (!legs.length) return '';
  if (legs.length > 40) return 'That is more legs than this tracker supports.';
  for (let i = 0; i < legs.length; i++) {
    const l = legs[i];
    const at = 'Leg ' + (i + 1) + ': ';
    if (!l || typeof l !== 'object') return at + 'nothing there.';
    if (!trimmed(l.selection)) return at + 'a leg needs a selection.';
    if (l.odds != null && l.odds !== '') {
      const o = Number(l.odds);
      if (!Number.isFinite(o) || o <= 1) return at + 'decimal odds are greater than 1.';
      if (o > 5000) return at + 'those odds are not readable.';
    }
    for (const [k, max] of [['event', 200], ['selection', 200], ['market', 80]]) {
      if (l[k] != null && String(l[k]).length > max) return at + 'the ' + k + ' is too long.';
    }
  }
  return '';
}

/**
 * The legs, cleaned to exactly what the settlement engine reads.
 *
 * settleMulti (settlement.js) wants {selection, event, market, odds} per
 * leg and matches a fixture per leg by its own event, so anything else on
 * the object is weight in a jsonb column that nothing will ever read.
 */
export function cleanLegs(legs) {
  if (!Array.isArray(legs)) return null;
  const out = [];
  for (const l of legs.slice(0, 40)) {
    if (!l || typeof l !== 'object') continue;
    const selection = trimmed(l.selection);
    if (!selection) continue;
    const odds = Number(l.odds);
    out.push({
      selection,
      event: trimmed(l.event),
      market: trimmed(l.market, 80),
      odds: Number.isFinite(odds) && odds > 1 ? odds : null
    });
  }
  return out.length ? out : null;
}

/** One selection line for a multi, for anywhere that has one line to say it in. */
export function legsSummary(legs) {
  if (!Array.isArray(legs) || !legs.length) return '';
  return legs.map(l => l.selection).join(' & ');
}

function trimmed(v, max = 200) {
  return v == null ? null : String(v).trim().slice(0, max) || null;
}
