/* 12 · CONFIDENCE, SCORED PER FIELD, NOT PER SLIP.
 *
 * Reading is binary today: a slip either saved silently or failed. So a price
 * the model was 60% sure of entered the ledger as a fact, and every figure
 * downstream — net, ROI, units, the calendar, the league — inherited it.
 *
 * A WRONG PRICE IS WORSE THAN A MISSING ONE. A missing one is visible and
 * somebody fixes it; a wrong one is invisible and quietly poisons a year of
 * history. That asymmetry is the whole design here.
 *
 * Per field rather than per slip, because a slip is usually right about the
 * stake and unsure about one leg's price — and refusing the whole slip for
 * that costs somebody the other four fields it read correctly.
 *
 * Pure: no model, no network. The route scores, this decides.
 */

export type Field = 'stake' | 'price' | 'selection' | 'bookmaker' | 'event' | 'market';

/* The four that change the money. A low score on any of these holds the bet
   out of aggregates; a low score on event or market is a labelling problem
   and does not. */
export const LOAD_BEARING: readonly Field[] = ['stake', 'price', 'selection', 'bookmaker'];

export type Band = 'high' | 'medium' | 'low';

/* Thresholds are deliberately far apart. A model's own confidence is not
   calibrated, so a boundary at 0.8 vs 0.82 is meaningless — what matters is
   "sure", "hesitant" and "guessing". */
export const HIGH = 0.9;
export const MEDIUM = 0.65;

export function band(score: number): Band {
  if (score >= HIGH) return 'high';
  if (score >= MEDIUM) return 'medium';
  return 'low';
}

export type FieldScore = { field: Field; value: unknown; score: number };

export type Disposition = {
  /* save silently · ask one targeted question · hold out of aggregates */
  action: 'save' | 'ask' | 'hold';
  /* Which fields to ask about, worst first, so the question is one question. */
  ask: Field[];
  /* Whether this bet counts toward net, ROI, units and the calendar. */
  countsInStats: boolean;
  reason: string;
};

export function disposition(scores: readonly FieldScore[]): Disposition {
  const low = scores.filter((s) => band(s.score) === 'low');
  const med = scores.filter((s) => band(s.score) === 'medium');
  const bearing = (f: Field) => LOAD_BEARING.includes(f);

  const lowBearing = low.filter((s) => bearing(s.field));
  if (lowBearing.length) {
    return {
      action: 'hold',
      ask: lowBearing.map((s) => s.field),
      countsInStats: false,
      reason: `Could not read the ${list(lowBearing.map((s) => s.field))}. `
        + 'Held out of your figures until you confirm it, because a wrong '
        + 'one is worse than a missing one.',
    };
  }

  const medBearing = med.filter((s) => bearing(s.field));
  if (medBearing.length) {
    /* Worst first: one question, about the field we are least sure of. */
    const worst = [...medBearing].sort((a, b) => a.score - b.score);
    return {
      action: 'ask',
      ask: worst.map((s) => s.field),
      countsInStats: true,
      reason: `Check the ${list(worst.map((s) => s.field))}.`,
    };
  }

  /* Only labelling fields are shaky. Saved, and the bet still counts: a
     mislabelled market moves no money. */
  return {
    action: 'save',
    ask: [],
    countsInStats: true,
    reason: 'Read cleanly.',
  };
}

function list(items: readonly string[]): string {
  if (items.length <= 1) return items[0] ?? '';
  return items.slice(0, -1).join(', ') + ' and ' + items[items.length - 1];
}

/* THE ONE QUESTION. Never a free-text box: offer the reading and the most
   likely alternative, because somebody looking at their own slip can pick
   between two in a second and cannot be bothered to type. */
export function askCopy(field: Field, read: string, alt?: string): string {
  const noun: Record<Field, string> = {
    stake: 'Stake', price: 'Odds', selection: 'Selection',
    bookmaker: 'Bookmaker', event: 'Event', market: 'Market',
  };
  return alt
    ? `${noun[field]} looks like ${read}, could be ${alt}?`
    : `Is the ${noun[field].toLowerCase()} ${read}?`;
}

/* ── TRAINING SIGNAL ───────────────────────────────────────────────────────
 * Every correction is labelled data, tracked per bookmaker template. Slip
 * layouts are stable per book, so a correction on a bet365 acca is worth far
 * more than a generic one — it says which template drifted.
 */
export type Correction = {
  bookmaker: string | null;
  field: Field;
  read: unknown;
  corrected: unknown;
  modelScore: number;
};

/* A correction on a field the model was CONFIDENT about is the important
   one: it means the template changed, and everything read since is suspect. */
export function isTemplateDrift(c: Correction): boolean {
  return band(c.modelScore) === 'high';
}

/* ── DUPLICATES ────────────────────────────────────────────────────────────
 * Hash the parsed bet, not the image: two screenshots of the same slip are
 * different files, and cropping one makes a third.
 */
export function betFingerprint(b: {
  bookmaker?: string | null; stakePence?: number | null;
  odds?: number | null; selection?: string | null; eventAt?: string | Date | null;
}): string {
  const norm = (s: unknown) => String(s ?? '').toLowerCase().replace(/\s+/g, ' ').trim();
  const day = b.eventAt ? new Date(b.eventAt).toISOString().slice(0, 10) : '';
  return [norm(b.bookmaker), b.stakePence ?? '', b.odds ?? '', norm(b.selection), day].join('|');
}

export const DUPLICATE_WINDOW_HOURS = 24;

export function isProbableDuplicate(
  a: { fingerprint: string; at: Date | string },
  b: { fingerprint: string; at: Date | string },
): boolean {
  if (a.fingerprint !== b.fingerprint) return false;
  const gap = Math.abs(new Date(a.at).getTime() - new Date(b.at).getTime());
  return gap <= DUPLICATE_WINDOW_HOURS * 3600_000;
}
