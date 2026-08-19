/* Promo and referral codes.
 *
 * The trial is 5 days OR 15 slips, whichever runs out first. A valid referral
 * makes it 14 days or 40 slips. Both halves matter and they fail differently,
 * so the server reports WHICH one ran out and the copy says so; the client is
 * told the answer rather than counting, or the number on the dashboard can
 * disagree with what actually blocks an upload.
 */
export const TRIAL_DAYS = 5;
export const TRIAL_SLIPS = 15;
export const REFERRED_TRIAL_DAYS = 14;
export const REFERRED_TRIAL_SLIPS = 40;

export type Promo = {
  code: string;
  label: string;
  /* Months of a paid plan granted outright. */
  months?: number;
  plan?: 'monthly' | 'yearly';
  /* A granted year that lapses to free rather than rolling into a charge. */
  renews?: boolean;
  /* Auto-join this group, creating it on first use. */
  group?: string;
  /* Referral codes lengthen the trial instead of granting a plan. */
  extendsTrial?: boolean;
};

const ADMIN_CODE = process.env.ADMIN_PROMO_CODE || '';

export const PROMOS: Promo[] = [
  { code: 'ULTRAS', label: 'Ultras', months: 2, plan: 'monthly', renews: true, group: 'Ultras' },
  { code: 'HBVALUE', label: 'HBValue', months: 2, plan: 'monthly', renews: true, group: 'HBValue' },
  /* The admin grant is a full year that does NOT roll into a charge. When it
     runs out the account lapses to free, never to a debt. It lives in an
     environment variable rather than in source because this repository is
     public and a code in source is a free year for anybody who reads it. */
  ...(ADMIN_CODE ? [{ code: ADMIN_CODE, label: 'Admin', months: 12, plan: 'yearly' as const, renews: false }] : []),
];

export function findPromo(input: unknown): Promo | null {
  const code = String(input || '').trim().toUpperCase();
  if (!code) return null;
  return PROMOS.find((p) => p.code.toUpperCase() === code) ?? null;
}

/* A referral code is somebody's handle. It gives the referred person the
   longer trial, gives the referrer nothing, and makes the two follow each
   other. */
export const referralHandle = (input: unknown): string | null => {
  const raw = String(input || '').trim().replace(/^@/, '').toLowerCase();
  return /^[a-z0-9_]{3,24}$/.test(raw) ? raw : null;
};

export type TrialState =
  | { state: 'none' }
  | { state: 'active'; daysLeft: number; slipsLeft: number; ran: null }
  | { state: 'over'; ran: 'days' | 'slips' };

export function trialState(account: {
  trialEndsAt: Date | null;
  trialSlipsAllowed: number | null;
  trialSlipsUsed: number;
  plan: string | null;
  planState: string | null;
}, now = new Date()): TrialState {
  if (account.plan && account.planState === 'active') return { state: 'none' };
  if (!account.trialEndsAt) return { state: 'none' };

  const msLeft = account.trialEndsAt.getTime() - now.getTime();
  const allowed = account.trialSlipsAllowed ?? TRIAL_SLIPS;
  const slipsLeft = allowed - account.trialSlipsUsed;

  /* Which one ran out, not merely that one did. "You have used all 15 slips"
     and "your 5 days are up" need different next steps. */
  if (slipsLeft <= 0) return { state: 'over', ran: 'slips' };
  if (msLeft <= 0) return { state: 'over', ran: 'days' };

  return { state: 'active', daysLeft: Math.ceil(msLeft / 86400000), slipsLeft, ran: null };
}
