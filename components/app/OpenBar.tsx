import Link from 'next/link';
import { Icon } from '@/components/Icon';
import { CheckResults } from './CheckResults';
import { money, plural } from '@/lib/format';
import { scopeToQuery, type Scope } from '@/lib/data/analytics';
import type { Currency } from '@/lib/domain/types';

/** Open bets, as one row above the list.
 *
 *  IT WAS A CARD 430 PIXELS TALL. Two figures at 28px, "At risk" and "If
 *  they all land", each with a caption under it; then three headed groups,
 *  Waiting on a result, Running and Not started yet, up to four named bets
 *  in each; then a sentence counting whatever the twelve did not reach. Every
 *  one of those bets is in the list underneath, four inches lower, at the
 *  same price with the same bookmaker, so the card was the top of the ledger
 *  printed twice at two densities.
 *
 *  WHAT THE PARAGRAPH SAID IS WHY IT WENT. "The event finished and the score
 *  has not settled these yet. Slippery asks rather than grading one wrong.
 *  Open one and record what happened, or have it look again." Three sentences
 *  of the product explaining its own settlement policy, on the row where a
 *  count belongs, on every visit to the ledger for ever. The count says how
 *  many are waiting and the button beside it is the "look again"; what is
 *  left is the policy, which belongs in the code that implements it and does.
 *
 *  "IF THEY ALL LAND" WENT WITH IT. It is a figure nobody acts on: every open
 *  bet landing is not a scenario, it is the top of a distribution, and
 *  printing it at 28 pixels beside what is genuinely at risk gives the two
 *  the same weight. What is at risk is real money and is kept.
 *
 *  AND "IGNORES THE SCOPE" WENT. It was a caption in the card's corner saying
 *  that a period filter does not hide a bet that is running right now, which
 *  is not a rule anybody needs told: nothing about "3 open" reads as a claim
 *  about September. */
export function OpenBar({
  count, waiting, atRiskMinor, currency, scope,
}: {
  count: number;
  waiting: number;
  atRiskMinor: number;
  currency: Currency;
  /** So the link out keeps the period the reader is on. */
  scope: Scope;
}) {
  if (count === 0) return null;
  const q = scopeToQuery(scope);
  const href = `/app/ledger${q ? `${q}&needs=open` : '?needs=open'}`;

  return (
    <div className="openbar">
      <Icon name="clock" size={16} className="openbar__i" />
      <Link href={href} className="openbar__n">{plural(count, 'open bet')}</Link>
      <span className="openbar__r tnum">{money(atRiskMinor, currency)} at risk</span>
      {waiting > 0 ? (
        <span className="openbar__w">
          <Icon name="alert" size={14} />
          {waiting} waiting on a result
        </span>
      ) : null}
      <span className="grow" />
      <CheckResults />
    </div>
  );
}
