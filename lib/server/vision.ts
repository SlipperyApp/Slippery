/** Slip reading through the vision model.
 *
 *  VISION_API_KEY and ANTHROPIC_API_KEY are the same kind of key and the
 *  fallback between them is deliberate, so a rename cannot take reading down.
 *  The key is read here and goes into one request header. It is never
 *  logged, never returned in a message and never written to a file.
 *
 *  THE RULE THIS MODULE EXISTS TO ENFORCE: a wrong read is worse than no
 *  read. The model is asked to report what it can SEE and to say "not
 *  legible" rather than infer, and then it is not believed on its own word.
 *  Everything it returns goes through `normaliseRead` below, which drops any
 *  number it did not also quote verbatim off the slip. A missing price is
 *  visible to the person confirming it; a wrong one is not, and a wrong one
 *  sits in a return figure for months. */

import { visionKey } from './env';
import { parseMoneyMinor } from '@/lib/format';
import { fromFractional } from '@/lib/odds';
import type { Currency } from '@/lib/domain/types';
import type { Confidence, ReadField, ReadLeg, SlipRead, SlipRefusal } from '@/lib/data/read';
import { detectTemplate, type TemplateMatch } from '@/lib/data/importing';

export function readerReady(): boolean {
  return Boolean(visionKey());
}

const MODEL = 'claude-sonnet-5';

const SYSTEM = [
  'You read betting slips from UK and Irish bookmakers and return structured fields.',
  '',
  'Rules you must not break:',
  '1. Report only what is legible on the image. If a field is not legible, return null for it and add its name to notLegible. Never infer a price, a stake or a date from context.',
  '2. Quote every amount and every price verbatim as it is printed, in stakeText and oddsText, separately from the numbers. If you cannot quote it off the image, it is not legible.',
  '3. Identify the bookmaker from the slip layout and branding, and say how sure you are.',
  '3b. Return in slipText every word of chrome on the slip verbatim: the header, the wordmark, the reference or receipt line, the footer and any button or promotion wording. Not the selections and not the prices, which you return separately. Transcribe it, do not summarise it.',
  '4. Identify the bet type exactly: single, double, treble, accumulator, each way, Trixie, Patent, Yankee, Lucky 15, Canadian, Lucky 31, Heinz, Lucky 63, Goliath, bet builder, or unknown. Each way is also a flag, because an each way treble is both.',
  '5. A permed bet has one stake per line and several selections. Report the stake per line and every selection separately.',
  '6. Score confidence per field, never for the slip as a whole.',
  '7. Set capture to photo_of_screen when the image is a camera photograph of a phone or monitor rather than a screenshot: look for moire, glare, a bezel, keystoned edges or a visible reflection.',
  '8. List in cutOff the name of any field whose row runs off the edge of the image, even partly.',
  '9. If the image is not a betting slip, set isSlip to false and return nothing else.',
  '',
  'Return JSON only, with no prose around it.',
].join('\n');

const SCHEMA = [
  '{"isSlip":bool,"capture":"screenshot|photo_of_screen|photo_of_paper|unknown",',
  '"bookmaker":str|null,"bookmakerConfidence":"high|medium|low","slipText":str|null,"shape":str|null,',
  '"stakeText":str|null,"stakePence":int|null,"currency":"GBP|EUR"|null,"placedAt":str|null,',
  '"isFreeBet":bool,"isBoosted":bool,"isEachWay":bool,"ewTerms":str|null,',
  '"legs":[{"selection":str|null,"eventName":str|null,"marketRaw":str|null,',
  '"oddsText":str|null,"odds":number|null,"confidence":"high|medium|low"}],',
  '"notLegible":[str],"cutOff":[str]}',
].join('');

export type ModelConfidence = 'high' | 'medium' | 'low';

export type VisionLeg = {
  selection: string | null;
  eventName: string | null;
  marketRaw: string | null;
  odds: number | null;
  oddsText: string | null;
  confidence: ModelConfidence;
};

