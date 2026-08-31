import { limitOr429, ok, readJson, str } from '@/lib/server/respond';
import { hasDatabase, query } from '@/lib/server/db';
import { currentAccount } from '@/lib/server/auth';

export const runtime = 'nodejs';

/** Flag a misread slip. The credit returns to the allowance: our worst
 *  moment with the reader should not cost a Slipper one of theirs. */
export async function POST(req: Request) {
  const limited = limitOr429(req, 'flag', 20, 900);
  if (limited) return limited;

  const readId = str((await readJson(req)).readId);
  const account = hasDatabase() ? await currentAccount() : null;

  if (account) {
    await query(
      `update accounts set trial_slips_used = greatest(0, trial_slips_used - 1), updated_at = now()
        where id = $1`,
      [account.id],
    ).catch(() => null);
    await query(
      `insert into audit_log (account_id, entity, entity_id, action, source)
       values ($1, 'slip_read', $2, 'flagged', 'you')`,
      [account.id, readId || null],
    ).catch(() => null);
  }

  return ok({
    creditReturned: true,
    message: 'Flagged. The slip is back in your allowance and the read goes for a human look.',
  });
}
