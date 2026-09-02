import { fail, limitOr429, ok, readJson, str } from '@/lib/server/respond';
import { hasDatabase } from '@/lib/server/db';
import { currentAccount } from '@/lib/server/auth';
import { refundRead } from '@/lib/server/reads';

export const runtime = 'nodejs';

/** Flag a misread slip. The credit returns to the allowance: our worst
 *  moment with the reader should not cost a Slipper one of theirs.
 *
 *  ONCE PER READ, NOT ONCE PER PRESS. This route used to decrement the
 *  counter on every call, against a read id it never checked existed, never
 *  checked belonged to the account and never checked had been refunded
 *  before, so the same id could be flagged twenty times in fifteen minutes
 *  and each press returned another slip. That is an unbounded free allowance
 *  behind a button on the most trust-critical screen in the product, and the
 *  only thing standing in front of it was an in-memory rate limit that on
 *  Vercel is per lambda.
 *
 *  The refund is now bound to a nullable refunded_at on the read itself, so a
 *  second press is answered honestly rather than paid out: see
 *  lib/server/reads.ts. */
export async function POST(req: Request) {
  const limited = limitOr429(req, 'flag', 20, 900);
  if (limited) return limited;

  const readId = str((await readJson(req)).readId);
  if (!readId) {
    return fail(400, 'no_read', 'Nothing was flagged: the request did not say which read it was about.');
  }

  const account = hasDatabase() ? await currentAccount() : null;
  if (!account) {
    return ok({
      creditReturned: false,
      message: 'Flagged on this page only. You are looking at the example account, so there is no allowance to credit.',
    });
  }

  const out = await refundRead(account.id, readId);
  if (!out.ok) return fail(404, 'not_found', out.message);

  return ok({ creditReturned: out.credited, message: out.message });
}
