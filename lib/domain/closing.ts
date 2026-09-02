/** The closing price, as the account holder recorded it.
 *
 *  THIS MODULE HAD A PREDECESSOR AND IT WAS DELETED ON PURPOSE. A closing
 *  line value module existed here once with no closing price behind it, so
 *  what it printed on every account on every day was "Not measured" and a
 *  paragraph explaining why. A module that exists to say it has nothing to
 *  say takes a slot on the first screen and teaches the reader that some of
 *  the figures in this product do not work.
 *
 *  What changed is not the maths. It is where the number comes from. NOTHING
 *  HERE COMPUTES, ESTIMATES, MODELS OR INFERS A CLOSING PRICE. A closing
 *  price is a fact somebody looked up after the off and typed in, and a
 *  fabricated one is worse than a blank because it looks the same as a real
 *  one. `closingOdds` is null on almost every bet and that is the normal
 *  case, not a gap to be filled.
 *
 *  A NULL IS NOT A ZERO, and that is the rule the whole module is built
 *  around. Where a price is missing there is no value, no zero, no dash in a
 *  total and no bet in a denominator. Every aggregate here reports how many
 *  of how many bets it is made of, because "plus 3.1 per cent" over eleven
 *  bets out of three hundred is a different sentence from the same figure
 *  over all three hundred, and the reader is the one who has to decide which
 *  they are looking at. */

import type { Bet } from './types';

/** A bet with enough on it to have a closing value: the price taken, the
 *  price recorded, and which way round the bet was. */
export type Priced = Pick<Bet, 'side' | 'closingOdds'> & { odds: number };

/** Is this a price somebody could have taken. Rejects the shapes that reach
 *  a form: an empty box, a zero, evens typed as 1, a decimal below 1. */
export function isPrice(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v) && v > 1 && v < 10_000;
}

/** How much better the price taken was than the price that closed, as a
 *  percentage, or null when there is no closing price on the bet.
 *
 *  Positive means the taken price was the better one. For a BACK bet that is
 *  a bigger number than the close; for a LAY it is a smaller one, because a
 *  layer wants the shortest price they can get. Working it out the back way
 *  round for a lay would report every good lay as a bad bet, which is the
 *  kind of sign error that is invisible until somebody's whole exchange
 *  record reads upside down.
 *
 *  Null propagates. There is no zero here and no fallback: a bet with no
 *  closing price is a bet this figure has nothing to say about. */
export function closingValuePct(bet: Priced): number | null {
  const close = bet.closingOdds;
  if (!isPrice(close) || !isPrice(bet.odds)) return null;
  const ratio = bet.side === 'lay' ? close / bet.odds : bet.odds / close;
  return (ratio - 1) * 100;
}

export type ClosingSummary = {
  /** How many bets carry a closing price. */
  recorded: number;
  /** How many bets there were. Always reported beside `recorded`, because a
   *  figure over eleven of three hundred is a different claim from the same
   *  figure over three hundred of three hundred. */
  of: number;
  /** The mean value across the bets that carry one, or null when none do.
   *  Not zero: zero is a real answer meaning the prices matched. */
  meanPct: number | null;
  /** The best and the worst of them, or null when none. */
  bestPct: number | null;
  worstPct: number | null;
  beat: number;
  matched: number;
  missed: number;
};

/** The aggregate, over ONLY the bets that carry a closing price.
 *
 *  Bets without one are not counted as zero and are not counted at all. A
 *  zero would drag the mean toward nothing and would say the prices matched
 *  on a bet where nobody ever looked. */
export function summariseClosing(bets: Priced[]): ClosingSummary {
  const values: number[] = [];
  for (const b of bets) {
    const v = closingValuePct(b);
    if (v !== null) values.push(v);
  }
  const recorded = values.length;
  if (recorded === 0) {
    return {
      recorded: 0, of: bets.length, meanPct: null, bestPct: null, worstPct: null,
      beat: 0, matched: 0, missed: 0,
    };
  }
  /*  Rounded to three places before the comparison, not to two, so a price
      pair that differs in the fourth decimal of a ratio does not get called
      a beat. Prices are stored to four places and a value of 0.0004 per cent
      is two identical prices with a rounding artefact between them. */
  const level = (v: number) => Number(v.toFixed(3));
  return {
    recorded,
    of: bets.length,
    meanPct: values.reduce((a, v) => a + v, 0) / recorded,
    bestPct: Math.max(...values),
    worstPct: Math.min(...values),
    beat: values.filter((v) => level(v) > 0).length,
    matched: values.filter((v) => level(v) === 0).length,
    missed: values.filter((v) => level(v) < 0).length,
  };
}

/*  closingCoverage() was here. It wrote "79 of 259 bets carry a closing price
    you recorded" for the module's footer, next to a figure reading 79 of 259
    under the label "Bets with a price recorded". The coverage is a figure,
    which is the right call, and a sentence restating a figure three inches
    under it is the module arguing with itself. The figure stayed and the
    sentence went; nothing else called it. */
