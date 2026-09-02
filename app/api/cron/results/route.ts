import { NextResponse } from 'next/server';
import { authoriseCron } from '@/lib/server/cron';
import { hasDatabase, transaction, query } from '@/lib/server/db';
import { settleBet } from '@/lib/settlement/engine';
import { loadBet, appendResult } from '@/lib/server/bets';
import type { LegResult } from '@/lib/domain/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** The results sweep. Once a day, because a Hobby account allows nothing
 *  more; anything needing settlement sooner uses POST /api/settle.
 *
 *  Every bet goes through settleBet(), which IS settleMulti(): a single is a
 *  one leg multiple, so there is no second code path to forget to call. */
export async function GET(req: Request) {
  const auth = authoriseCron(req);
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.reason }, { status: 401 });
  if (!hasDatabase()) return NextResponse.json({ ok: true, swept: 0, note: 'No database on this deployment.' });

  const open = await query<{ id: string; account_id: string }>(
    `select b.id, b.account_id
       from bets b
       left join bet_state s on s.bet_id = b.id
      where coalesce(s.status, 'open') <> 'settled'
        and b.event_at < now() - interval '2 hours'
      order by b.event_at asc
      limit 200`,
  ).catch(() => []);

  let settled = 0;
  let deferred = 0;
  let asked = 0;

  for (const row of open) {
    try {
      const graded = await transaction(async (client) => {
        const { bet } = await loadBet(client, row.account_id, row.id);
        const legs: LegResult[] = bet.legs.length
          ? bet.legs.map((l) => l.legResult)
          : ['open'];
        const outcome = settleBet(legs);
        if (!outcome.type) return null;
        /*  appendResult, not appendEvent: a winner on an exchange owes
         *  commission on its net winnings, and this sweep never charged it. */
        await appendResult(client, {
          accountId: row.account_id, betId: row.id, type: outcome.type,
          enteredBy: 'system', note: outcome.why,
        });
        return outcome.type;
      });
      if (graded) settled += 1; else deferred += 1;
    } catch {
      asked += 1;
    }
  }

  return NextResponse.json({
    ok: true,
    considered: open.length,
    settled,
    deferred,
    needsAPerson: asked,
    note: 'A bet whose legs have not all graded defers rather than being guessed at.',
  });
}
