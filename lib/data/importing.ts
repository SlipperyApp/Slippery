/** The history import.
 *
 *  A dry run is the DEFAULT and it writes nothing. Anything that cannot be
 *  split reliably goes to a resolve step rather than being guessed at: a team
 *  or market name containing an ampersand is exactly the case that turned
 *  multiples into one row joined by "&" last time. */

export type DryRunCounts = {
  rowsRead: number;
  wouldCreate: number;
  wouldMerge: number;
  duplicateSkip: number;
  needsYou: number;
  unparseable: number;
};

export type Unresolved = {
  id: string;
  raw: string;
  why: string;
  /** The split the reader would guess at, offered but never applied silently. */
  suggestion: string[];
};

export const DRY_RUN: DryRunCounts = {
  rowsRead: 1284,
  wouldCreate: 1197,
  wouldMerge: 54,
  duplicateSkip: 19,
  needsYou: 14,
  unparseable: 0,
};

export const UNRESOLVED: Unresolved[] = [
  {
    id: 'u1',
    raw: 'Brighton & Hove Albion to win & Over 2.5 goals',
    why: 'Two ampersands, and one of them is inside a club name.',
    suggestion: ['Brighton & Hove Albion to win', 'Over 2.5 goals'],
  },
  {
    id: 'u2',
    raw: 'Both teams to score & win & Draw no bet',
    why: 'The first market contains the word the splitter uses.',
    suggestion: ['Both teams to score & win', 'Draw no bet'],
  },
  {
    id: 'u3',
    raw: 'Sheffield Wed & Sheffield Utd both to win',
    why: 'One selection about two teams, or two selections. It cannot be told from the text.',
    suggestion: ['Sheffield Wed & Sheffield Utd both to win'],
  },
  {
    id: 'u4',
    raw: 'Over 2.25 & Under 3.25',
    why: 'Two quarter lines in one string, each of which splits its own stake.',
    suggestion: ['Over 2.25', 'Under 3.25'],
  },
  {
    id: 'u5',
    raw: 'A. Isak anytime & Newcastle -1',
    why: 'A player market, which never grades from a feed, combined with a handicap.',
    suggestion: ['A. Isak anytime', 'Newcastle -1'],
  },
];

export const COLUMN_GUESSES: { theirs: string; ours: string; sure: boolean }[] = [
  { theirs: 'Date', ours: 'Kick-off (event_at)', sure: true },
  { theirs: 'Selection', ours: 'Selection', sure: true },
  { theirs: 'Stake', ours: 'Stake', sure: true },
  { theirs: 'Odds', ours: 'Price, decimal', sure: true },
  { theirs: 'Bookie', ours: 'Bookmaker', sure: true },
  { theirs: 'Result', ours: 'First settlement event', sure: true },
  { theirs: 'Returns', ours: 'Returned', sure: true },
  { theirs: 'Notes', ours: 'Note', sure: true },
  { theirs: 'Tipster', ours: 'Tipster', sure: false },
  { theirs: 'Comp', ours: 'Competition', sure: false },
];

/* ======================================================================
   BOOKMAKER TEMPLATE DETECTION

   THE TEMPLATE IS DECIDED BEFORE THE SLIP IS READ, and this is the whole
   reason it is a separate function with a table behind it.

   Generic text recognition falls over on a permed bet. A Lucky 15 is one
   stake, four selections and fifteen lines, and every bookmaker lays that
   out differently: bet365 prints "15 x £1.00" beside a total, Paddy Power
   prints a unit stake and a line count in two different places, Sky Bet
   prints each of the four selections with its own price and no line count at
   all. Read left to right without knowing whose slip it is and the stake
   comes out fifteen times too big, or fifteen times too small, and both of
   those sit in a return figure for months.

   A WRONG TEMPLATE IS WORSE THAN NO TEMPLATE, which is the same rule the
   settlement engine runs on. So:

     - A template can only win if one of its BRAND signatures fired. Every
       other signature in the table is a feature name or a piece of layout
       wording, and none of those is worth anything on its own: "Cash Out",
       "Bet Slip" and "To Return" are on nine slips out of ten, and a table
       that let them decide would confidently return the wrong book for a
       cropped screenshot with no logo in frame.
     - A template has to beat the runner up by a MARGIN. Two books scoring
       within a point of each other is a slip that could be either, and the
       honest answer to that is "unknown".
     - Below the floor, or inside the margin, it returns 'unknown' with the
       evidence attached. Unknown costs one question on the review screen.
       Wrong costs a settled bet against the wrong handicap convention.

   Nothing here reads an image or calls a model. It is a pure function over
   text, so it is testable without a key and it runs the same way over a
   slip read, a pasted bet and an imported CSV row. */

