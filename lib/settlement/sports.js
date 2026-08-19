/* Which sport is this bet?
 *
 * The settlement engine was written for football and its rules are football
 * rules: 90 minutes, goals, Asian and European handicaps. Handing it a
 * tennis or a horse racing bet and letting it find a market it recognises is
 * how "Over 2.5" on a tennis match gets graded against goals. So the sport
 * is decided first and the bet is routed, and anything ambiguous routes to
 * the answer that asks.
 *
 * PURITY CONTRACT, same as settlement.js: no DOM, no globals, no I/O. Both
 * the browser bundle and the serverless functions import this.
 *
 * Detection is deliberately lopsided. A football bet mistaken for a horse is
 * handed back to the user, which is annoying. A horse bet mistaken for
 * football could be graded against a football scoreline, which is money. So
 * the horse and tennis tests come first and are allowed to be greedy, and
 * football is what is left.
 */

export const SPORTS = ['football', 'tennis', 'horses'];

const lower = s => String(s == null ? '' : s).toLowerCase();

/* Horse and greyhound racing.
 *
 * A racing bet is recognisable from its shape long before its runner names
 * mean anything: a time and a course ("14:35 Ascot"), a race type, or the
 * each-way wording that only exists in racing and golf. */
export const HORSE_PATTERNS = [
  /\beach[ -]?way\b/, /\be\/w\b/, /\bew\b(?!\w)/,
  /\bto win race\b/, /\bwin only\b/, /\bplace only\b/,
  /\b\d{1,2}:\d{2}\s+[a-z]/,             // 14:35 Ascot
  /\brace \d\b/, /\br\d\b(?!\w)/,
  /\bhurdle\b/, /\bchase\b/, /\bsteeple/, /\bnovices?\b/, /\bmaiden\b/,
  /\bhandicap (chase|hurdle|stakes)\b/, /\bstakes\b/, /\bfurlong/, /\bfillies\b/,
  /\bnap\b/, /\bstarting price\b/, /\bsp\b(?!\w)/, /\bbog\b/,
  /\bforecast\b/, /\btricast\b/, /\bplacepot\b/, /\bexacta\b/, /\btrifecta\b/,
  /\bgreyhound/, /\btrap \d\b/,
  /\bant[e-] ?post\b/, /\bnon[ -]runner\b/, /\bnr no bet\b/,
  /\bjockey\b/, /\btrainer\b/, /\bfaller\b/, /\bpulled up\b/
];

/* Tennis, and the racket sports that settle the same way.
 *
 * Sets are the tell. A market talking about sets, games or tie breaks is not
 * football, and neither is a tour name. */
export const TENNIS_PATTERNS = [
  /\bstraight sets?\b/, /\bset betting\b/, /\bfirst set\b/, /\bset \d\b/,
  /\b\d ?- ?\d sets?\b/, /\btotal sets?\b/, /\bsets? handicap\b/,
  /\btie ?break/, /\bdeuce\b/, /\bace(s)?\b/, /\bdouble fault/,
  /\bgames? handicap\b/, /\btotal games\b/, /\bover \d+\.5 games\b/,
  /\bto win a set\b/, /\bbreak of serve\b/, /\bservice game\b/,
  /\batp\b/, /\bwta\b/, /\bitf\b/, /\bchallenger\b/,
  /\bwimbledon\b/, /\broland garros\b/, /\bfrench open\b/,
  /\bus open\b/, /\baustralian open\b/, /\bdavis cup\b/, /\bbillie jean\b/,
  /\blaver cup\b/, /\bqualification, (hard|clay|grass)\b/,
  /\b(hard|clay|grass) court\b/
];

const anyMatch = (patterns, text) => patterns.some(re => re.test(text));

/**
 * Decide the sport for one bet.
 *
 * @param {{event?:string, selection?:string, market?:string, sport?:string}} bet
 * @returns {'football'|'tennis'|'horses'}
 */
export function sportOf(bet) {
  if (!bet) return 'football';
  /* An explicit sport wins. The slip reader can often see it, and a stated
     fact beats a guess made from wording. */
  if (bet.sport && SPORTS.includes(bet.sport)) return bet.sport;

  const text = lower([bet.event, bet.selection, bet.market].filter(Boolean).join(' '));
  if (!text) return 'football';

  if (anyMatch(HORSE_PATTERNS, text)) return 'horses';
  if (anyMatch(TENNIS_PATTERNS, text)) return 'tennis';

  /* Two people rather than two teams. Tennis fixtures are written
     "Surname A. - Surname B.", and that initial-with-a-full-stop shape does
     not occur in football team names. Both sides have to look like it, so
     "Nott'm Forest v Man Utd" cannot trip it. */
  const sides = String(bet.event || '').split(/\s+(?:v|vs|-)\s+/i);
  if (sides.length === 2 && sides.every(s => /\b[A-Z][a-z']+ [A-Z]\.$/.test(s.trim()))) {
    return 'tennis';
  }
  return 'football';
}

/** The FlashScore sport id for a fixture pull. Football is 1, tennis 2. */
export const FEED_SPORT_ID = { football: 1, tennis: 2 };

/* Why a racing bet is never graded automatically.
 *
 * There is no free results source that proves what a place paid: the number
 * of places and the each-way fraction are set by the bookmaker per race and
 * depend on the size of the field, non-runners change them after the fact,
 * and a rule 4 deduction changes the price after the race is over. Every one
 * of those has to be right or the profit is wrong, and none of them is in
 * any feed reachable from here.
 *
 * So racing is tracked, not auto-settled: it is logged, it shows in the
 * running list, and the manual Won/Lost/Void/Cashed buttons settle it in one
 * tap. That is the honest version. Guessing at a place term would be the
 * dishonest one. */
export const HORSES_REASON =
  'Racing is settled by you. Place terms, each-way fractions and rule 4 ' +
  'deductions are set per race by your bookmaker and are not in any results ' +
  'feed, so a grade here would be a guess.';
