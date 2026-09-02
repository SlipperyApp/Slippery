/** What a person has typed into signup so far, carried in the URL.
 *
 *  SIGNUP IS SIX SCREENS AND THERE WAS NO WAY BACK OUT OF ANY OF THEM. Each
 *  step pushed the next and every field was a useState initialised to an empty
 *  string, so a browser back button landed on a screen that had forgotten
 *  everything and a person who wanted to change the handle they had just
 *  chosen had to start again at the email.
 *
 *  THE URL IS THE STORE BECAUSE THERE IS NO OTHER ONE. iOS is the primary
 *  target and neither localStorage nor sessionStorage may be used, and the
 *  server cannot hold the draft either: half these deployments have no
 *  DATABASE_URL, and a back button that only works where a database is
 *  configured is not a back button. A query string survives a browser back, a
 *  forward, a refresh and a shared link, and it costs nothing to read.
 *
 *  NOTHING SECRET GOES IN IT. The password is never here and neither is the
 *  six digit code. What is here is a display name, a handle and a set of
 *  bookmakers, which is the same class of fact as the email address the verify
 *  screen has always carried, and every one of these screens is already
 *  robots: index false.
 *
 *  Reading is total: an absent or malformed parameter falls back to the same
 *  default the form had before, so a hand edited URL cannot produce a form in
 *  a state the person did not choose. */

import type { Currency } from '@/lib/domain/types';

export type SignupDraft = {
  email: string;
  displayName: string;
  handle: string;
  referral: string;
  currency: Currency;
  /** Null until the unit step has been answered, so the picker keeps its own
   *  default rather than being told a unit nobody chose. */
  unitPence: number | null;
  /*  Null means the step has not been answered, which is not the same fact as
      an empty list: a person who deliberately unticked every sport and pressed
      Continue must find every sport unticked when they come back, and not the
      default the picker starts on. An answered empty list rides as "-". */
  sports: string[] | null;
  bookmakers: string[] | null;
  customBookmakers: string[];
  plan: 'yearly' | 'monthly';
};

type Params = Record<string, string | string[] | undefined>;

const one = (v: string | string[] | undefined): string => (Array.isArray(v) ? (v[0] ?? '') : (v ?? ''));

/*  A list rides as one comma separated parameter rather than as a repeated
    key, because a repeated key arrives as an array on the server and as a
    single string when there is one of it, and that difference is exactly the
    kind of thing that works for two bookmakers and not for one. */
const list = (v: string | string[] | undefined): string[] =>
  one(v).split(',').map((s) => s.trim()).filter(Boolean).slice(0, 40);

const answered = (v: string | string[] | undefined): string[] | null => {
  const raw = one(v);
  if (!raw) return null;
  return raw === '-' ? [] : list(v);
};

export function readDraft(sp: Params): SignupDraft {
  const unit = Number(one(sp.unit));
  return {
    email: one(sp.email).slice(0, 254),
    displayName: one(sp.name).slice(0, 64),
    handle: one(sp.handle).slice(0, 20),
    referral: one(sp.ref).slice(0, 32),
    currency: one(sp.cur) === 'EUR' ? 'EUR' : 'GBP',
    unitPence: Number.isFinite(unit) && unit >= 10 && unit <= 100_000_00 ? Math.round(unit) : null,
    sports: answered(sp.sports),
    bookmakers: answered(sp.books),
    customBookmakers: list(sp.own).map((s) => s.slice(0, 40)),
    plan: one(sp.plan) === 'monthly' ? 'monthly' : 'yearly',
  };
}

/** The draft as a query string, with the empty halves left out so a URL says
 *  only what has actually been answered. */
export function draftQuery(d: SignupDraft): string {
  const q = new URLSearchParams();
  if (d.email) q.set('email', d.email);
  if (d.displayName) q.set('name', d.displayName);
  if (d.handle) q.set('handle', d.handle);
  if (d.referral) q.set('ref', d.referral);
  if (d.unitPence !== null) { q.set('cur', d.currency); q.set('unit', String(d.unitPence)); }
  if (d.sports) q.set('sports', d.sports.join(',') || '-');
  if (d.bookmakers) q.set('books', d.bookmakers.join(',') || '-');
  if (d.customBookmakers.length) q.set('own', d.customBookmakers.join(','));
  if (d.plan !== 'yearly') q.set('plan', d.plan);
  const s = q.toString();
  return s ? `?${s}` : '';
}

/** Rewrite the address of the step you are STANDING ON to include what has
 *  just been typed into it, without adding a history entry.
 *
 *  WITHOUT THIS THE BACK BUTTON GOES BACK TO AN EMPTY FORM, which is the
 *  whole defect wearing a different hat, and it took a real browser to see it:
 *  the draft was only ever written into the address of the NEXT step, so the
 *  history entry left behind for this one was the address as it was on
 *  arrival, before anything was typed. Measured, walking back three steps
 *  returned three empty forms and three correct URLs.
 *
 *  The existing history state object is passed through rather than null,
 *  because the App Router keys its own entries by what is in there and an
 *  entry with that key wiped is an entry it cannot restore. */
export function keepAnswers(path: string, d: SignupDraft): void {
  if (typeof window === 'undefined') return;
  window.history.replaceState(window.history.state, '', stepHref(path, d));
}

/** A step's address with the draft on it. Used for going forward and for
 *  going back, which is the point: the same string either way means a step
 *  behind you is the screen you left, not an empty one.
 *
 *  `extra` is for the two screens that carry a fact of their own beside the
 *  draft: the rate limit screen, which has to know how long to count and
 *  which step to send you back to. Being rate limited is a wait, not a
 *  reason to lose what you typed. */
export function stepHref(path: string, d: SignupDraft, extra?: Record<string, string>): string {
  const q = new URLSearchParams(draftQuery(d).replace(/^\?/, ''));
  for (const [k, v] of Object.entries(extra ?? {})) q.set(k, v);
  const s = q.toString();
  return s ? `${path}?${s}` : path;
}
