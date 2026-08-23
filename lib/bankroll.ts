/* 57 · BANKROLL MEANT TWO DIFFERENT NUMBERS.
 *
 * Settings defined Bankroll as "Starting balance, so growth shows as a
 * percentage" and showed £1,000. The sidebar showed Bankroll £4,171.00, which
 * is starting plus all-time net. One word, two numbers, four times apart.
 *
 * They are two things and they now have two names:
 *
 *   Starting bankroll   set by a person, fixed, the denominator for growth
 *   Balance             derived, never stored
 *
 * Open exposure divides by BALANCE, not starting bankroll. Dividing by the
 * starting figure means the percentage drifts further from reality the better
 * someone does — at £4,171 with £1,000 as the denominator, £88 at risk reads
 * 8.8% when it is actually 2.1%, and the number that is supposed to stop
 * somebody over-staking is the one that is four times too alarming.
 */

export type Adjustment = { amountPence: number };

/* Positive is money in, negative is money out. One signed column rather than
   a type and a magnitude that have to agree. */
export function adjustmentsTotal(adjustments: readonly Adjustment[]): number {
  return adjustments.reduce((t, a) => t + (a.amountPence || 0), 0);
}

export function balancePence(
  startingBankrollPence: number | null | undefined,
  netPence: number,
  adjustments: readonly Adjustment[] = [],
): number {
  return (startingBankrollPence ?? 0) + netPence + adjustmentsTotal(adjustments);
}

/* Exposure as a percentage of the balance. Returns null when there is no
   balance to divide by, so the caller shows an em dash rather than Infinity
   or a confident 0.0%. */
export function exposurePct(atRiskPence: number, balance: number): number | null {
  if (!(balance > 0)) return null;
  return (atRiskPence / balance) * 100;
}

/* Growth against the figure a person actually set, which is the one question
   "starting bankroll" exists to answer. */
export function growthPct(
  startingBankrollPence: number | null | undefined,
  netPence: number,
): number | null {
  const start = startingBankrollPence ?? 0;
  if (!(start > 0)) return null;
  return (netPence / start) * 100;
}
