import { eq } from 'drizzle-orm';
import { getDb, schema, dbReady } from '@/lib/db';
import { viewer } from '@/lib/server/session';
import { makeLinkCode, LINK_TTL_MS } from '@/lib/server/crypto';
import { rateLimit, LIMITS } from '@/lib/server/ratelimit';
import { ok, unauthorised, noDatabase, tooMany } from '@/lib/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/* Issuing a link code, and unlinking.
 *
 * THE BROWSER NEVER PICKS THE CODE. A code the browser chooses is a code the
 * browser can choose to be somebody else's. */
export async function POST() {
  if (!dbReady()) return noDatabase();
  const account = await viewer();
  if (!account) return unauthorised();

  const limit = await rateLimit('link:' + account.id, LIMITS.linkCode.max, LIMITS.linkCode.window);
  if (!limit.ok) return tooMany(limit.retryAfterSeconds);

  const linkCode = makeLinkCode();
  const expiresAt = new Date(Date.now() + LINK_TTL_MS);
  await getDb().update(schema.accounts)
    .set({ linkCode, linkCodeExpiresAt: expiresAt })
    .where(eq(schema.accounts.id, account.id));

  return ok({ linkCode, expiresAt: expiresAt.toISOString(), ttlMs: LINK_TTL_MS });
}

/** Unlinking leaves every bet exactly where it is. */
export async function DELETE() {
  if (!dbReady()) return noDatabase();
  const account = await viewer();
  if (!account) return unauthorised();

  const db = getDb();
  const gone = await db.delete(schema.telegramLinks)
    .where(eq(schema.telegramLinks.accountId, account.id))
    .returning({ id: schema.telegramLinks.telegramUserId });

  await db.insert(schema.auditLog).values({
    accountId: account.id, entity: 'telegram_link', entityId: account.id,
    action: 'unlink', source: 'user',
  });

  return ok({ unlinked: gone.length, betsUntouched: true });
}
