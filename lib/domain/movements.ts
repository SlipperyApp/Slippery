/** Money in and money out, which is not profit and must never be counted as
 *  it.
 *
 *  THE QUESTION THIS ANSWERS. The balance was the starting figure plus every
 *  realised profit and loss, so it could say what the account had won and
 *  could not say how much of the money in there was the account holder's own.
 *  Somebody £400 up who has topped up £600 across the season is £200 down on
 *  the year in the only sense that matters to their current account, and
 *  nothing in this product could tell them so.
 *
 *  THE RULE, AND IT IS THE WHOLE DESIGN. A movement is not a bet and it is
 *  not a settlement event. It moves the balance and it touches nothing else:
 *  not profit, not return, not turnover, not win rate, not the streak, not
 *  the calendar, not a breakdown row. A deposit that changes the return
 *  figure would make somebody's record look better for having put more money
 *  in, which is the single most dishonest number this product could print.
 *
 *  So they are their own type in their own table, folded by their own
 *  functions, and every figure derived from bets goes on reading `bet_state`
 *  and never sees one. tests/movements.test.ts pins that: the whole summary
 *  is asserted identical before and after a deposit lands.
 *
 *  Money is integer minor units with a currency code, and pounds and euros
 *  are never summed. A movement in a currency the account does not keep is
 *  refused at the door rather than converted, exactly like a slip in the
 *  wrong currency. */

import type { Currency } from './types';

export type MovementKind = 'deposit' | 'withdrawal';

export type Movement = {
  id: string;
  accountId: string;
  /** Which balance the money went into or came out of. A movement belongs to
   *  exactly one, and it takes that balance's currency: money paid into the
   *  euro account is not money in the sterling one. */
  balanceId: string;
  kind: MovementKind;
  /** ALWAYS POSITIVE. The direction is the kind, never the sign, so a
   *  withdrawal typed in with a minus cannot quietly become a deposit. */
  amountMinor: number;
  currency: Currency;
  /** Which bookmaker the money went into or came out of, when it was one.
   *  Null for a transfer nobody attributed, which is most of them on an
   *  import. */
  bookmakerId: string | null;
  occurredAt: string;
  note: string | null;
  createdAt: string;
};

export const MOVEMENT_KINDS: { id: MovementKind; label: string; verb: string }[] = [
  { id: 'deposit', label: 'Deposit', verb: 'Paid in' },
  { id: 'withdrawal', label: 'Withdrawal', verb: 'Taken out' },
];

export function movementLabel(kind: MovementKind): string {
  return MOVEMENT_KINDS.find((k) => k.id === kind)?.label ?? kind;
}

/** What this movement does to the balance. The only place the direction is
 *  ever turned into a sign. */
export function signedMinor(m: Pick<Movement, 'kind' | 'amountMinor'>): number {
  const amount = Math.abs(Math.round(m.amountMinor));
  return m.kind === 'withdrawal' ? -amount : amount;
}

export type MovementTotals = {
  depositedMinor: number;
  withdrawnMinor: number;
  /** Deposits less withdrawals. Negative when more has come out than gone in,
   *  which is what a winning year looks like. */
  netInMinor: number;
  deposits: number;
  withdrawals: number;
  count: number;
};

export function totalMovements(list: Movement[]): MovementTotals {
  let depositedMinor = 0, withdrawnMinor = 0, deposits = 0, withdrawals = 0;
  for (const m of list) {
    const amount = Math.abs(Math.round(m.amountMinor));
    if (m.kind === 'withdrawal') { withdrawnMinor += amount; withdrawals += 1; }
    else { depositedMinor += amount; deposits += 1; }
  }
  return {
    depositedMinor,
    withdrawnMinor,
    netInMinor: depositedMinor - withdrawnMinor,
    deposits,
    withdrawals,
    count: list.length,
  };
}

/** How much of the money in there is the account holder's own: what they
 *  started with, plus what they have paid in, less what they have taken out.
 *
 *  This is the figure the balance could not produce, and it is the one
 *  somebody means when they ask how they are doing. */
export function ownMoneyInMinor(startMinor: number, list: Movement[]): number {
  return startMinor + totalMovements(list).netInMinor;
}

/** The balance: their own money in, plus every realised profit and loss.
 *
 *  The profit half is passed in rather than computed here, because it comes
 *  from `bet_state` and this module must never learn how to fold a bet. Two
 *  additions, and each side keeps its own meaning. */
export function balanceMinor(startMinor: number, list: Movement[], realisedPlMinor: number): number {
  return ownMoneyInMinor(startMinor, list) + realisedPlMinor;
}

/*  ------------------------------------------------------- the running total
 *
 *  A movement row is worth almost nothing on its own: "paid in £200" is a
 *  fact about a Tuesday. What makes it readable is the balance it left
 *  behind, which is why the ledger prints one against each of them. */

export type LedgerEntry =
  | { kind: 'bet'; at: string; deltaMinor: number; id: string }
  | { kind: 'movement'; at: string; deltaMinor: number; id: string };

/** The balance after each movement, oldest first, keyed by movement id.
 *
 *  It walks the WHOLE record, bets and movements together in time order,
 *  because a balance that ignored the bets between two deposits would be a
 *  different number from the one in the top bar and somebody would have to
 *  work out which of the two was lying.
 *
 *  Only settled bets move it. An open bet's stake is committed and not yet
 *  lost, and counting it would show a balance that recovers every time a bet
 *  is graded a loser. Exposure is its own figure and it says so. */
export function balanceAfterEach(
  startMinor: number,
  movements: Movement[],
  bets: { id: string; eventAt: string; state: { status: string; realisedPlPence: number } }[],
): Record<string, number> {
  const entries: LedgerEntry[] = [
    ...movements.map((m) => ({ kind: 'movement' as const, at: m.occurredAt, deltaMinor: signedMinor(m), id: m.id })),
    ...bets
      .filter((b) => b.state.status !== 'open')
      .map((b) => ({ kind: 'bet' as const, at: b.eventAt, deltaMinor: b.state.realisedPlPence, id: b.id })),
  ].sort((a, b) => {
    const d = Date.parse(a.at) - Date.parse(b.at);
    /*  A stable tie break, so two things stamped at the same second cannot
        swap places between two renders and print two different balances for
        the same movement. */
    return d !== 0 ? d : a.id.localeCompare(b.id);
  });

  const out: Record<string, number> = {};
  let running = startMinor;
  for (const e of entries) {
    running += e.deltaMinor;
    if (e.kind === 'movement') out[e.id] = running;
  }
  return out;
}