export type VisionResult = {
  isSlip: boolean;
  capture: 'screenshot' | 'photo_of_screen' | 'photo_of_paper' | 'unknown';
  bookmaker: string | null;
  bookmakerConfidence: ModelConfidence;
  /** WHICH BOOKMAKER'S TEMPLATE THIS IS, from the signature table in
   *  lib/data/importing.ts rather than from the model's own prose. The model
   *  is asked what it sees and is not believed on its own word anywhere else
   *  in this module, and a bookmaker is the field it is least safe to believe
   *  on: whether a whole handicap line pushes or loses differs by book, so a
   *  wrong one is a wrongly graded bet rather than a cosmetic slip. */
  template: TemplateMatch;
  /** The canonical shape id, or null when the slip did not say. */
  shape: string | null;
  shapeLabel: string | null;
  /** Integer minor units PER LINE, and null unless it was quoted verbatim. */
  stakePence: number | null;
  stakeText: string | null;
  /** How many bets the perm is. The stake above is multiplied by it. */
  lines: number;
  currency: Currency | null;
  placedAt: string | null;
  isFreeBet: boolean;
  isBoosted: boolean;
  isEachWay: boolean;
  ewTerms: string | null;
  legs: VisionLeg[];
  notLegible: string[];
  cutOff: string[];
};

/** What the model charged for one read.
 *
 *  A slip read is the one call in this product that costs money per use, and
 *  there was no cost telemetry anywhere in the repository: nobody could say
 *  what a heavy account costs, against a pricing page that promises unlimited
 *  slips. The counts come straight off the API's own usage block and are
 *  stored against the account by /api/extract. */
export type ReadCost = { inputTokens: number; outputTokens: number; model: string };

export type ReadOutcome =
  | { ok: true; result: VisionResult; cost?: ReadCost }
  | { ok: false; reason: SlipRefusal; detail?: string; cost?: ReadCost };

/*  ------------------------------------------------------------------ shapes
 *
 *  Legs is the MINIMUM the shape can have: an accumulator is four or more.
 *  Lines is how many bets the perm is, which is what the stake is multiplied
 *  by, and getting it from a table rather than a formula is deliberate. A
 *  Lucky 15 is fifteen lines and a Yankee is eleven from the same four
 *  selections, and the difference is the four singles rather than anything
 *  derivable from the count. */
type ShapeSpec = { id: string; label: string; legs: number; lines: number };

const SHAPES: ShapeSpec[] = [
  { id: 'single', label: 'Single', legs: 1, lines: 1 },
  { id: 'double', label: 'Double', legs: 2, lines: 1 },
  { id: 'treble', label: 'Treble', legs: 3, lines: 1 },
  { id: 'accumulator', label: 'Accumulator', legs: 4, lines: 1 },
  { id: 'bet_builder', label: 'Bet builder', legs: 2, lines: 1 },
  { id: 'trixie', label: 'Trixie', legs: 3, lines: 4 },
  { id: 'patent', label: 'Patent', legs: 3, lines: 7 },
  { id: 'yankee', label: 'Yankee', legs: 4, lines: 11 },
  { id: 'lucky15', label: 'Lucky 15', legs: 4, lines: 15 },
  { id: 'canadian', label: 'Canadian', legs: 5, lines: 26 },
  { id: 'lucky31', label: 'Lucky 31', legs: 5, lines: 31 },
  { id: 'heinz', label: 'Heinz', legs: 6, lines: 57 },
  { id: 'lucky63', label: 'Lucky 63', legs: 6, lines: 63 },
  { id: 'goliath', label: 'Goliath', legs: 8, lines: 247 },
];

const ALIASES: Record<string, string> = {
  acca: 'accumulator', accum: 'accumulator', fourfold: 'accumulator',
  fivefold: 'accumulator', sixfold: 'accumulator', multiple: 'accumulator',
  multi: 'accumulator', parlay: 'accumulator',
  betbuilder: 'bet_builder', samegamemulti: 'bet_builder', sgm: 'bet_builder',
  lucky_15: 'lucky15', lucky_31: 'lucky31', lucky_63: 'lucky63',
  win: 'single', winsingle: 'single', straight: 'single',
};

export function shapeFor(raw: unknown): ShapeSpec | null {
  if (typeof raw !== 'string') return null;
  const key = raw.toLowerCase().replace(/[^a-z0-9]/g, '');
  const direct = SHAPES.find((s) => s.id.replace(/[^a-z0-9]/g, '') === key);
  if (direct) return direct;
  const alias = ALIASES[key];
  return alias ? SHAPES.find((s) => s.id === alias) ?? null : null;
}

