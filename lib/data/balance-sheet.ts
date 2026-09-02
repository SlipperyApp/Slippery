/** Every balance side by side, and the only place in the product that looks
 *  at more than one.
 *
 *  WHY IT EXISTS. Once an account keeps a football bank, a horses bank and a
 *  euro account, every other screen shows one of them, which is right and
 *  which leaves one question unanswerable: how the three compare, and what is
 *  actually in there. Reading it off three visits to the same page and adding
 *  the figures up in your head is exactly the arithmetic this product refuses
 *  to do on your behalf, and half of it would be wrong.
 *
 *  THE TOTALS ARE KEYED BY CURRENCY AND THERE IS NO OTHER KIND.
 *  `BalanceSheet` has `lines` and `perCurrency` and nothing else. There is no
 *  field on it that could hold a total across two currencies, so a component
 *  cannot print one by reaching for the wrong property: it would have to add
 *  two numbers itself, on purpose, in a file that says this.
 *
 *  EVERY FIGURE COMES FROM summarise(). Not one of them is worked out here.
 *  A sheet that computed its own net would be a second implementation of the
 *  ledger, and the first thing anybody would notice is that it disagrees with
 *  the page it summarises. */

import { summarise } from './analytics';
import { totalMovements } from '@/lib/domain/movements';
import { inBalance, type Balance } from '@/lib/domain/balances';
import type { Movement } from '@/lib/domain/movements';
import type { DemoBet } from './demo';
import type { Currency } from '@/lib/domain/types';

/** One balance's row. */
export type BalanceLine = {
  balance: Balance;
  currency: Currency;
  bets: number;
  settled: number;
  open: number;
  netMinor: number;
  turnoverMinor: number;
  /** Net over turnover, from summarise(), never recomputed here. */
  roi: number;
  units: number;
  /** What they started with plus what they have paid in less what they have
   *  taken out. The half of the balance that is their own money. */
  ownInMinor: number;
  /** Own money in plus realised profit and loss. */
  balanceMinor: number;
  depositedMinor: number;
  withdrawnMinor: number;
};

/** One currency's total, over the balances kept in it. */
export type CurrencyTotal = {
  currency: Currency;
  /** Which balances made this total. The sheet says so out loud rather than
   *  leaving the reader to work it out from a column of symbols. */
  balances: Balance[];
  bets: number;
  netMinor: number;
  turnoverMinor: number;
  roi: number;
  units: number;
  ownInMinor: number;
  balanceMinor: number;
};

export type BalanceSheet = {
  lines: BalanceLine[];
  perCurrency: CurrencyTotal[];
  /** Every bet on the sheet, counted once. Rule 5: the lines partition the
   *  book, so this equals the number of bets that went in, and a bet that
   *  fell into no balance would show up here as a gap rather than as a wrong
   *  figure nobody could source. */
  counted: number;
};

export function balanceSheet(
  balances: Balance[], bets: DemoBet[], movements: Movement[],
): BalanceSheet {
  const lines: BalanceLine[] = balances.map((balance) => {
    const rows = inBalance(bets, balance.id);
    const moves = inBalance(movements, balance.id);
    const s = summarise(rows);
    const t = totalMovements(moves);
    const ownInMinor = balance.startMinor + t.netInMinor;
    return {
      balance,
      currency: balance.currency,
      bets: s.count,
      settled: s.settled,
      open: s.open,
      netMinor: s.netPence,
      turnoverMinor: s.turnoverPence,
      roi: s.roi,
      units: s.units,
      ownInMinor,
      balanceMinor: ownInMinor + s.netPence,
      depositedMinor: t.depositedMinor,
      withdrawnMinor: t.withdrawnMinor,
    };
  });

  /*  Grouped in the order the balances are drawn in, so the sheet's sections
      are in the same order as its rows and the switcher's list. */
  const order: Currency[] = [];
  const groups = new Map<Currency, BalanceLine[]>();
  for (const line of lines) {
    if (!groups.has(line.currency)) { groups.set(line.currency, []); order.push(line.currency); }
    groups.get(line.currency)!.push(line);
  }

  const perCurrency: CurrencyTotal[] = order.map((currency) => {
    const group = groups.get(currency)!;
    const netMinor = group.reduce((a, l) => a + l.netMinor, 0);
    const turnoverMinor = group.reduce((a, l) => a + l.turnoverMinor, 0);
    return {
      currency,
      balances: group.map((l) => l.balance),
      bets: group.reduce((a, l) => a + l.bets, 0),
      netMinor,
      turnoverMinor,
      /*  Worked out from the two totals above rather than by averaging the
          rows' own returns. An average of returns weights a balance with
          four bets in it the same as one with four hundred, which is the
          single most misleading way to summarise a column of them. */
      roi: turnoverMinor > 0 ? (netMinor / turnoverMinor) * 100 : 0,
      units: Number(group.reduce((a, l) => a + l.units, 0).toFixed(2)),
      ownInMinor: group.reduce((a, l) => a + l.ownInMinor, 0),
      balanceMinor: group.reduce((a, l) => a + l.balanceMinor, 0),
    };
  });

  return { lines, perCurrency, counted: lines.reduce((a, l) => a + l.bets, 0) };
}

/** The word for a currency in a sentence, because "GBP" is a code and this
 *  is prose. */
export const CURRENCY_WORD: Record<Currency, string> = { GBP: 'pounds', EUR: 'euro' };
