/** What a slip read looks like once the reader has finished with it.
 *
 *  Confidence is scored PER FIELD, not per slip: scoring a whole slip means
 *  one bad field poisons nineteen good ones, or nineteen good ones hide the
 *  one bad one. High saves silently, medium asks one targeted question, low
 *  is held out of the aggregates until a person settles it.
 *
 *  A missing price is visible and a wrong one is not, so a price is never
 *  guessed silently.
 *
 *  This module holds the vocabulary BOTH sides share. The reader lives on the
 *  server and the review screen is a client component, so the refusal codes
 *  and their copy live here, where neither can reach `process.env` and the
 *  two cannot drift into saying different things about the same failure. */

import type { Currency } from '@/lib/domain/types';

export type Confidence = 'high' | 'medium' | 'low' | 'missing';

export type ReadField = {
  key: string;
  label: string;
  /** EMPTY unless the reader was sure. A field it was not sure about is a
   *  question on the review screen, never a filled-in box somebody skims
   *  past and confirms. */
  value: string;
  confidence: Confidence;
  /** What the reader saw, when that is not the same as what it concluded.
   *  Evidence for the person answering the question, not an answer. */
  saw?: string;
  /** The one targeted question, when there is one. */
  question?: string;
  /** Whether this field has to be settled before anything can be written. */
  required?: boolean;
  /** A question with a fixed set of answers rather than a box to type in.
   *  "Is this a free bet" has three answers and no fourth; a stake has as
   *  many as there are stakes. */
  options?: string[];
};

export type ReadLeg = {
  selection: string;
  fixture: string;
  /** Decimal odds as text, empty when the price was not read cleanly. */
  odds: string;
  market: string;
  confidence: Confidence;
  saw?: string;
};

export type SlipRead = {
  id: string;
  bookmaker: string;
  /** The reference id the template detector settled on, or 'unknown'.
   *
   *  IT IS AN ID AND NOT A NAME. The bookmaker decides whether a whole
   *  handicap line pushes or loses, what commission is charged, and which
   *  breakdown row the bet lands in, and none of those can be looked up from
   *  a display string the reader spelled its own way. 'unknown' is a real
   *  answer and the review screen asks. */
  bookmakerId: string;
  bookmakerConfidence: Confidence;
  /** Which signatures fired in the template table, as evidence. It is shown
   *  beside the question when the answer is unknown, because "no bookmaker
   *  was recognised" and "two books matched and neither won" send somebody to
   *  do different things. */
  templateMatched: string[];
  /** The bet type as a person reads it. "Lucky 15", not lucky15. */
  shape: string;
  /** Each way is a flag rather than a shape: an each way treble is both, and
   *  it doubles the lines. */
  eachWay: boolean;
  /** Integer minor units, per line, and null when the stake was not read
   *  cleanly. Money is never a float and a stake is never inferred. */
  stakeMinor: number | null;
  stakeSaw: string | null;
  /** Lines a permed bet is. A Lucky 15 is fifteen bets, so the stake above
   *  is multiplied by this before anything is written. */
  lines: number;
  /** Only ever the currency printed on the slip. Never converted. */
  currency: Currency | null;
  placedAt: string | null;
  fields: ReadField[];
  legs: ReadLeg[];
  /** Set when this slip looks like one already in the ledger. It is a
   *  question on the review screen, never a refusal: the bet is still there
   *  to confirm or to throw away, and the person decides which. */
  duplicateOf?: { id: string; when: string; matchedOn: DuplicateMatch };
  /*  WHO PAID FOR THE STAKE, and what the reader saw that made it say so.
   *
   *  These three are the only fields on a read that cannot be recovered from
   *  the ledger afterwards. A 25 pound stake at 3.0 that returned 50 is three
   *  different profits depending on whose money the 25 was, and every one of
   *  them is a true reading of the same row. `saw` is the evidence, printed
   *  beside the switch on the review screen, because a flag somebody cannot
   *  check is a flag that silently rewrites a return. */
  promotional: {
    /** Stake not returned, and out of turnover. */
    freeBet: boolean;
    /** Stake returned with the winnings, and out of turnover. */
    bonusFunds: boolean;
    /** Recorded, and changes no arithmetic: see lib/domain/fold.ts. */
    boosted: boolean;
    /** The phrases the reader matched, verbatim. Empty when it found none. */
    saw?: string[];
  };
  /** True for the worked example on the review screen, so it can never be
   *  mistaken for a read of somebody's own slip. */
  example?: boolean;
};

