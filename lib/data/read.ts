/** What a slip read looks like once the reader has finished with it.
 *
 *  Confidence is scored PER FIELD, not per slip: scoring a whole slip means
 *  one bad field poisons nineteen good ones, or nineteen good ones hide the
 *  one bad one. High saves silently, medium asks one targeted question, low
 *  is held out of the aggregates until a person settles it.
 *
 *  A missing price is visible and a wrong one is not, so a price is never
 *  guessed silently. */

export type Confidence = 'high' | 'medium' | 'low' | 'missing';

export type ReadField = {
  key: string;
  label: string;
  value: string;
  confidence: Confidence;
  /** What the reader saw, when that is not the same as what it concluded. */
  saw?: string;
  /** The one targeted question, when there is one. */
  question?: string;
};

export type ReadLeg = { selection: string; fixture: string; odds: string; confidence: Confidence };

export type SlipRead = {
  id: string;
  bookmaker: string;
  bookmakerConfidence: Confidence;
  shape: string;
  fields: ReadField[];
  legs: ReadLeg[];
  /** Set when the reader believes this slip is already in the ledger. */
  duplicateOf?: { id: string; when: string };
  promotional: { freeBet: boolean; boosted: boolean; bonusFunds: boolean };
};

export const EXAMPLE_READ: SlipRead = {
  id: 'read-1',
  bookmaker: 'bet365',
  bookmakerConfidence: 'high',
  shape: 'Lucky 15',
  fields: [
    { key: 'stake', label: 'Stake', value: '£15.00', confidence: 'high', saw: '15 x £1.00 unit stake' },
    { key: 'lines', label: 'Lines', value: '15', confidence: 'high' },
    { key: 'placed', label: 'Placed', value: '30 Aug, 13:42', confidence: 'high' },
    {
      key: 'price', label: 'Total price', value: 'Per line, see legs', confidence: 'high',
      saw: 'Each line priced separately, which is what a Lucky 15 does',
    },
    {
      key: 'bonus', label: 'Bonus', value: 'One from four, price doubled', confidence: 'medium',
      saw: 'BONUS 1/4 2x', question: 'bet365 doubles the odds on a single winner in a Lucky 15. Is that the offer on this slip?',
    },
    {
      key: 'rule4', label: 'Rule 4', value: 'Not shown', confidence: 'missing',
      question: 'Nothing on this slip mentions a deduction. If one lands later you can add it as an event.',
    },
  ],
  legs: [
    { selection: 'Constitution Hill', fixture: '14:30 Cheltenham', odds: '2.50', confidence: 'high' },
    { selection: 'State Man', fixture: '15:05 Leopardstown', odds: '3.75', confidence: 'high' },
    { selection: 'Jonbon', fixture: '16:10 Punchestown', odds: '4.33', confidence: 'medium' },
    { selection: 'Lossiemouth', fixture: '16:25 Newmarket', odds: '', confidence: 'missing' },
  ],
  promotional: { freeBet: false, boosted: false, bonusFunds: false },
};

export const CONFIDENCE_COPY: Record<Confidence, { label: string; note: string }> = {
  high: { label: 'Read cleanly', note: 'Saved without asking. Nothing here was in doubt.' },
  medium: { label: 'One question', note: 'The reader has an answer and wants it confirmed.' },
  low: { label: 'Held back', note: 'Kept out of your aggregates until you settle it.' },
  missing: { label: 'Not on the slip', note: 'Nothing was read here, so nothing was guessed.' },
};
