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
 *  denominated in and the caller never has to.
 *
 *  THE BALANCE THE SCREENS NAMED DID NOT EXIST. Signup writes an accounts row
 *  and nothing else, and only migration 0011 ever inserted a balance, so every
 *  account created after that file ran had none. lib/data/viewer.ts drew a
 *  balance called Main anyway, which is right for a screen that has to be
 *  denominated in something, and `bets.balance_id` is not null, so the first
 *  bet somebody typed into that account failed on a constraint and came back
 *  as "that failed and nothing was saved". A screen naming a container that
 *  cannot hold anything is the whole defect. ensureBalance() below closes it:
 *  the row is created on first use, from the account's own currency, unit and
 *  starting figure, inside the caller's transaction, exactly as 0011 seeds it.
 */

import { query, type Runner } from './db';
import type { Currency } from '@/lib/domain/types';

export type BalanceRef = {
  id: string;
  /** Named, because every surface that asks which balance a bet lands in has
   *  to be able to say it back. An id is not an answer to that question. */
  name: string;
  currency: Currency;
  unitPence: number;
};

type Row = { id: string; name: string; currency: string; unit_pence: number };

const toRef = (r: Row): BalanceRef => ({
  id: r.id,
  name: r.name,
  currency: r.currency === 'EUR' ? 'EUR' : 'GBP',
  unitPence: Number(r.unit_pence),
});

const LIST = `select id, name, currency, unit_pence from balances
               where account_id = $1 and archived = false
               order by sort, created_at`;

/*  THE COOKIE IS READ SOMEWHERE ELSE, on purpose. openBalanceId() lives in
    lib/data/session.ts with the other cookie readers, and every function here
    takes the id it returns as an argument. That keeps this module free of
    next/headers, which is what lets the seed and the resolution be tested as
    rules against a fake rather than only through a running request. The id
    itself is never trusted: it is matched against this account's own rows and
    anything that does not match falls to the first balance, which is the
    whole authorisation check. */

/** Every balance on the account, in draw order. */
export async function listBalances(accountId: string): Promise<BalanceRef[]> {
  const rows = await query<Row>(LIST, [accountId]).catch(() => [] as Row[]);
  return rows.map(toRef);
}

/** The one an id names, or the first. The first IS the default: balances are
 *  ordered by `sort` and the seeded one sorts zero. */
function resolve(list: BalanceRef[], wanted: string | null | undefined): BalanceRef | null {
  if (!list.length) return null;
  return list.find((b) => b.id === wanted) ?? list[0];
}

/** The balance this account has open, or its first one, or nothing at all.
 *
 *  Nothing at all is the answer for an account whose balances have not been
 *  created yet. A read says so rather than inventing one; a WRITE calls
 *  ensureBalance instead, because a write has to land somewhere. */
export async function currentBalance(accountId: string, open: string | null): Promise<BalanceRef | null> {
  return resolve(await listBalances(accountId), open);
}

/** The account's default balance, for a caller with no browser behind it.
 *
 *  The bot has no cookie. A chat cannot be asked which set of books it means
 *  in the middle of forwarding a slip, so what it gets is the default, and it
 *  is told which one that is rather than left to find out from the ledger. */
export async function defaultBalance(accountId: string): Promise<BalanceRef | null> {
  return (await listBalances(accountId))[0] ?? null;
}

/** The balance a write lands in, created if this account has none yet.
 *
 *  Inside the caller's transaction, so a bet and the balance it belongs to
 *  are written together or not at all. The seed is the same one migration
 *  0011 uses and takes the same three figures off the account, so the balance
 *  a new account gets here is identical to the balance an old account was
 *  given by the migration. `where not exists` makes it a no-op on the second
 *  call, and the unique index added by migration 0017 makes it a no-op on a
 *  second call that arrives at the same instant. */
export async function ensureBalance(
  client: Runner,
  accountId: string,
  wanted: string | null,
): Promise<BalanceRef | null> {
  const first = await client.query<Row>(LIST, [accountId]);
  if (first.rows.length) return resolve(first.rows.map(toRef), wanted);

  await client.query(
    `insert into balances (account_id, name, currency, start_pence, unit_pence, sort)
     select a.id, 'Main', a.currency, a.balance_start_pence, a.unit_pence, 0
       from accounts a
      where a.id = $1
        and not exists (select 1 from balances b where b.account_id = a.id)
     on conflict do nothing`,
    [accountId],
  );

  const after = await client.query<Row>(LIST, [accountId]);
  return resolve(after.rows.map(toRef), wanted);
}
