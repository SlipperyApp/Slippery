import { NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';
import { getDb, schema, dbReady } from '@/lib/db';
import { hashPassword, verificationCode, hmac } from '@/lib/server/crypto';
import { validEmail, passwordProblems, sendMail } from '@/lib/server/email';
import { rateLimit, LIMITS } from '@/lib/server/ratelimit';
import { ok, fail, tooMany, noDatabase, readJson } from '@/lib/server/http';
import { findPromo, referralHandle } from '@/lib/server/promo';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/* Step one of six. NOTHING IS WRITTEN TO `accounts` HERE.
 *
 * A signup abandoned at the code screen must not burn the address, or the
 * person who mistyped it once can never use it. The row lives in
 * `pending_signups` until a code proves the address, and only then does an
 * account exist. */
export async function POST(req: NextRequest) {
  if (!dbReady()) return noDatabase();

  const ip = (req.headers.get('x-forwarded-for') || 'local').split(',')[0].trim();
  const limit = await rateLimit('signup:' + ip, LIMITS.signup.max, LIMITS.signup.window);
  if (!limit.ok) return tooMany(limit.retryAfterSeconds);

  const body = await readJson<{ email?: string; password?: string; ageConfirmed?: boolean; promo?: string }>(req);
  const email = String(body.email || '').trim().toLowerCase();
  const password = String(body.password || '');

  if (!validEmail(email)) return fail(400, 'That does not look like an email address.');
  const problems = passwordProblems(password);
  if (problems.length) return fail(400, 'Your password still needs: ' + problems.join(', ') + '.');
  if (!body.ageConfirmed) return fail(400, 'You have to confirm you are 18 or over.');

  const db = getDb();
  const existing = await db.select({ id: schema.accounts.id })
    .from(schema.accounts).where(eq(schema.accounts.email, email)).limit(1);
  /* The same answer either way. Telling somebody an address is taken turns
     this route into a way of finding out who has an account. */
  if (existing.length) {
    return ok({ pending: true, message: 'Check your email for a six digit code.' });
  }

  const code = verificationCode();
  const secret = process.env.AUTH_SECRET || 'dev-only-not-a-secret';
  const promo = findPromo(body.promo) || (referralHandle(body.promo) ? { code: String(body.promo) } : null);

  await db.insert(schema.pendingSignups).values({
    email,
    passwordHash: await hashPassword(password),
    codeHash: hmac(code, secret),
    promoCode: promo ? String(body.promo).trim() : null,
    ageConfirmedAt: new Date(),
    expiresAt: new Date(Date.now() + 30 * 60 * 1000),
  }).onConflictDoUpdate({
    target: schema.pendingSignups.email,
    set: {
      passwordHash: await hashPassword(password),
      codeHash: hmac(code, secret),
      promoCode: promo ? String(body.promo).trim() : null,
      attempts: 0,
      expiresAt: new Date(Date.now() + 30 * 60 * 1000),
    },
  });

  await sendMail({
    to: email,
    subject: 'Your Slippery code',
    text: `Your code is ${code}. It expires in thirty minutes.\n\nIf you did not ask for this, ignore it and nothing happens.`,
  });

  /* The code is never returned, never logged and never echoed back. */
  return ok({ pending: true, message: 'Check your email for a six digit code.' });
}
