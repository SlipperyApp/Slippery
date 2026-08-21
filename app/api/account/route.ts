import { NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';
import { getDb, schema, dbReady } from '@/lib/db';
import { viewer, destroySession } from '@/lib/server/session';
import { ok, fail, unauthorised, noDatabase, readJson } from '@/lib/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

/* RESET AND DELETE ARE DIFFERENT THINGS, DELIBERATELY.
 *
 * Reset empties the ledger and keeps the account, which is what somebody
 * wants after testing with junk data. Delete removes the account. They are
 * separate controls in the interface and separate verbs here, because one is
 * recoverable by re-importing and the other is not.
 *
 * Both offer an export first, and export never stops working: a betting
 * record belongs to whoever kept it.
 */
export async function POST(req: NextRequest) {
  if (!dbReady()) return noDatabase();
  const account = await viewer();
  if (!account) return unauthorised();

  const body = await readJson<{ action?: string }>(req);
  if (body.action !== 'reset') return fail(400, 'Unknown action.');

  const db = getDb();
  const removed = await db.transaction(async (tx) => {
    /* Cascades from bets take the legs, the settlement events and the
       derived state with them. The account, its settings and its groups
       stay: that is the whole difference from deleting. */
    const bets = await tx.delete(schema.bets)
      .where(eq(schema.bets.accountId, account.id)).returning({ id: schema.bets.id });
    const pl = await tx.delete(schema.plEntries)
      .where(eq(schema.plEntries.accountId, account.id)).returning({ id: schema.plEntries.id });
    await tx.delete(schema.slipImages).where(eq(schema.slipImages.accountId, account.id));
    await tx.insert(schema.auditLog).values({
      accountId: account.id, entity: 'account', entityId: account.id,
      action: 'reset', source: 'user',
      after: { betsDeleted: bets.length, plEntriesDeleted: pl.length },
    });
    return { bets: bets.length, plEntries: pl.length };
  });

  return ok({ reset: removed });
}

export async function DELETE() {
  if (!dbReady()) return noDatabase();
  const account = await viewer();
  if (!account) return unauthorised();

  const db = getDb();
  /* Everything cascades from the account row. Written to the audit log
     first, because after the delete there is no account to attribute it to. */
  await db.insert(schema.auditLog).values({
    accountId: null, entity: 'account', entityId: account.id,
    action: 'delete', source: 'user',
    after: { email: account.email },
  });
  await db.delete(schema.accounts).where(eq(schema.accounts.id, account.id));
  await destroySession();
  return ok({ deleted: true });
}