export type TemplateConfidence = 'high' | 'medium' | 'low';

/** What a signature is evidence OF, which is also what it is worth.
 *
 *  brand    the bookmaker's own name or wordmark. Nothing wins without one.
 *  feature  a product only that bookmaker has: Bet Credits, Acca Freeze,
 *           Connect card. Strong, because nobody else prints them.
 *  layout   wording that book's template uses. Weak on its own and useful
 *           for separating two books that share a brand word. */
export type SignatureKind = 'brand' | 'feature' | 'layout';

const WEIGHT: Record<SignatureKind, number> = { brand: 5, feature: 3, layout: 1 };

export type Signature = { kind: SignatureKind; pattern: RegExp; label: string };

export type BookmakerTemplate = {
  /** The id in lib/data/reference.ts. The detector and the ledger have to
   *  agree on what a bookmaker is called or the bet is filed under a name
   *  nothing else uses. */
  id: string;
  name: string;
  signatures: Signature[];
};

/*  Ten books, and one more.
 *
 *  Betfair Exchange is here beside Betfair Sportsbook because they are two
 *  templates and, more to the point, two different products: the Exchange
 *  charges commission on net winnings and the Sportsbook does not, so filing
 *  one as the other reports every winner about two per cent high. The
 *  Exchange's own words are the discriminator, and a slip that says nothing
 *  but "Betfair" scores the same for both and comes back unknown, which is
 *  the true answer to a slip that does not say. */
