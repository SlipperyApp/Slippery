/* 55 · EACH WAY, AS TWO LINKED PARTS SHOWN AS ONE ROW.
 *
 * The bet detail sheet had an "Each way" field and the settlement model had
 * exactly six outcomes, none of which is a partial win. An each-way bet that
 * places without winning is the most common partial settlement in UK racing,
 * and racing is the second biggest sport in this product — so the single most
 * common bet a racing punter places could not be recorded correctly.
 *
 * The fix is structural rather than a seventh enum value. A bet with
 * `isEachWay` has two child legs, win and place, each with its own stake and
 * its own price, each settling through the existing six outcomes. The parent
 * row derives a label from the pair.
 *
 * WHY NOT A "half_won" OUTCOME. Rule 4 deductions, dead heats and non-runners
 * apply to each part separately and by different amounts — a Rule 4 hits the
 * win part's price and the place part's price differently, and a dead heat
 * halves one part and not the other. Every one of those would need its own
 * special case against a flat enum. Against two legs they are already
 * handled, because each leg is an ordinary bet.
 *
 * Pure: no DOM, no database, no globals. Imported by the grader, the API and
 * the tests, and by nothing that renders.
 */

export type EwOutcome = 'won' | 'lost' | 'void' | 'push' | 'half_won' | 'half_lost';

export type PlaceTerms = {
  /* "1/5" is numerator 1, denominator 5. */
  numerator: number;
  denominator: number;
  placesPaid: number;
};

/* The place part runs at the win price reduced by the terms fraction. Only
   the profit half of the price is reduced: at 6.00 and 1/5, the place price
   is 1 + 5/5 = 2.00, not 1.20. Getting this wrong is the classic each-way
   arithmetic error and it understates every placed bet. */
export function placePrice(winPrice: number, terms: PlaceTerms): number {
  if (!(winPrice > 1)) return 1;
  const { numerator, denominator } = terms;
  if (!(numerator > 0) || !(denominator > 0)) return winPrice;
  return 1 + (winPrice - 1) * (numerator / denominator);
}

/* "1/5" → terms. Returns null rather than guessing, because a bet whose terms
   could not be read must ask rather than settle at the wrong price. */
export function parsePlaceFraction(s: string | null | undefined): { numerator: number; denominator: number } | null {
  if (!s) return null;
  const m = /^\s*(\d+)\s*\/\s*(\d+)\s*$/.exec(String(s));
  if (!m) return null;
  const numerator = Number(m[1]);
  const denominator = Number(m[2]);
  if (!(numerator > 0) || !(denominator > 0)) return null;
  return { numerator, denominator };
}

export type EwLabel = 'won' | 'placed' | 'lost' | 'void' | 'part_void' | 'ask';

/* THE PARENT LABEL.
 *
 * `placed` is the case the six outcomes could not express: the win part lost
 * and the place part won. It is a loss in pounds and a win in the sense that
 * matters to whoever placed it, so it gets its own word rather than being
 * rounded to one of the two.
 *
 * A part that has not settled defers the whole label, on the same rule the
 * accumulator follows: a wrong grade is worse than no grade. */
export function eachWayLabel(win: EwOutcome | null, place: EwOutcome | null): EwLabel {
  if (!win || !place) return 'ask';
  const voidish = (o: EwOutcome) => o === 'void' || o === 'push';
  if (voidish(win) && voidish(place)) return 'void';
  if (voidish(win) || voidish(place)) {
    /* One part void, the other settled. The bet is neither wholly void nor a
       clean win or loss, and the stake returned is only half. */
    const other = voidish(win) ? place! : win!;
    return other === 'lost' || other === 'half_lost' ? 'part_void' : 'part_void';
  }
  const won = (o: EwOutcome) => o === 'won' || o === 'half_won';
  if (won(win) && won(place)) return 'won';
  if (!won(win) && won(place)) return 'placed';
  return 'lost';
}

export const EW_LABEL_TEXT: Record<EwLabel, string> = {
  won: 'Won',
  placed: 'Placed',
  lost: 'Lost',
  void: 'Void',
  part_void: 'Part void',
  ask: 'Waiting',
};

/* Split a total each-way stake into its two halves. A £20 each-way bet is
   £10 win and £10 place and the *displayed* stake is £20 — showing £10 is the
   other classic each-way error, and it halves the turnover figure. An odd
   number of pence goes to the win part so the two always sum to the total. */
export function splitStake(totalPence: number): { winPence: number; placePence: number } {
  const place = Math.floor(totalPence / 2);
  return { winPence: totalPence - place, placePence: place };
}
