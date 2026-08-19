import { NextRequest } from 'next/server';
import { eq, and, gt } from 'drizzle-orm';
import { getDb, schema, dbReady } from '@/lib/db';
import { hmac, safeEqual, makeLinkCode } from '@/lib/server/crypto';
import { rateLimit, LIMITS } from '@/lib/server/ratelimit';
import { ok, fail, tooMany, noDatabase, readJson } from '@/lib/server/http';
import { createSession } from '@/lib/server/session';
import { applyPromoOnSignup, startTrial } from '@/lib/server/onboarding';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/* Step two. The address is proved, so now the account exists. */
export async function POST(req: NextRequest) {
  if (!dbReady()) return noDatabase();

  const body = await readJson<{ email?: string; code?: string }>(req);
  const email = String(body.email || '').trim().toLowerCase();
  const code = String(body.code || '').replace(/\D/g, '');

  const limit = await rateLimit('verify:' + email, LIMITS.verify.max, LIMITS.verify.window);
  if (!limit.ok) return tooMany(limit.retryAfterSeconds);

  const db = getDb();
  const rows = await db.select().from(schema.pendingSignups)
    .where(and(eq(schema.pendingSignups.email, email), gt(schema.pendingSignups.expiresAt, new Date())))
    .limit(1);
  const pending = rows[0];
  if (!pending) return fail(400, 'That code has expired. Ask for a new one.');

  const secret = process.env.AUTH_SECRET || 'dev-only-not-a-secret';
  if (!safeEqual(hmac(code, secret), pending.codeHash)) {
    await db.update(schema.pendingSignups)
      .set({ attempts: pending.attempts + 1 })
      .where(eq(schema.pendingSignups.id, pending.id));
    return fail(400, 'That code does not match.');
  }

  const account = await db.transaction(async (tx) => {
    const [created] = await tx.insert(schema.accounts).values({
      email,
      passwordHash: pending.passwordHash,
      ageConfirmedAt: pending.ageConfirmedAt,
      linkCode: makeLinkCode(),
      linkCodeExpiresAt: null,
    }).returning();
    await tx.delete(schema.pendingSignups).where(eq(schema.pendingSignups.id, pending.id));
    await startTrial(tx, created.id, pending.promoCode);
    await applyPromoOnSignup(tx, created.id, pending.promoCode);
    return created;
  });

  await createSession(account.id);
  return ok({ user: { id: account.id, email: account.email }, next: 'name' });
}
