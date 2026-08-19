import { NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';
import { getDb, schema, dbReady } from '@/lib/db';
import { verificationCode, hmac } from '@/lib/server/crypto';
import { sendMail } from '@/lib/server/email';
import { rateLimit, LIMITS } from '@/lib/server/ratelimit';
import { ok, tooMany, noDatabase, readJson } from '@/lib/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  if (!dbReady()) return noDatabase();
  const body = await readJson<{ email?: string }>(req);
  const email = String(body.email || '').trim().toLowerCase();
  const limit = await rateLimit('resend:' + email, 3, 600);
  if (!limit.ok) return tooMany(limit.retryAfterSeconds);

  const db = getDb();
  const rows = await db.select().from(schema.pendingSignups)
    .where(eq(schema.pendingSignups.email, email)).limit(1);
  /* The same answer whether or not a signup is pending. */
  if (rows[0]) {
    const code = verificationCode();
    await db.update(schema.pendingSignups).set({
      codeHash: hmac(code, process.env.AUTH_SECRET || 'dev-only-not-a-secret'),
      expiresAt: new Date(Date.now() + 30 * 60 * 1000),
      attempts: 0,
    }).where(eq(schema.pendingSignups.id, rows[0].id));
    await sendMail({ to: email, subject: 'Your Slippery code', text: `Your code is ${code}. It expires in thirty minutes.` });
  }
  return ok({ sent: true });
}