/*  -------------------------------------------------------------- duplicates
 *
 *  DUPLICATE DETECTION USED TO HASH THE IMAGE. `slip_images.sha256` was the
 *  only check, and two screenshots of one slip are two different files: crop
 *  a pixel off, share it through a chat that recompresses it, or take the
 *  shot twice, and both saved. The bet was then in the ledger twice and every
 *  aggregate that reads bet_state counted it twice, so a person's net, their
 *  turnover, their return and their unit count were all wrong and nothing on
 *  any screen said why.
 *
 *  What identifies a bet is the bet: who it is with, what it is on, what it
 *  cost, at what price, on what event, at what time. That is what is hashed
 *  now. The image hash stays in front of it as a fast path, because an
 *  identical file can be caught before the reader is called at all and that
 *  saves somebody a slip off their allowance, but it is no longer the only
 *  check and it no longer ends the journey by itself. */

/** Which check found the match. They mean different things to the person
 *  reading the answer: the same file is almost certainly a re-upload, the
 *  same bet might be a real second bet on the same race. */
export type DuplicateMatch = 'image' | 'bet';

/** How far back a match counts.
 *
 *  Two screenshots of one slip arrive minutes or hours apart. The same bet
 *  fingerprint a week later is a different occasion: an annual fixture at the
 *  same time, a re-import of history, or somebody who genuinely backs the
 *  same horse at the same price every year. A day is long enough to cover
 *  "I sent it this morning and forgot" and short enough that it cannot quietly
 *  swallow a real bet. */
export const DUPLICATE_WINDOW_MS = 24 * 60 * 60 * 1000;

const asMs = (t: Date | number) => (t instanceof Date ? t.getTime() : t);

/** The oldest save a duplicate search will look at. The query is given this
 *  value rather than working the window out in SQL, so the boundary a test
 *  pins is the boundary the database applies. */
export function duplicateCutoff(now: Date | number = Date.now()): string {
  return new Date(asMs(now) - DUPLICATE_WINDOW_MS).toISOString();
}

/** Whether a bet saved at this time is recent enough to be the same upload.
 *  The same comparison the query makes, exclusive at the far end. */
export function withinDuplicateWindow(savedAt: string | Date, now: Date | number = Date.now()): boolean {
  const t = savedAt instanceof Date ? savedAt.getTime() : Date.parse(savedAt);
  return Number.isFinite(t) && t > asMs(now) - DUPLICATE_WINDOW_MS;
}

/** The fields a bet is identified by. Nothing here is a display string: they
 *  are the values as they are stored. */
export type BetIdentity = {
  bookmaker: string | null;
  selection: string | null;
  stakeMinor: number | null;
  odds: number | null;
  eventName: string | null;
  eventAt: string | null;
};

/** Punctuation, casing and repeated spaces differ between two reads of one
 *  slip and mean nothing about which bet it is. "Man City (H)" and "man city
 *  h" are one selection. */
