/** A balance: a named container with its own money in it.
 *
 *  THE QUESTION THIS ANSWERS. An account had one ledger, so a matched
 *  betting float, a football bank and a horses bank were one pile of
 *  numbers. Every figure the product printed was then an average over three
 *  different activities: a 40% return on twelve qualifying losses and a
 *  minus 8% on two hundred football singles came out as one number that
 *  describes neither. Somebody who keeps their money apart has to be able to
 *  keep their record apart, or the record is not of anything.
 *
 *  WHAT A BALANCE OWNS. Its own currency, its own starting figure, its own
 *  unit, its own deposits and withdrawals, and its own bets. Nothing is
 *  shared with the balance beside it except the account they both belong to.
 *
 *  POUNDS AND EUROS ARE NEVER SUMMED, and this is where that rule stops
 *  being a convention and becomes a shape. A balance has ONE currency, so a
 *  selection inside a balance has one currency by construction, and the only
 *  surface that looks at more than one balance at a time is the balance
 *  sheet, whose totals are keyed BY currency: see `perCurrency` there. There
 *  is no field anywhere that could hold a total across two of them.
 *
 *  THE VIEWER READS ONE AT A TIME. lib/data/session.ts hands every page the
 *  selected balance's bets, movements, currency, unit and starting figure,
 *  so a page cannot accidentally see two currencies at once even if it
 *  wanted to. */

import type { Currency } from './types';

export type Balance = {
  id: string;
  accountId: string;
  name: string;
  /** One currency, for the life of the balance. Changing it would rewrite
   *  the meaning of every figure already in it, so the product creates a
   *  second balance instead. */
  currency: Currency;
  /** What was in it before the first bet. Its own, not the account's. */
  startMinor: number;
  /** What a normal bet is here. It sits on the balance rather than on the
   *  account because a euro balance's unit is a number of euro and a
   *  sterling one's is a number of pounds, and one field cannot be both.
   *  Bets still freeze the unit at placement, so history never rewrites
   *  itself when this changes. */
  unitMinor: number;
  /** The unguessable half of a public link, or null when the balance is not
   *  shared. Revoking is setting this to null, and the link stops working on
   *  the next request. */
  shareToken: string | null;
  archived: boolean;
  /** The order they are drawn in. The default balance sorts first. */
  sort: number;
  createdAt: string;
};

/** Anything that belongs to exactly one balance. Bets and movements both
 *  do, and both are filtered by the same function so they cannot drift. */
export type InBalance = { balanceId: string };

export function inBalance<T extends InBalance>(rows: T[], balanceId: string): T[] {
  return rows.filter((r) => r.balanceId === balanceId);
}

/** The balance a page is looking at, resolved from whatever was asked for.
 *
 *  An id that names nothing falls back to the first balance rather than to
 *  an empty screen: a stale cookie from a balance somebody deleted would
 *  otherwise show an account with no bets in it and no way to tell why. */
export function resolveBalance(balances: Balance[], wanted: string | undefined | null): Balance {
  const live = balances.filter((b) => !b.archived);
  const list = live.length ? live : balances;
  return list.find((b) => b.id === wanted) ?? list[0];
}

export function balanceById(balances: Balance[], id: string): Balance | null {
  return balances.find((b) => b.id === id) ?? null;
}

/** Whether a slip read in one currency may be written into this balance.
 *
 *  A BALANCE DECIDES WHAT A STAKE IS DENOMINATED IN, and always did: the
 *  write path takes the currency off the balance and ignores whatever the
 *  caller sends. So a euro slip confirmed while a sterling balance is open
 *  goes into the ledger as the number off the slip in pounds, and there is
 *  nothing on any screen that would show it. The review screen holds the
 *  confirm on this and /api/bets refuses on it, both through this function,
 *  because two implementations of one rule is how the button and the route
 *  come to disagree about what is allowed.
 *
 *  Unknown agrees with everything. A reader that could not find a currency on
 *  a slip has not found a disagreement, and refusing on a field that was
 *  never read would block the ordinary case to catch the rare one. */
export function currencyAgrees(slip: Currency | null, balance: Currency | null): boolean {
  return !slip || !balance || slip === balance;
}

/** Which balances are in which currency, in the order the balances are in.
 *
 *  The balance sheet leads with this rather than leaving the reader to work
 *  it out from three symbols in a column: a sheet that prints two totals
 *  without saying which balances made each of them is a puzzle, not a
 *  summary. */
export function byCurrency(balances: Balance[]): { currency: Currency; balances: Balance[] }[] {
  const map = new Map<Currency, Balance[]>();
  for (const b of balances) map.set(b.currency, [...(map.get(b.currency) ?? []), b]);
  return [...map.entries()].map(([currency, list]) => ({ currency, balances: list }));
}

/** "Main and Horses" / "Main, Horses and Euro account". Used in the sentence
 *  that names which balances a per-currency total is made of. */
export function nameList(balances: Balance[]): string {
  const names = balances.map((b) => b.name);
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}
