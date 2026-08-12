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
  /* Two months on the house, then the normal monthly price. */
  ULTRAS: { plan: 'monthly', months: 2, label: 'First 2 months free', note: 'Two months free, then £3.49 a month. Cancel any time.' },
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
