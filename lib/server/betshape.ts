/* ONE VALIDATOR.
 *
 * The route that logs a bet and the import review that checks a spreadsheet
 * row before sending it both call this, so the review rejects exactly what
 * the server would reject and cannot drift from it. The old app kept the
 * check inside the API handler where the browser could not reach it, so the
 * review could only report a rejection after the fact. */
export type BetInput = {
  stakePence?: unknown; eventAt?: unknown; side?: unknown; liabilityPence?: unknown;
  odds?: unknown; isAntepost?: unknown; expectedSettleAt?: unknown; currency?: unknown;
};

export function betProblems(b: BetInput | null | undefined): string[] {
  const out: string[] = [];
  const stake = Number((b as any)?.stakePence);
  if (!Number.isFinite(stake) || stake <= 0) out.push('A bet needs a stake.');
  if (!b?.eventAt || Number.isNaN(Date.parse(String(b.eventAt)))) out.push('A bet needs the date its event happens.');
  if (b?.side === 'lay' && !(Number(b.liabilityPence) > 0)) {
    out.push('A lay bet needs its liability, or nothing about it can be totalled.');
  }
  const odds = b?.odds == null ? null : Number(b.odds);
  if (odds != null && (!Number.isFinite(odds) || odds < 1)) out.push('Decimal odds cannot be below 1.');
  if (b?.isAntepost && !b?.expectedSettleAt) {
    out.push('An antepost bet needs the date you expect it to settle.');
  }
  if (b?.currency && !['GBP', 'EUR'].includes(String(b.currency))) out.push('Only pounds and euros for now.');
  return out;
}
