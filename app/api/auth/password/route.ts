import { eq } from 'drizzle-orm';
import { getDb, schema, dbReady } from '@/lib/db';
import { viewer } from '@/lib/server/session';
import { verificationCode, hmac } from '@/lib/server/crypto';
import { sendMail } from '@/lib/server/email';
import { rateLimit } from '@/lib/server/ratelimit';
import { ok, unauthorised, noDatabase, tooMany } from '@/lib/server/http';
import { env } from '@/lib/server/env';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/* Changing a password by emailed link, not in the page.
 *
 * A form that changes a password inside an already-open session protects
 * nothing: whoever is at the keyboard is already signed in. The link proves
 * the person still holds the address, which is the only thing worth
 * proving here. */
export async function POST() {
  if (!dbReady()) return noDatabase();
  const account = await viewer();
  if (!account) return unauthorised();

  const limit = await rateLimit('pwreset:' + account.id, 3, 900);
  if (!limit.ok) return tooMany(limit.retryAfterSeconds);

  const code = verificationCode();
  const secret = env.authSecret() || 'dev-only-not-a-secret';

  await getDb().insert(schema.pendingSignups).values({
    email: account.email,
    passwordHash: '',
    codeHash: hmac('pw:' + code, secret),
    expiresAt: new Date(Date.now() + 30 * 60 * 1000),
  }).onConflictDoUpdate({
    target: schema.pendingSignups.email,
    set: { codeHash: hmac('pw:' + code, secret), expiresAt: new Date(Date.now() + 30 * 60 * 1000), attempts: 0 },
  });

  await sendMail({
    to: account.email,
    subject: 'Change your Slippery password',
    text: `Your code is ${code}. It expires in thirty minutes.\n\nIf you did not ask for this, ignore it and nothing changes.`,
  });

  /* The code is never returned, never logged and never echoed. */
  return ok({ sent: true });
}