/*  -------------------------------------------------------------- normalising
 *
 *  Nothing below trusts the model's own summary of itself. */

/** Anything that is not one of the three scores is LOW, not high.
 *
 *  A model that answers "very high", "certain" or nothing at all would
 *  otherwise fall through a `=== 'low'` check and be treated as read cleanly,
 *  which is the one direction this product may never fail in. */
export function asConfidence(v: unknown): ModelConfidence {
  return v === 'high' || v === 'medium' ? v : 'low';
}

const text = (v: unknown): string | null => {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t && !/^(null|undefined|n\/a|unknown|not legible)$/i.test(t) ? t : null;
};

const list = (v: unknown): string[] =>
  (Array.isArray(v) ? v : []).map((x) => (typeof x === 'string' ? x.trim().toLowerCase() : '')).filter(Boolean);

/** Decimal odds from the text a slip actually prints, which is fractional in
 *  half of this market. SP is not a price yet, so it comes back as nothing
 *  rather than as a number to be settled against. */
export function oddsFromText(raw: unknown): number | null {
  const t = text(raw);
  if (!t) return null;
  if (/^(sp|s\.p\.|starting price)$/i.test(t)) return null;
  const frac = fromFractional(t);
  if (frac !== null) return frac;
  const dec = Number(t.replace(/[^\d.]/g, ''));
  if (!Number.isFinite(dec) || dec <= 1 || dec > 1001) return null;
  return Number(dec.toFixed(4));
}

const CLOSE = (a: number, b: number) => Math.abs(a - b) <= 0.011;

export type ReadContext = { accountCurrency: Currency };

/** The model's answer, checked against itself.
 *
 *  Exported because it is the whole of the honesty and it is where the tests
 *  live. The reader's network call is untestable without a key; this is not,
 *  and this is the part that decides what reaches a ledger. */
