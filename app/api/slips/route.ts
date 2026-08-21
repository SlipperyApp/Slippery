import { eq } from 'drizzle-orm';
import { getDb, schema, dbReady } from '@/lib/db';
import { viewer } from '@/lib/server/session';
import { ok, unauthorised, noDatabase } from '@/lib/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/* Slip images, deleted on request.
 *
 * The privacy policy commits to ninety days or sooner on request, and this
 * is the sooner. The bets stay: the image is evidence of a bet, not the bet
 * itself, and deleting the picture must never delete the record. */
export async function DELETE() {
  if (!dbReady()) return noDatabase();
  const account = await viewer();
  if (!account) return unauthorised();

  const db = getDb();
  const gone = await db.delete(schema.slipImages)
    .where(eq(schema.slipImages.accountId, account.id))
    .returning({ id: schema.slipImages.id });

  await db.insert(schema.auditLog).values({
    accountId: account.id, entity: 'slip_images', entityId: account.id,
    action: 'delete_all', source: 'user', after: { deleted: gone.length },
  });

  return ok({ deleted: gone.length });
}
