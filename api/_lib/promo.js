/* Promo codes.
 *
 * The codes are a lookup table in source rather than rows in the database,
 * because they are product decisions and there is no admin screen to edit
 * them from. What the database holds is redemptions, who used what, since
 * "once per account" is only true if a UNIQUE constraint enforces it.
 *
 * Two shapes, and they are genuinely different things:
 *   lifetime  the account never pays. `plan_until` stays NULL and `plan`
 *             says why, so a NULL end date is never read as "expired".
 *   months    a paid plan that runs out. `plan_until` carries the date, and
 *             billing picks up from there.
 *
 * Codes are matched case-insensitively with spaces and dashes stripped:
 * people type them off a screenshot, and rejecting "ak5 wrd" teaches them
 * nothing. Ambiguity is not a risk here, these are handed out deliberately.
 */

export const CODES = {
  /* The founding code. Free forever, no card, no expiry. */
  AK5WRD: { plan: 'lifetime', label: 'Free for life', note: 'Slippery is free on this account, permanently.' },
  /* Two months on the house, then the normal monthly price. It also carries
     the verified tick: this is the code handed to people whose figures the
     owner already knows are real, which is exactly what the tick claims.
     `verify` is a grant, not a permanent property, so it can be taken back
     from an account later without touching the redemption record. */
  ULTRAS: { plan: 'monthly', months: 2, verify: true, label: 'First 2 months free, verified',
    note: 'Two months free, then £3.49 a month, and your account is verified.' },
  /* Gifting. Kept as their own codes rather than a quantity field so a
     gifted month cannot be turned into twelve by editing a form value. */
  GIFT1: { plan: 'monthly', months: 1, label: '1 month free', note: 'One month on us.' },
  GIFT2: { plan: 'monthly', months: 2, label: '2 months free', note: 'Two months on us.' }
};

/** Fold what someone actually types into the key we store. */
export function normalise(input) {
  return String(input == null ? '' : input).toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/**
 * Look a code up.
 * @returns {{code:string, plan:string, months?:number, label:string, note:string}|null}
 */
export function lookup(input) {
  const code = normalise(input);
  if (!code) return null;
  /* Own properties only. Folding to upper case already puts every inherited
     key out of reach, but relying on that is a coincidence rather than a
     rule, and "constructor" resolving to a truthy value here would be a free
     lifetime plan. */
  if (!Object.prototype.hasOwnProperty.call(CODES, code)) return null;
  return Object.assign({ code }, CODES[code]);
}

/**
 * When a redemption should stop paying for itself.
 *
 * Lifetime has no end date, which is the same NULL a free account carries,
 * so `plan` is what tells them apart, never this. Months are added to the
 * later of now and any date the account already has, so redeeming a gift on
 * top of a paid month extends it rather than throwing the remainder away.
 */
export function planUntil(promo, from = new Date(), existing = null) {
  if (!promo || promo.plan === 'lifetime') return null;
  const base = existing && existing > from ? new Date(existing) : new Date(from);
  const out = new Date(base);
  out.setUTCMonth(out.getUTCMonth() + (promo.months || 0));
  return out;
}

/** Is this plan still entitled to unlimited slips? */
export function unlimited(plan, planUntilDate, now = new Date()) {
  if (plan === 'lifetime') return true;
  if (plan === 'free' || !plan) return false;
  if (!planUntilDate) return true;            // paid, no end recorded
  return new Date(planUntilDate) > now;
}

/* ---- the free trial ----
 *
 * Two weeks OR 35 slips, whichever runs out first. Both halves matter and
 * they fail differently: somebody who logs 35 slips in three days has seen
 * the product properly and should be asked to subscribe now, while somebody
 * who logs four slips over a fortnight has also seen it and should be asked
 * then. One limit without the other leaves one of those two people in a free
 * account indefinitely.
 */
export const TRIAL_DAYS = 14;
export const TRIAL_SLIPS = 35;

export function trialEnd(from = new Date()) {
  return new Date(from.getTime() + TRIAL_DAYS * 86400000);
}

/**
 * What the free trial has left.
 *
 * A missing `trialEndsAt` is an account created before the trial existed,
 * and it is treated as still inside the window rather than expired: taking
 * the trial away from someone retroactively because a column was added is
 * not a thing to do to an early user.
 */
export function trialState(user, now = new Date()) {
  const used = Number(user && user.slipsUsed) || 0;
  const endsAt = user && user.trialEndsAt ? new Date(user.trialEndsAt) : null;
  const daysLeft = endsAt ? Math.ceil((endsAt - now) / 86400000) : null;
  const slipsLeft = Math.max(0, TRIAL_SLIPS - used);
  const expired = Boolean(endsAt && endsAt <= now);
  return {
    endsAt: endsAt ? endsAt.toISOString() : null,
    daysLeft: daysLeft == null ? null : Math.max(0, daysLeft),
    slipsLeft,
    slipsUsed: used,
    /* Which half ran out, because the prompt to subscribe should say so:
       "you have used all 35" and "your two weeks are up" are different
       sentences and only one of them is true. */
    over: expired ? 'time' : slipsLeft === 0 ? 'slips' : null,
    active: !expired && slipsLeft > 0
  };
}