export function normaliseRead(raw: unknown, ctx: ReadContext): ReadOutcome {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ok: false, reason: 'unparsable' };
  const r = raw as Record<string, unknown>;

  if (r.isSlip !== true) return { ok: false, reason: 'not_a_slip' };
  if (r.capture === 'photo_of_screen') return { ok: false, reason: 'photo_of_screen' };

  const notLegible = new Set(list(r.notLegible));
  const cutOff = list(r.cutOff);

  /*  THE TEMPLATE IS DECIDED FIRST, BEFORE ANY FIELD IS PARSED.
   *
   *  That order is the point of it. Generic reading falls over on a permed
   *  bet, where the same three numbers mean a stake per line, a line count
   *  and a total in an order that differs per bookmaker, so which book it is
   *  has to be known before any of them is believed.
   *
   *  It reads a signature table over the text rather than the model's answer
   *  to "which bookmaker is this". Nothing else in this module believes the
   *  model on its own word, and a bookmaker is the field it is least safe to
   *  believe on: whether a whole handicap line pushes or loses differs by
   *  book, so a wrong one is a wrongly graded bet rather than a cosmetic
   *  slip. It returns unknown rather than guessing, and unknown costs one
   *  question on the review screen.
   *
   *  ONLY TRANSCRIBED TEXT GOES IN. The model's answer to "which bookmaker is
   *  this" is a conclusion, not a quotation, and a conclusion is exactly what
   *  this module refuses to score anywhere else: a model that infers bet365
   *  from a Premier League fixture and marks itself high would otherwise
   *  hand its own guess back to the table as a brand hit and have it
   *  confirmed. What goes in is what it says it SAW, including the raw
   *  selections, because a slip whose header was cropped out of frame still
   *  carries the book's own wording further down. */
  const template = detectTemplate([
    text(r.slipText) ?? '',
    text(r.stakeText) ?? '',
    text(r.ewTerms) ?? '',
    (Array.isArray(r.legs) ? r.legs : [])
      .map((x) => {
        const l = (x && typeof x === 'object' ? x : {}) as Record<string, unknown>;
        return [text(l.selection), text(l.eventName), text(l.marketRaw)].filter(Boolean).join(' ');
      })
      .join(' '),
  ].join(' \n '));

  const spec = shapeFor(r.shape);
  const isEachWay = r.isEachWay === true;

  /*  Legs. A price the model scored LOW never becomes a number, and neither
   *  does one it reported without quoting: the quoted text is parsed here and
   *  the model's own number is only accepted when the two agree. A slip that
   *  says 6/4 and a model that says 2.4 is not a rounding difference, it is a
   *  misread column. */
  const rawLegs = Array.isArray(r.legs) ? r.legs : [];
  const legs: VisionLeg[] = rawLegs.map((x) => {
    const l = (x && typeof x === 'object' ? x : {}) as Record<string, unknown>;
    const confidence = asConfidence(l.confidence);
    const oddsText = text(l.oddsText);
    const seen = oddsFromText(oddsText);
    const claimed = typeof l.odds === 'number' && Number.isFinite(l.odds) && l.odds > 1 ? l.odds : null;
    const agreed = seen !== null && (claimed === null || CLOSE(seen, claimed));
    return {
      selection: text(l.selection),
      eventName: text(l.eventName),
      marketRaw: text(l.marketRaw),
      oddsText,
      odds: confidence === 'low' || !agreed ? null : seen,
      confidence: (agreed && confidence !== 'low' ? confidence : 'low') as ModelConfidence,
    };
  }).filter((l) => l.selection || l.oddsText);

  const named = legs.filter((l) => l.selection);

  /*  A multiple that read short is REFUSED rather than written as a shorter
   *  multiple. A treble read as a double prices a bet that does not exist and
   *  then grades it, and the person confirming has no way to see the leg that
   *  is not on the screen. */
  const wanted = spec?.legs ?? 1;
  if (wanted > 1 && named.length < wanted) {
    return {
      ok: false,
      reason: 'legs_missing',
      detail: `${spec?.label ?? 'That multiple'} needs ${wanted} selections and ${named.length} came off the image.`,
    };
  }
  if (!spec && named.length > 1 && named.length < rawLegs.length) {
    return { ok: false, reason: 'legs_missing', detail: 'Some selections on that multiple were not legible.' };
  }

  /*  The stake. It comes off the printed text or it is a question. The
   *  model's own stakePence is accepted only as a cross check, because a
   *  number nobody can point at on the image is exactly the guess this
   *  product refuses to write. */
  const stakeText = text(r.stakeText);
  const parsed = parseMoneyMinor(stakeText);
  const claimedMinor = Number.isSafeInteger(r.stakePence) && (r.stakePence as number) > 0
    ? (r.stakePence as number) : null;
  const stakeAgrees = parsed !== null && (claimedMinor === null || claimedMinor === parsed.minor);
  const stakePence = stakeAgrees && !notLegible.has('stake') ? parsed.minor : null;

  if (stakePence === null && cutOff.some((f) => f.includes('stake'))) {
    return { ok: false, reason: 'stake_cropped' };
  }
  if (stakePence === null) notLegible.add('stake');

  /*  Currency. Only ever the one printed on the slip, and a slip in another
   *  one is refused whole. Converting it would put an invented rate into a
   *  return figure, and summing it would add pounds to euros. */
  const currency: Currency | null = parsed?.currency
    ?? (r.currency === 'GBP' || r.currency === 'EUR' ? r.currency : null);
  if (currency && currency !== ctx.accountCurrency) {
    return {
      ok: false,
      reason: 'currency_mismatch',
      detail: `The slip is in ${currency} and the account is in ${ctx.accountCurrency}.`,
    };
  }

  const ewTerms = text(r.ewTerms);
  if (isEachWay && !ewTerms) notLegible.add('ewterms');
  for (const l of legs) if (l.odds === null) notLegible.add('odds');
  if (!text(r.placedAt)) notLegible.add('placed');

  const lines = (spec?.lines ?? 1) * (isEachWay ? 2 : 1);

  return {
    ok: true,
    result: {
      isSlip: true,
      capture: r.capture === 'photo_of_paper' || r.capture === 'screenshot' ? r.capture : 'unknown',
      /*  The template's own name wins over the model's prose when the table
       *  recognised the slip. "bet 365", "Bet365 Sport" and "bet365" are one
       *  bookmaker and the ledger has one id for it; a display string that
       *  differs per read is a breakdown row per spelling. */
      bookmaker: template.bookmakerId === 'unknown' ? text(r.bookmaker) : template.name,
      /*  And the confidence is the TABLE'S, not the model's. A model that
       *  says "high" about a bookmaker it inferred from a football fixture is
       *  the exact failure normaliseRead exists to catch. */
      bookmakerConfidence: template.bookmakerId === 'unknown'
        ? 'low'
        : template.confidence,
      template,
      shape: spec?.id ?? null,
      shapeLabel: spec?.label ?? null,
      stakePence,
      stakeText,
      lines,
      currency,
      placedAt: text(r.placedAt),
      isFreeBet: r.isFreeBet === true,
      isBoosted: r.isBoosted === true,
      isEachWay,
      ewTerms,
      legs,
      notLegible: [...notLegible],
      cutOff,
    },
  };
}

