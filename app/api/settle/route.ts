import { hasDatabase, query, transaction } from '@/lib/server/db';
import { currentAccount } from '@/lib/server/auth';
import { fail, limitOr429, ok } from '@/lib/server/respond';
import { settleBet } from '@/lib/settlement/engine';
import { appendResult, loadBet } from '@/lib/server/bets';
import type { LegResult } from '@/lib/domain/types';

export const runtime = 'nodejs';
export const maxDuration = 60;

/** The on-demand refresh. A Hobby account allows one cron run a day, so this
 *  is how anything settles sooner than the next morning.
 *
 *  It goes through the SAME grader the cron uses. The browser never grades a
 *  bet itself, or there would be two graders. */
export async function POST(req: Request) {
  const limited = limitOr429(req, 'settle', 6, 300);
  if (limited) return limited;

  if (!hasDatabase()) {
    return fail(503, 'no_store', 'This deployment has no database, so there is nothing to settle.');
  }
  const account = await currentAccount();
  if (!account) {
    return fail(401, 'no_session', 'You are looking at the example account. Its bets settle on their own schedule.');
  }

  const open = await query<{ id: string }>(
    `select b.id from bets b
       left join bet_state s on s.bet_id = b.id
      where b.account_id = $1 and coalesce(s.status, 'open') <> 'settled'
        and b.event_at < now() - interval '90 minutes'
      limit 100`,
    [account.id],
  );

  let settled = 0;
  let deferred = 0;

  for (const row of open) {
    try {
      const done = await transaction(async (client) => {
        const { bet } = await loadBet(client, account.id, row.id);
        const legs: LegResult[] = bet.legs.length ? bet.legs.map((l) => l.legResult) : ['open'];
        const outcome = settleBet(legs);
        if (!outcome.type) return false;
        /*  appendResult, not appendEvent: a winner on an exchange owes
         *  commission on its net winnings, and this route never charged it. */
        await appendResult(client, {
          accountId: account.id, betId: row.id, type: outcome.type,
          enteredBy: 'system', note: outcome.why,
        });
        return true;
      });
      if (done) settled += 1; else deferred += 1;
    } catch {
      deferred += 1;
    }
  }

  return ok({
    considered: open.length,
    settled,
    deferred,
    message: settled === 0 && deferred === 0
      ? 'Nothing was waiting to settle.'
      : `${settled} settled, ${deferred} still waiting on a result. Nothing was guessed.`,
  });
}
