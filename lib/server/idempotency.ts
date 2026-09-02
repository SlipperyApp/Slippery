/** One write, however many times it is asked for.
 *
 *  settlement_events is append only and there is no edit to undo a duplicate
 *  with: a phone that sends "won" twice appends two results and every figure
 *  folded off that bet is wrong for good. So every write path that appends
 *  takes a key the client generated once for that intended write, and the key
 *  is claimed inside the SAME transaction as the write itself.
 *
 *  A first request claims the key, does the work and stores what it returned.
 *  A duplicate finds the key taken and gets that stored answer back, so the
 *  caller sees success rather than a conflict it would have to interpret. A
 *  request that fails rolls the claim back with the write, so a genuine retry
 *  after a failure still works.
 *
 *  A missing key is allowed and simply does the work. The alternative is a
 *  route that refuses an honest request because an older client did not know
 *  to send one, and the guard is worth more on the paths that send it than a
 *  hard failure is worth on the paths that do not. */

import type { PoolClient } from 'pg';

export type Replay<T> = { replayed: boolean; value: T };

/** Keys are client generated, so their shape is checked before one reaches a
 *  query. Long enough to be unguessable, short enough not to be a payload. */
export function validKey(key: unknown): key is string {
  return typeof key === 'string' && /^[A-Za-z0-9_-]{16,120}$/.test(key);
}

/** Run `work` once for this key, or replay what it returned last time.
 *
 *  `work` must do all of its writing on the client it is handed, so the claim
 *  and the write share one transaction. Anything it returns has to survive a
 *  round trip through jsonb, because that is what a duplicate gets back. */
export async function once<T>(
  client: PoolClient,
  accountId: string,
  scope: string,
  key: string | null,
  work: () => Promise<T>,
): Promise<Replay<T>> {
  if (!key) return { replayed: false, value: await work() };

  const claim = await client.query<{ key: string }>(
    `insert into write_keys (account_id, key, scope) values ($1,$2,$3)
       on conflict (account_id, key) do nothing
       returning key`,
    [accountId, key, scope],
  );

  if (!claim.rows.length) {
    const prior = await client.query<{ scope: string; result: unknown }>(
      'select scope, result from write_keys where account_id = $1 and key = $2',
      [accountId, key],
    );
    const row = prior.rows[0];
    /*  A key reused for a different operation is a client bug, and replaying
     *  a settlement's answer to a bet creation would be a worse one. It is
     *  refused by name so the mistake is findable. */
    if (row && row.scope !== scope) throw new Error('key_reused');
    return { replayed: true, value: (row?.result ?? null) as T };
  }

  const value = await work();
  await client.query(
    'update write_keys set result = $1 where account_id = $2 and key = $3',
    [JSON.stringify(value ?? null), accountId, key],
  );
  return { replayed: false, value };
}