/*  ---------------------------------------------------------------- the call */

/** The media type the model is given, or null when it cannot take one. It is
 *  checked before the request rather than after, so an unreadable file costs
 *  nothing and comes back with its own message instead of a refusal from the
 *  far end that reads like an outage. */
export function contentBlockFor(imageBase64: string, mediaType: string): Record<string, unknown> | null {
  if (mediaType === 'application/pdf') {
    return { type: 'document', source: { type: 'base64', media_type: mediaType, data: imageBase64 } };
  }
  if (['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(mediaType)) {
    return { type: 'image', source: { type: 'base64', media_type: mediaType, data: imageBase64 } };
  }
  return null;
}

export async function readSlip(imageBase64: string, mediaType: string, ctx: ReadContext): Promise<ReadOutcome> {
  const key = visionKey();
  if (!key) return { ok: false, reason: 'not_configured' };

  const block = contentBlockFor(imageBase64, mediaType);
  if (!block) return { ok: false, reason: 'unsupported_type' };

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 2000,
        system: SYSTEM,
        messages: [{
          role: 'user',
          content: [block, { type: 'text', text: `Read this slip. JSON only, in this shape: ${SCHEMA}` }],
        }],
      }),
      signal: AbortSignal.timeout(45_000),
    });

    if (!res.ok) return { ok: false, reason: 'refused' };
    const body = (await res.json()) as {
      content?: { type: string; text?: string }[];
      usage?: { input_tokens?: number; output_tokens?: number };
    };
    /*  What this call cost, carried out with the answer. A read that is
        charged for and then fails to parse still cost money, so the counts
        ride on the refusal as well as on the result. */
    const cost: ReadCost = {
      inputTokens: Math.max(0, Number(body.usage?.input_tokens) || 0),
      outputTokens: Math.max(0, Number(body.usage?.output_tokens) || 0),
      model: MODEL,
    };
    const answer = body.content?.find((c) => c.type === 'text')?.text ?? '';
    const start = answer.indexOf('{');
    const end = answer.lastIndexOf('}');
    if (start === -1 || end <= start) return { ok: false, reason: 'unparsable', cost };
    let parsed: unknown;
    try {
      parsed = JSON.parse(answer.slice(start, end + 1));
    } catch {
      // Half an answer is not half a bet. The whole read is dropped.
      return { ok: false, reason: 'unparsable', cost };
    }
    const out = normaliseRead(parsed, ctx);
    return out.ok ? { ...out, cost } : { ...out, cost };
  } catch {
    return { ok: false, reason: 'unreachable' };
  }
}

/*  ------------------------------------------------------------ to the screen
 *
 *  A field the model marked as not legible is never filled in from a guess,
 *  and neither is one it was not confident about. `value` stays EMPTY and a
 *  question goes with it, because a box that already holds a plausible number
 *  is a box nobody rereads. */

function field(
  key: string, label: string, value: string | null, confidence: Confidence,
  extra: { saw?: string | null; question?: string; required?: boolean } = {},
): ReadField {
  /*  No value means missing, whatever the model scored it. A field cannot be
   *  read cleanly and also be empty, and that combination shipped as a tick
   *  beside a blank. */
  const conf: Confidence = value ? confidence : 'missing';
  /*  The question goes on whenever the field is NOT read cleanly, rather than
   *  being decided at each call site. Deciding it per field is how a missing
   *  bookmaker shipped as a blank row with a dash beside it and nothing to
   *  answer: the caller checked the model's score, and the model had scored a
   *  field it never read. */
  return {
    key,
    label,
    value: conf === 'high' && value ? value : '',
    confidence: conf,
    ...(extra.saw ? { saw: extra.saw } : {}),
    ...(conf !== 'high' && extra.question ? { question: extra.question } : {}),
    ...(extra.required ? { required: true } : {}),
  };
}

