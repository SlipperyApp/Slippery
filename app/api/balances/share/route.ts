import { hasDatabase, query } from '@/lib/server/db';
import { currentAccount } from '@/lib/server/auth';
import { fail, limitOr429, ok, readJson, str } from '@/lib/server/respond';
import { generateShareToken } from '@/lib/server/codes';
import { sharePath } from '@/lib/data/share';

export const runtime = 'nodejs';

/** Turn a balance's public link on, or off.
 *
 *  THE TOKEN IS THE PERMISSION, so this route writes exactly one column.
 *  Turning it on writes a fresh token; turning it off writes null. There is
 *  no visibility flag beside it that could say public while the token is
 *  gone, and no expiry that could quietly outlive a revocation.
 *
 *  REVOCATION IS IMMEDIATE because nothing is cached and nothing else is
 *  consulted: the next request looks the token up, finds nothing, and gets
 *  the same 404 as a token that was never issued.
 *
 *  A SECOND "ON" ISSUES A NEW TOKEN. That is deliberate and it is the only
 *  way to take a link back from somebody who already has it: turning it off
 *  and on again is how a person expects to change a lock. */
export async function POST(req: Request) {
  const limited = limitOr429(req, 'share', 30, 300);
  if (limited) return limited;

  const body = await readJson(req);
  const balanceId = str(body.balanceId);
  if (!balanceId) return fail(400, 'no_balance', 'That request named no balance. Nothing was written.');

  /*  Anything but a literal true turns it OFF. A permission that could be
      granted by a truthy string arriving from somewhere unexpected is the
      wrong way round: the safe reading of an unclear request is off. */
  const on = body.on === true;

  if (!hasDatabase()) {
    return fail(503, 'no_store',
      'This deployment has no database, so nothing was written. The example account already has one balance shared, so you can see what the page looks like.');
  }
  const account = await currentAccount();
  if (!account) {
    return fail(401, 'no_session',
      'You are looking at the example account, so nothing was written. Start your own and this shares a balance of yours.');
  }

  const token = on ? generateShareToken() : null;
  /*  Scoped to the account in the WHERE clause, which is the authorisation
      check: a balance id belonging to somebody else matches no row here and
      comes back as not found rather than as a share nobody asked for. */
  const rows = await query<{ id: string }>(
    'update balances set share_token = $1 where id = $2 and account_id = $3 returning id',
    [token, balanceId, account.id],
  ).catch(() => [] as { id: string }[]);

  if (!rows.length) return fail(404, 'not_found', 'That is not a balance on your account.');
  return ok({ balanceId, shared: on, path: token ? sharePath(token) : null });
}