export const BOOKMAKER_TEMPLATES: BookmakerTemplate[] = [
  {
    id: 'bet365', name: 'bet365',
    signatures: [
      { kind: 'brand', pattern: /\bbet\s?365\b/i, label: 'bet365' },
      { kind: 'feature', pattern: /\bbet\s?credits?\b/i, label: 'Bet Credits' },
      { kind: 'feature', pattern: /\beuro\s?bonus\b/i, label: 'Euro Bonus' },
      { kind: 'layout', pattern: /\bbet receipt\b/i, label: 'Bet Receipt' },
      { kind: 'layout', pattern: /\bedit bet\b/i, label: 'Edit Bet' },
      { kind: 'layout', pattern: /\bto return\b/i, label: 'To Return' },
    ],
  },
  {
    id: 'paddy-power', name: 'Paddy Power',
    signatures: [
      { kind: 'brand', pattern: /\bpaddy\s?power\b/i, label: 'Paddy Power' },
      { kind: 'feature', pattern: /\bpaddy'?s rewards club\b/i, label: "Paddy's Rewards Club" },
      { kind: 'feature', pattern: /\bpower price\b/i, label: 'Power Price' },
      { kind: 'layout', pattern: /\breceipt (?:no|number)\b/i, label: 'Receipt No' },
      { kind: 'layout', pattern: /\bbet ?slip\b/i, label: 'Bet Slip' },
    ],
  },
  {
    id: 'betfair', name: 'Betfair Sportsbook',
    signatures: [
      { kind: 'brand', pattern: /\bbetfair\b/i, label: 'Betfair' },
      { kind: 'feature', pattern: /\bsportsbook\b/i, label: 'Sportsbook' },
      { kind: 'feature', pattern: /\bprice rush\b/i, label: 'Price Rush' },
      { kind: 'layout', pattern: /\bbet ?slip\b/i, label: 'Bet Slip' },
    ],
  },
  {
    id: 'betfair-exchange', name: 'Betfair Exchange',
    signatures: [
      { kind: 'brand', pattern: /\bbetfair\b/i, label: 'Betfair' },
      { kind: 'feature', pattern: /\bexchange\b/i, label: 'Exchange' },
      { kind: 'feature', pattern: /\bunmatched\b/i, label: 'Unmatched' },
      { kind: 'layout', pattern: /\bliability\b/i, label: 'Liability' },
      { kind: 'layout', pattern: /\bmatched at\b/i, label: 'Matched at' },
      { kind: 'layout', pattern: /\bcommission\b/i, label: 'Commission' },
    ],
  },
  {
    id: 'sky-bet', name: 'Sky Bet',
    signatures: [
      { kind: 'brand', pattern: /\bsky\s?bet\b/i, label: 'Sky Bet' },
      { kind: 'feature', pattern: /\bacca freeze\b/i, label: 'Acca Freeze' },
      { kind: 'feature', pattern: /\brequest ?a ?bet\b/i, label: 'RequestABet' },
      { kind: 'layout', pattern: /\bbet ?boost\b/i, label: 'Bet Boost' },
      { kind: 'layout', pattern: /\bbet id\b/i, label: 'Bet ID' },
    ],
  },
  {
    id: 'william-hill', name: 'William Hill',
    signatures: [
      { kind: 'brand', pattern: /\bwilliam\s?hill\b/i, label: 'William Hill' },
      { kind: 'feature', pattern: /\bepic boost\b/i, label: 'Epic Boost' },
      { kind: 'layout', pattern: /\bcoupon (?:no|number|code)\b/i, label: 'Coupon No' },
      { kind: 'layout', pattern: /\byour bet\b/i, label: 'Your Bet' },
    ],
  },
  {
    id: 'ladbrokes', name: 'Ladbrokes',
    signatures: [
      { kind: 'brand', pattern: /\bladbrokes\b/i, label: 'Ladbrokes' },
      { kind: 'feature', pattern: /\bgrid\b/i, label: 'Grid' },
      { kind: 'layout', pattern: /\bodds boost\b/i, label: 'Odds Boost' },
      { kind: 'layout', pattern: /\bbet reference\b/i, label: 'Bet Reference' },
    ],
  },
  {
    id: 'coral', name: 'Coral',
    signatures: [
      { kind: 'brand', pattern: /\bcoral\b/i, label: 'Coral' },
      { kind: 'feature', pattern: /\bconnect card\b/i, label: 'Connect card' },
      { kind: 'layout', pattern: /\bodds boost\b/i, label: 'Odds Boost' },
      { kind: 'layout', pattern: /\bbet reference\b/i, label: 'Bet Reference' },
    ],
  },
  {
    id: 'boylesports', name: 'BoyleSports',
    signatures: [
      { kind: 'brand', pattern: /\bboyle\s?sports\b/i, label: 'BoyleSports' },
      { kind: 'feature', pattern: /\bmoney back special\b/i, label: 'Money Back Special' },
      { kind: 'feature', pattern: /\bboyle ?bets\b/i, label: 'BoyleBets' },
      { kind: 'layout', pattern: /\bdocket\b/i, label: 'Docket' },
    ],
  },
  {
    id: 'bet-victor', name: 'BetVictor',
    signatures: [
      { kind: 'brand', pattern: /\bbet\s?victor\b/i, label: 'BetVictor' },
      { kind: 'feature', pattern: /\bprice promise\b/i, label: 'Price Promise' },
      { kind: 'layout', pattern: /\bbet ref\b/i, label: 'Bet Ref' },
      { kind: 'layout', pattern: /\bstake per line\b/i, label: 'Stake per line' },
    ],
  },
  {
    id: 'unibet', name: 'Unibet',
    signatures: [
      { kind: 'brand', pattern: /\bunibet\b/i, label: 'Unibet' },
      { kind: 'feature', pattern: /\bkambi\b/i, label: 'Kambi' },
      { kind: 'feature', pattern: /\bmoney ?back\+?\b/i, label: 'Money Back+' },
      { kind: 'layout', pattern: /\bcombo\b/i, label: 'Combo' },
      { kind: 'layout', pattern: /\bbet ?builder\b/i, label: 'Bet Builder' },
    ],
  },
];

export type TemplateMatch = {
  /** The reference id, or 'unknown'. Never a guess. */
  bookmakerId: string;
  /** What to print. "Unknown" rather than an empty string, because a blank
   *  where a bookmaker should be reads as a bug. */
  name: string;
  confidence: TemplateConfidence;
  /** What fired, in order, so a failure can be read rather than guessed at.
   *  It is the evidence for the answer and it is shown on the review screen
   *  when the answer is a question. */
  matched: string[];
  score: number;
  /** The book that came second and by how much it lost. Null when nothing
   *  else scored at all. A near miss is the case worth looking at. */
  runnerUp: { bookmakerId: string; score: number } | null;
};

/** The floor. One brand hit alone clears it, and nothing else does: two
 *  layout words and no name is a slip whose logo is out of frame. */
export const TEMPLATE_FLOOR = WEIGHT.brand;

/** How far clear the winner has to be. A book that beats the next one by a
 *  single layout word did not beat it. */
export const TEMPLATE_MARGIN = 2;

const UNKNOWN: TemplateMatch = {
  bookmakerId: 'unknown', name: 'Unknown', confidence: 'low',
  matched: [], score: 0, runnerUp: null,
};

/** Which bookmaker's template this text came off.
 *
 *  Pure, and it never guesses. See the block above for why the brand rule and
 *  the margin rule are both there. */
export function detectTemplate(text: unknown): TemplateMatch {
  if (typeof text !== 'string' || !text.trim()) return UNKNOWN;

  const scored = BOOKMAKER_TEMPLATES.map((t) => {
    const hits = t.signatures.filter((s) => s.pattern.test(text));
    /*  No brand, no score. Every feature and layout word in this table is
        worth nothing without a name beside it, because the cost of being
        wrong is a bet settled under the wrong handicap convention and the
        cost of being unsure is one question. */
    const branded = hits.some((s) => s.kind === 'brand');
    return {
      id: t.id,
      name: t.name,
      matched: hits.map((s) => s.label),
      score: branded ? hits.reduce((a, s) => a + WEIGHT[s.kind], 0) : 0,
    };
  }).sort((a, b) => b.score - a.score);

  const best = scored[0];
  const second = scored[1];
  if (!best || best.score < TEMPLATE_FLOOR) return UNKNOWN;

  const runnerUp = second && second.score > 0
    ? { bookmakerId: second.id, score: second.score }
    : null;

  const margin = best.score - (second?.score ?? 0);
  if (margin < TEMPLATE_MARGIN) {
    /*  Two books this close is a slip that could be either. It comes back
        unknown WITH the evidence, so the review screen can say what it saw
        rather than shrugging. */
    return { ...UNKNOWN, matched: best.matched, runnerUp };
  }

  /*  High needs a name AND something only that book prints. A brand word on
      its own is a slip whose logo was legible and nothing else was, which is
      worth saving and not worth saving silently. */
  const confidence: TemplateConfidence = best.score >= WEIGHT.brand + WEIGHT.feature ? 'high' : 'medium';

  return {
    bookmakerId: best.id,
    name: best.name,
    confidence,
    matched: best.matched,
    score: best.score,
    runnerUp,
  };
}