export function toFields(v: VisionResult, currency: Currency = 'GBP'): ReadField[] {
  const missing = new Set(v.notLegible ?? []);
  const symbol = currency === 'EUR' ? '€' : '£';
  const stakeKnown = v.stakePence !== null;

  const out: ReadField[] = [
    /*  The evidence travels with the question. "Nothing was recognised" and
     *  "two books matched and neither won" send somebody to do different
     *  things, and a bare question tells them apart from neither. */
    field('bookmaker', 'Bookmaker', v.bookmaker, v.bookmakerConfidence, {
      saw: v.template.matched.length ? v.template.matched.join(', ') : null,
      question: 'Which bookmaker is this? Whether a whole handicap line pushes or loses differs by book, so it is not cosmetic.',
      required: true,
    }),
    field('shape', 'Bet type', v.shapeLabel, 'high', {
      question: 'What kind of bet is this? A perm is priced per line, so the count changes the stake.',
      required: true,
    }),
    field(
      'stake',
      v.lines > 1 ? 'Stake per line' : 'Stake',
      stakeKnown ? `${symbol}${(v.stakePence as number / 100).toFixed(2)}` : null,
      'high',
      {
        saw: v.stakeText,
        question: 'What is the stake on this slip, per line? Nothing was read here and nothing has been guessed.',
        required: true,
      },
    ),
    field('placed', 'Placed', missing.has('placed') ? null : v.placedAt, 'high', {
      question: 'When was it placed? Leave it and the time you sent it is used, which is what the ledger records anyway.',
    }),
  ];

  if (v.lines > 1) {
    out.push(field('lines', 'Lines', String(v.lines), 'high', {
      saw: `${v.shapeLabel ?? 'This perm'} is ${v.lines} bets, so the stake above is multiplied by ${v.lines}`,
    }));
  }
  if (v.isEachWay) {
    out.push(field('ewterms', 'Each way terms', v.ewTerms, 'high', {
      question: 'What are the place terms? A fifth the odds and a quarter the odds settle to different money, so this is not guessed.',
      required: true,
    }));
  }
  if (v.shape === 'bet_builder') {
    /*  Not a question. It is a statement of how this one settles, and the
     *  place to make it is here, at ingestion, rather than three weeks later
     *  when the bet is sitting unsettled and nobody remembers why. */
    out.push(field('builder', 'Bet builder', 'You grade this one', 'high', {
      saw: 'Priced as one selection, and never settled from a feed',
    }));
  }
  return out;
}

export function toLegs(v: VisionResult): ReadLeg[] {
  return v.legs.map((l) => ({
    selection: l.selection ?? '',
    fixture: l.eventName ?? '',
    odds: l.odds === null ? '' : l.odds.toFixed(2),
    market: l.marketRaw ?? 'Match result',
    confidence: l.odds === null ? (l.oddsText ? 'low' : 'missing') : l.confidence,
    ...(l.oddsText && l.odds === null ? { saw: l.oddsText } : {}),
  }));
}

/** The reader's answer as the review screen takes it. */
export function toRead(v: VisionResult, opts: { id: string; currency: Currency }): SlipRead {
  return {
    id: opts.id,
    bookmaker: v.bookmaker ?? '',
    bookmakerId: v.template.bookmakerId,
    bookmakerConfidence: v.bookmakerConfidence,
    templateMatched: v.template.matched,
    shape: v.shapeLabel ?? 'Unknown',
    eachWay: v.isEachWay,
    stakeMinor: v.stakePence,
    stakeSaw: v.stakeText,
    lines: v.lines,
    currency: v.currency ?? opts.currency,
    placedAt: v.placedAt,
    fields: toFields(v, opts.currency),
    legs: toLegs(v),
    promotional: { freeBet: v.isFreeBet, boosted: v.isBoosted, bonusFunds: false },
  };
}
