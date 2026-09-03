import { Icon } from '@/components/Icon';
import { RecordMovement } from './RecordMovement';
import { money, shortDate, plural, DEFAULT_TZ, type TimeZone } from '@/lib/format';
import { bookmakerName } from '@/lib/data/reference';
import { movementLabel, totalMovements, type Movement } from '@/lib/domain/movements';
import type { Currency } from '@/lib/domain/types';

/** The balance, and the half of it that is the account holder's own money.
 *
 *  THE QUESTION THIS EXISTS TO ANSWER. The balance was profit and loss only,
 *  so it could say what an account had won and could not say how much of the
 *  money in there was theirs. Somebody a few hundred up who has topped up
 *  more than that across a season is down on the year in the only sense their
 *  current account cares about, and nothing here could tell them.
 *
 *  THREE FIGURES AND THEY ADD UP, left to right, which is the whole read: own
 *  money in, plus profit, is the balance. A card that showed the balance
 *  alone would raise the question and leave it there. */
export function MoneyMoved({
  movements, startMinor, realisedMinor, currency = 'GBP', balanceName,
}: {
  movements: Movement[];
  /** Which balance these three figures are about. An account keeps several
   *  and their figures are not comparable, so a card headed only "Balance"
   *  is a number with no subject. */
  balanceName?: string;
  /** What the account was opened with, from Settings. */
  startMinor: number;
  /** Every realised profit and loss, from bet_state and from nowhere else. */
  realisedMinor: number;
  currency?: Currency;
}) {
  const t = totalMovements(movements);
  const ownIn = startMinor + t.netInMinor;
  const balance = ownIn + realisedMinor;

  return (
    <section className="card moved" aria-labelledby="moved-t" style={{ marginBottom: 'var(--gap-block)' }}>
      <header className="card__head">
        <h2 className="card__title" id="moved-t">{balanceName ?? 'Balance'}</h2>
      </header>

      <div className="moved__sums">
        <div className="moved__fig">
          <p className="label">Your own money in</p>
          <p className="fig fig--m tnum">{money(ownIn, currency)}</p>
          <p className="small dim">
            {t.count === 0
              ? 'The starting figure, with nothing paid in or taken out yet'
              : `${money(startMinor, currency)} to start, ${money(t.depositedMinor, currency)} paid in, ${money(t.withdrawnMinor, currency)} taken out`}
          </p>
        </div>
        {/* The plus and the equals are the read. They are decoration in the
            accessibility tree, which is why the sentence in the footer says
            the same relationship in words. */}
        <span className="moved__op" aria-hidden="true">+</span>
        <div className="moved__fig">
          <p className="label">Profit and loss</p>
          <p className={`fig fig--m tnum ${realisedMinor > 0 ? 'pos' : realisedMinor < 0 ? 'neg' : ''}`}>
            {money(realisedMinor, currency, { sign: true })}
          </p>
          <p className="small dim">Every settled bet, all time</p>
        </div>
        <span className="moved__op" aria-hidden="true">=</span>
        <div className="moved__fig">
          <p className="label">Balance</p>
          <p className="fig fig--m tnum">{money(balance, currency)}</p>
          <p className="small dim">
            {t.count > 0
              ? `${plural(t.deposits, 'deposit')}, ${plural(t.withdrawals, 'withdrawal')}`
              : 'No deposits or withdrawals recorded'}
          </p>
        </div>
      </div>

      <div className="card__foot">
        <p className="small dim">
          Your own money in, plus your profit and loss, is the balance. Deposits and withdrawals
          move that figure and nothing else: they are not in your return, your turnover, your win
          rate or any other figure about your betting.
        </p>
        <div style={{ marginTop: 'var(--s3)' }}>
          <RecordMovement balanceName={balanceName ?? 'this balance'} currency={currency} />
        </div>
      </div>
    </section>
  );
}

/** One movement, in the ledger, alongside the bets.
 *
 *  IT HAS TO BE TELLABLE FROM A BET AT A GLANCE, which is why it is a
 *  different row shape rather than a bet row with a different label: a rule
 *  down the left in the accent, a signed tag where a bet carries its outcome
 *  pill, and the balance it left behind where a bet prints its return.
 *  Somebody scanning a column for their bets should never have to read one of
 *  these to find out it is not one.
 *
 *  The amount takes NEITHER result colour. Green and red mean profit and loss
 *  in this product and a deposit is neither: paying money in is not winning
 *  and taking it out is not losing, and colouring them that way is the exact
 *  confusion the whole separation exists to prevent. */
export function MovementRow({
  movement, balanceAfter, currency = 'GBP', tz = DEFAULT_TZ,
}: {
  movement: Movement;
  /** The balance immediately after this movement, or null when it could not
   *  be worked out. Null prints nothing rather than a zero. */
  balanceAfter: number | null;
  currency?: Currency;
  tz?: TimeZone;
}) {
  const inward = movement.kind === 'deposit';
  return (
    <li className="brow mvrow">
      <div style={{ minWidth: 0 }}>
        <div className="row" style={{ gap: 'var(--s2)', marginBottom: 3 }}>
          <span className="mvrow__tag">
            <Icon name={inward ? 'plus' : 'minus'} size={12} strokeWidth={2.4} />
            {movementLabel(movement.kind)}
          </span>
        </div>
        <p className="brow__title">
          {inward ? 'Paid in' : 'Taken out'}
          {movement.bookmakerId ? ` at ${bookmakerName(movement.bookmakerId)}` : ''}
        </p>
        <p className="brow__sub">{movement.note ?? 'No note'}</p>
        {/*  It says so out loud. The shape carries it for anybody looking at
             the page and this carries it for anybody reading the row. */}
        <p className="brow__sub mono" style={{ marginTop: 2 }}>
          Not a bet, so it is in no betting figure · {shortDate(movement.occurredAt, new Date(), tz)}
        </p>
      </div>
      <div style={{ textAlign: 'right' }}>
        <p className="fig fig--s tnum">
          {inward ? '+' : '−'}{money(movement.amountMinor, currency)}
        </p>
        <p className="small dim tnum">
          {balanceAfter === null ? 'Balance moved' : `${money(balanceAfter, currency)} balance`}
        </p>
      </div>
    </li>
  );
}
