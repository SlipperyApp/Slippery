import { NextRequest } from 'next/server';
import { eq, and, asc } from 'drizzle-orm';
import { getDb, schema, dbReady } from '@/lib/db';
import { viewer } from '@/lib/server/session';
import { ok, fail, unauthorised, noDatabase } from '@/lib/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/* One bet, with its legs and its change history.
 *
 * The history is the audit log, not the settlement events: the events are how
 * the money is computed and are never read for display, and what somebody
 * wants to see here is what was changed, by whom, and whether it happened
 * after the result was already known. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!dbReady()) return noDatabase();
  const account = await viewer();
  if (!account) return unauthorised();
  const { id } = await params;

  const db = getDb();
  const rows = await db.select({ bet: schema.bets, state: schema.betState })
    .from(schema.bets)
    .leftJoin(schema.betState, eq(schema.betState.betId, schema.bets.id))
    .where(and(eq(schema.bets.id, id), eq(schema.bets.accountId, account.id)))
    .limit(1);
  if (!rows[0]) return fail(404, 'No such bet.');

  const legs = await db.select().from(schema.betLegs)
    .where(eq(schema.betLegs.betId, id)).orderBy(asc(schema.betLegs.seq));
  const history = await db.select().from(schema.auditLog)
    .where(and(eq(schema.auditLog.entity, 'bet'), eq(schema.auditLog.entityId, id)))
    .orderBy(asc(schema.auditLog.createdAt));

  return ok({
    bet: rows[0].bet,
    state: rows[0].state,
    legs,
    history: history.map((h) => ({
      action: h.action, at: h.createdAt, source: h.source,
      /* Flagged, because a group may count late edits on its leaderboard. */
      afterResultKnown: h.afterResultKnown,
    })),
  });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!dbReady()) return noDatabase();
  const account = await viewer();
  if (!account) return unauthorised();
  const { id } = await params;
  const db = getDb();
  const done = await db.delete(schema.bets)
    .where(and(eq(schema.bets.id, id), eq(schema.bets.accountId, account.id)))
    .returning({ id: schema.bets.id });
  if (!done.length) return fail(404, 'No such bet.');
  await db.insert(schema.auditLog).values({
    accountId: account.id, entity: 'bet', entityId: id, action: 'delete', source: 'user',
  });
  return ok({ deleted: id });
}
