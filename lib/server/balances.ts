/** Which balance a write belongs to.
 *
 *  Every bet and every movement lands in exactly one balance, and the one a
 *  write lands in is the one the person has open: the same cookie the top
 *  bar's switcher sets and lib/data/session.ts reads. It is resolved HERE
 *  rather than taken from the request body, because a client that could name
 *  a balance could name somebody else's, and because a stake typed into the
 *  euro account and filed against the sterling one is a wrong figure on two
 *  screens at once.
 *
 *  The currency comes back with it for the same reason. A balance has one
 *  currency for its whole life, so the balance decides what a stake is
 *  denominated in and the caller never has to. */

import { cookies } from 'next/headers';
import { query } from './db';
import { BALANCE_COOKIE } from '@/lib/data/session';
import type { Currency } from '@/lib/domain/types';

export type BalanceRef = { id: string; currency: Currency; unitPence: number };

type Row = { id: string; currency: string; unit_pence: number };

const toRef = (r: Row): BalanceRef => ({
  id: r.id,
  currency: r.currency === 'EUR' ? 'EUR' : 'GBP',
  unitPence: Number(r.unit_pence),
});

/** The balance this account has open, or its first one, or nothing at all.
 *
 *  Nothing at all is the answer for an account whose balances have not been
 *  created yet, which is the window between a signup and the migration
 *  running against it. A caller writes without a balance rather than
 *  inventing one: the migration files it, and a bet in the ledger with a null
 *  balance for an hour is better than a bet in a balance the person never
 *  made. */
export async function currentBalance(accountId: string): Promise<BalanceRef | null> {
  const rows = await query<Row>(
    `select id, currency, unit_pence from balances
      where account_id = $1 and archived = false
      order by sort, created_at`,
    [accountId],
  ).catch(() => [] as Row[]);
  if (!rows.length) return null;

  const jar = await cookies();
  const wanted = jar.get(BALANCE_COOKIE)?.value;
  /*  A cookie naming a balance on a different account matches nothing here,
      because the query is already scoped to this one. That is the whole
      authorisation check and it is why the cookie is never trusted as an id. */
  return toRef(rows.find((r) => r.id === wanted) ?? rows[0]);
}
