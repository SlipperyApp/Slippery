/* 17 · WHAT THE BOT IS ALLOWED TO SEND, AND WHEN.
 *
 * The old settings sheet listed seven switches that persisted nothing — every
 * one was the generic `data-tog`, which flips `aria-pressed` and forgets. So
 * the product asked people what they wanted and then did not record it.
 *
 * Pure, so the rules can be read and tested without a database.
 */

export type NotificationKey =
  | 'settled' | 'overtaken' | 'reaction' | 'weekly' | 'promotion' | 'challenge';

export type Notification = {
  key: NotificationKey;
  label: string;
  detail: string;
  /* Two are on by default: a bet finishing is the whole point of the bot, and
     being overtaken is the only league event that is time-sensitive. */
  defaultOn: boolean;
  /* Once per event, not once per change — being overtaken four times in an
     evening is one message, not four. */
  once?: boolean;
  batched?: boolean;
};

export const NOTIFICATIONS: readonly Notification[] = [
  { key: 'settled',   label: 'Bet settled',      detail: 'When a bet finishes, with your running total for the day', defaultOn: true, batched: true },
  { key: 'overtaken', label: 'Someone passed you', detail: 'Once, when your weekly opponent goes ahead',              defaultOn: true, once: true },
  { key: 'reaction',  label: 'Reactions',        detail: 'Batched, never one message per tap',                        defaultOn: false, batched: true },
  { key: 'weekly',    label: 'Sunday result',    detail: 'How your week finished and where you are in the table',     defaultOn: false },
  { key: 'promotion', label: 'Promotion',        detail: 'When you move division at the end of a month',              defaultOn: false },
  { key: 'challenge', label: 'Challenge ending', detail: 'The day before a challenge you entered closes',             defaultOn: false },
];

export type Prefs = Partial<Record<NotificationKey, boolean>>;

/* A missing key means the default, so adding a notification never needs a
   backfill and never silently switches itself on for everybody. */
export function wants(prefs: Prefs | null | undefined, key: NotificationKey): boolean {
  const stored = prefs?.[key];
  if (typeof stored === 'boolean') return stored;
  return NOTIFICATIONS.find((n) => n.key === key)?.defaultOn ?? false;
}

/* Only keys we know about, and only booleans. Anything else in the payload is
   dropped rather than stored, or the column becomes a junk drawer. */
export function sanitise(input: unknown): Prefs {
  const out: Prefs = {};
  if (!input || typeof input !== 'object') return out;
  for (const n of NOTIFICATIONS) {
    const v = (input as Record<string, unknown>)[n.key];
    if (typeof v === 'boolean') out[n.key] = v;
  }
  return out;
}

/* ── THE THREE THINGS THE BOT MUST NEVER SEND ──────────────────────────────
 * Written down rather than assumed, because each is easy to add later while
 * meaning well, and each turns a record-keeping tool into a nudge.
 *
 *   1. Anything about NOT having bet. "You have not logged a bet this week"
 *      is a prompt to bet, whatever it is dressed as.
 *   2. Anything framed as losing your place. Resting protects a position
 *      precisely so nobody is pushed into a bet to defend it.
 *   3. Anything late at night. Nothing sends between 22:00 and 08:00 local;
 *      it waits for the morning.
 */
export const QUIET_FROM_HOUR = 22;
export const QUIET_TO_HOUR = 8;

export function isQuietHours(londonHour: number): boolean {
  return londonHour >= QUIET_FROM_HOUR || londonHour < QUIET_TO_HOUR;
}