function flatten(text: string | null): string {
  return (text ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** To the minute, in UTC. A slip prints a time to the minute, so hashing
 *  anything finer would make two reads of the same slip differ on a value
 *  neither of them read. */
function toMinute(iso: string | null): string {
  if (!iso) return '';
  const t = Date.parse(iso);
  return Number.isFinite(t) ? new Date(t).toISOString().slice(0, 16) : '';
}

/** The identity of a bet as it is about to be stored, from the parts a slip
 *  read and a save request each hold.
 *
 *  ONE recipe, and both callers use it. A fingerprint taken one way when the
 *  slip is read and another way when the bet is saved would never match
 *  itself, and the duplicate check would then be a check that never fires,
 *  which is what it was before. */
export function identityOf(input: {
  bookmaker: string | null;
  /** Per line, in minor units. The total is this times the line count, which
   *  is what the bets table stores. */
  stakePerLineMinor: number | null;
  lines: number;
  eventAt: string | null;
  legs: { selection?: string | null; fixture?: string | null; odds?: number | null }[];
}): BetIdentity {
  const priced = input.legs.map((l) => (typeof l.odds === 'number' && Number.isFinite(l.odds) ? l.odds : null));
  const lines = Math.max(1, Math.round(input.lines || 1));
  return {
    bookmaker: input.bookmaker,
    selection: input.legs.map((l) => (l.selection ?? '').trim()).join(' / '),
    stakeMinor: input.stakePerLineMinor == null ? null : Math.round(input.stakePerLineMinor) * lines,
    odds: priced.length && priced.every((p) => p !== null)
      ? Number((priced as number[]).reduce((a, b) => a * b, 1).toFixed(4))
      : null,
    eventName: input.legs[0]?.fixture ?? null,
    eventAt: input.eventAt,
  };
}

/** The canonical string a bet fingerprint is taken over.
 *
 *  It is a string rather than a hash so it can be tested without crypto and
 *  read in a failure. The caller hashes it: `lib/server/auth.ts` owns sha256
 *  and this module is imported by client components, which cannot have
 *  node:crypto in their bundle.
 *
 *  The `v1` in front is the recipe version. Changing what goes into a
 *  fingerprint has to stop the new ones matching the old ones, or a change of
 *  recipe would silently pair up bets that were never the same. */
export function fingerprintSource(bet: BetIdentity): string {
  return [
    'v1',
    flatten(bet.bookmaker),
    flatten(bet.selection),
    bet.stakeMinor == null || !Number.isFinite(bet.stakeMinor) ? '' : String(Math.round(bet.stakeMinor)),
    bet.odds == null || !Number.isFinite(bet.odds) ? '' : bet.odds.toFixed(4),
    flatten(bet.eventName),
    toMinute(bet.eventAt),
  ].join('|');
}

/*  ---------------------------------------------------------------- refusals
 *
 *  Every way a slip fails to become a bet, and what to do about each one.
 *
 *  They are separate codes rather than one "could not read that" because the
 *  fix differs every time and the person cannot see which one happened. A
 *  photograph of a screen needs a screenshot; a cropped stake needs the
 *  bottom of the slip; a euro slip on a sterling account needs a decision
 *  nobody but the account holder can make. One message covering all three
 *  sends everybody back to do the wrong thing. */

export type SlipRefusal =
  | 'no_file'
  | 'too_large'
  | 'unsupported_type'
  | 'not_configured'
  | 'unreachable'
  | 'refused'
  | 'unparsable'
  | 'not_a_slip'
  | 'photo_of_screen'
  | 'stake_cropped'
  | 'currency_mismatch'
  | 'legs_missing'
  /*  The two the reader never reached, because /api/extract checked no plan,
      no trial and no read-only state. A refusal that costs nothing has to
      look like every other refusal or the screens grow a second way of
      saying no. */
  | 'trial_spent'
  | 'read_only';

export type RefusalCopy = {
  /** The pill above the message. Short, upper case, scannable. */
  tag: string;
  title: string;
  /** What happened, and that nothing was written. */
  message: string;
  /** What to do next. Never empty: a refusal with no next step is a dead end. */
  fix: string;
};

export const MAX_UPLOAD_BYTES = 12 * 1024 * 1024;

/** What the reader can actually open. HEIC is not on it: the model does not
 *  take one, so the crop step re-encodes to JPEG in the browser and a browser
 *  that cannot decode it says so rather than uploading something that will
 *  come back refused. */
export const READABLE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'] as const;

export const REFUSAL_COPY: Record<SlipRefusal, RefusalCopy> = {
  no_file: {
    tag: 'NOTHING ARRIVED',
    title: 'No file reached the reader',
    message: 'The upload arrived empty, so nothing was read and nothing was written.',
    fix: 'Choose the image again. If it keeps arriving empty, the file may be in cloud storage rather than on the device.',
  },
  too_large: {
    tag: 'TOO BIG',
    title: 'That file is over 12MB',
    message: 'Nothing was uploaded, so nothing was read and your slip allowance is untouched.',
    fix: 'A screenshot from a phone is well under a megabyte. Screenshot the slip rather than photographing it, or crop the photograph before sending it.',
  },
  unsupported_type: {
    tag: 'WRONG KIND OF FILE',
    title: 'The reader cannot open that kind of file',
    message: 'It takes a PNG, JPEG, WebP or GIF image, or a PDF. Nothing was read.',
    fix: 'Screenshot the slip in the bookmaker app and send that. A HEIC from an iPhone is converted here at the crop step, so send it through the crop rather than straight up.',
  },
  not_configured: {
    tag: 'READER DOWN',
    title: 'Slip reading is not set up on this deployment',
    message: 'No slip was read, nothing was written, and no allowance was spent.',
    fix: 'Type the bet in instead. It counts everywhere a read one does, and it is marked as typed in.',
  },
  unreachable: {
    tag: 'READER DOWN',
    title: 'The reader could not be reached',
    message: 'Nothing was lost. Your image is still here and no allowance was spent.',
    fix: 'Send it again in a moment. If it keeps failing, type the bet in and the ledger stays correct.',
  },
  refused: {
    tag: 'READER REFUSED',
    title: 'The reader would not take that image',
    message: 'Nothing was read from it and nothing was written.',
    fix: 'Send it again shortly. If it happens twice with the same image, crop tighter to the slip and try once more.',
  },
  unparsable: {
    tag: 'UNREADABLE ANSWER',
    title: 'The reader answered with something unusable',
    message: 'Rather than salvage half of it into your ledger, the whole answer was dropped. Nothing was written.',
    fix: 'Send the slip again. A half parsed answer is how a wrong stake gets into a return figure for months.',
  },
  not_a_slip: {
    tag: 'NOT A SLIP',
    title: 'That does not look like a betting slip',
    message: 'No fields were read from it, so there was nothing to guess at.',
    fix: 'Send the slip itself: the bookmaker screen showing the selection, the stake and the price. A receipt, a screenshot of a tipster post or a photo of a television is not one.',
  },
  photo_of_screen: {
    tag: 'PHOTO OF A SCREEN',
    title: 'That is a photograph of a screen, not a screenshot',
    message: 'The glare and the moire across it make the price column unsafe to read, so nothing was read from it.',
    fix: 'Screenshot the slip on the device showing it. On an iPhone that is the side button and volume up; on Android it is power and volume down.',
  },
  stake_cropped: {
    tag: 'STAKE CUT OFF',
    title: 'The stake is off the edge of the image',
    message: 'Everything else was legible, and a bet with a guessed stake is worse than no bet at all, so nothing was written.',
    fix: 'Send it again with the whole slip in frame, including the stake line at the bottom. The crop step is where to check it.',
  },
  currency_mismatch: {
    tag: 'DIFFERENT CURRENCY',
    title: 'That slip is not in the currency of the balance you have open',
    /*  It said "your account currency" and pointed at Settings. A currency
        belongs to a BALANCE now and never changes for the life of one, so
        Settings is the wrong screen and changing it there is the wrong
        answer: it would rewrite the meaning of every figure already counted. */
    message: 'Nothing was written. Pounds and euros are never summed into one figure, and this reader does not convert one into the other.',
    fix: 'Switch to a balance kept in the slip’s own currency in the top bar and send it again. A converted stake would put an invented exchange rate into your return.',
  },
  trial_spent: {
    tag: 'TRIAL USED UP',
    title: 'The free trial has run out',
    message: 'No slip was read and nothing was charged. Your ledger, your export and your whole history stay exactly as they are.',
    fix: 'A plan is £3.49 a month or £29.99 a year and turns reading back on straight away. Typing a bet in works meanwhile and counts everywhere a read one does.',
  },
  read_only: {
    tag: 'READ ONLY',
    title: 'New slips are paused on this account',
    message: 'Two payments failed, so reading is paused. Nothing has been deleted and the ledger, the export and the history are all still live.',
    fix: 'Update the card and reading starts again on the next upload. Bets typed in still go into the ledger in the meantime.',
  },
  legs_missing: {
    tag: 'LEGS MISSING',
    title: 'Not every leg of that multiple was legible',
    message: 'A multiple read as fewer legs than it has prices a bet that does not exist, so the whole read was dropped.',
    fix: 'Send the slip again with every selection in frame, scrolled so none is cut off. A long accumulator often needs two screenshots, and each one can go in as its own read.',
  },
};

/** What the file picker will take, which is one list longer than what the
 *  reader takes. A HEIC never reaches the reader: the crop step re-encodes
 *  every image to JPEG before it is sent, so an iPhone photo only has to be
 *  decodable by the browser holding it. */
export const PICKABLE_TYPES = [...READABLE_TYPES, 'image/heic', 'image/heif'] as const;

/** The upload guards, in one place, so the browser refuses what the route
 *  refuses and says the same thing about it. The browser check saves an
 *  upload; the route check is the one that counts, because a client can be
 *  bypassed. */
export function checkUpload(file: { type?: string; size?: number; name?: string }): SlipRefusal | null {
  const size = file.size ?? 0;
  if (!size) return 'no_file';
  if (size > MAX_UPLOAD_BYTES) return 'too_large';
  return normaliseType(file.type ?? '', file.name ?? '') ? null : 'unsupported_type';
}

/** The same guards at the point of choosing, where HEIC is still allowed. */
export function checkPick(file: { type?: string; size?: number; name?: string }): SlipRefusal | null {
  const size = file.size ?? 0;
  if (!size) return 'no_file';
  if (size > MAX_UPLOAD_BYTES) return 'too_large';
  const t = (file.type ?? '').toLowerCase().split(';')[0].trim();
  if ((PICKABLE_TYPES as readonly string[]).includes(t === 'image/jpg' ? 'image/jpeg' : t)) return null;
  if (t) return 'unsupported_type';
  return /\.(png|jpe?g|webp|gif|heics?|heif|pdf)$/i.test(file.name ?? '') ? null : 'unsupported_type';
}

/** The media type the reader will be given, or null when it cannot take it.
 *
 *  A browser reports image/jpg, an empty string, or a type with a charset
 *  parameter on it depending on where the file came from, and the model API
 *  matches its media type exactly. HEIC is deliberately absent: see
 *  READABLE_TYPES. */
export function normaliseType(type: string, name = ''): string | null {
  const t = type.toLowerCase().split(';')[0].trim();
  const fixed = t === 'image/jpg' ? 'image/jpeg' : t;
  if ((READABLE_TYPES as readonly string[]).includes(fixed)) return fixed;
  if (fixed) return null;
  // No type at all, which is what a share sheet and some drag sources give.
  const ext = /\.([a-z0-9]+)$/i.exec(name)?.[1]?.toLowerCase();
  const byExt: Record<string, string> = {
    jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
    webp: 'image/webp', gif: 'image/gif', pdf: 'application/pdf',
  };
  return ext ? byExt[ext] ?? null : null;
}

export const EXAMPLE_READ: SlipRead = {
  id: 'read-1',
  bookmaker: 'bet365',
  bookmakerId: 'bet365',
  bookmakerConfidence: 'high',
  templateMatched: ['bet365', 'Bet Credits', 'Bet Receipt'],
  shape: 'Lucky 15',
  eachWay: false,
  stakeMinor: 100,
  stakeSaw: '15 x £1.00 unit stake',
  lines: 15,
  currency: 'GBP',
  placedAt: '30 Aug, 13:42',
  example: true,
  fields: [
    { key: 'stake', label: 'Stake per line', value: '£1.00', confidence: 'high', saw: '15 x £1.00 unit stake' },
    { key: 'lines', label: 'Lines', value: '15', confidence: 'high' },
    { key: 'placed', label: 'Placed', value: '30 Aug, 13:42', confidence: 'high' },
    {
      key: 'price', label: 'Total price', value: 'Per line, see legs', confidence: 'high',
      saw: 'Each line priced separately, which is what a Lucky 15 does',
    },
    {
      key: 'bonus', label: 'Bonus', value: '', confidence: 'medium',
      saw: 'BONUS 1/4 2x', options: ['Yes', 'No', 'Not sure'],
      question: 'bet365 doubles the odds on a single winner in a Lucky 15. Is that the offer on this slip?',
    },
    {
      key: 'rule4', label: 'Rule 4', value: '', confidence: 'missing',
      question: 'Nothing on this slip mentions a deduction. If one lands later you can add it as an event.',
    },
  ],
  legs: [
    { selection: 'Constitution Hill', fixture: '14:30 Cheltenham', odds: '2.50', market: 'Win', confidence: 'high' },
    { selection: 'State Man', fixture: '15:05 Leopardstown', odds: '3.75', market: 'Win', confidence: 'high' },
    { selection: 'Jonbon', fixture: '16:10 Punchestown', odds: '4.33', market: 'Win', confidence: 'medium' },
    { selection: 'Lossiemouth', fixture: '16:25 Newmarket', odds: '', market: 'Win', confidence: 'missing' },
  ],
  promotional: { freeBet: false, bonusFunds: false, boosted: false, saw: [] },
};

export const CONFIDENCE_COPY: Record<Confidence, { label: string; note: string }> = {
  high: { label: 'Read cleanly', note: 'Saved without asking. Nothing here was in doubt.' },
  medium: { label: 'One question', note: 'The reader saw something here and will not write it until you say it is right.' },
  low: { label: 'Held back', note: 'Read too poorly to use. Fill it in and it is yours, leave it and nothing is written.' },
  missing: { label: 'Not on the slip', note: 'Nothing was read here, so nothing was guessed.' },
};
