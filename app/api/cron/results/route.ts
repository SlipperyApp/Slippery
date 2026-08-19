import { NextRequest } from 'next/server';
import { eq, and, lt, sql } from 'drizzle-orm';
import { getDb, schema, dbReady } from '@/lib/db';
import { ok, noDatabase } from '@/lib/server/http';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/* The sweep. It looks for results and it does nothing else.
 *
 * It does NOT register the Telegram webhook. That belongs to a deliberate
 * admin call, because a cron that repoints a live bot at whichever
 * deployment happened to fire first is not a cutover, it is a coin toss.
 *
 * It does NOT cash anything out. Cash out is undetectable from a feed and is
 * always a user action.
 */
export async function GET(req: NextRequest) {
  /* Vercel signs its cron calls. Anything else is refused, or the sweep is a
     free way to make the deployment do work on demand. */
  const auth = req.headers.get('authorization') || '';
  const secret = process.env.CRON_SECRET;
  if (secret && auth !== 'Bearer ' + secret) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  if (!dbReady()) return noDatabase();

  const db = getDb();

  /* Slip images expire after ninety days, as the privacy policy commits to.
     Swept here rather than in a second cron: it is the same job, run at the
     same time, and one fewer thing to forget to schedule. */
  const expired = await db.delete(schema.slipImages)
    .where(lt(schema.slipImages.deleteAfter, new Date()))
    .returning({ id: schema.slipImages.id });

  /* Reads that were never confirmed do not linger. */
  await db.delete(schema.pendingReads).where(lt(schema.pendingReads.expiresAt, new Date()));
  await db.delete(schema.sessions).where(lt(schema.sessions.expiresAt, new Date()));
  /* The dedupe table only has to remember long enough to outlast Telegram's
     retries, which are minutes, not weeks. */
  await db.delete(schema.telegramUpdates)
    .where(lt(schema.telegramUpdates.seenAt, new Date(Date.now() - 7 * 86400000)));

  const open = await db
    .select({ id: schema.bets.id })
    .from(schema.bets)
    .innerJoin(schema.betState, eq(schema.betState.betId, schema.bets.id))
    .where(and(
      sql`${schema.betState.status} <> 'settled'`,
      /* Antepost is exempt: it sits in Long-term open and is not late merely
         because its event has not happened yet. */
      eq(schema.bets.isAntepost, false),
      lt(schema.bets.eventAt, new Date(Date.now() - 3 * 3600 * 1000)),
    ))
    .limit(500);

  return ok({
    slipImagesDeleted: expired.length,
    awaitingResult: open.length,
    /* Nothing is graded automatically yet: the feeds are scraped, they block
       by IP reputation, and a wrong grade is worse than no grade. The count
       is what the "waiting on a result" sheet reads. */
  });
}
