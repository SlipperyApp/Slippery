import { NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';
import { getDb, schema, dbReady } from '@/lib/db';
import { verifyPassword } from '@/lib/server/crypto';
import { rateLimit, LIMITS } from '@/lib/server/ratelimit';
import { ok, fail, tooMany, noDatabase, readJson, publicUser } from '@/lib/server/http';
import { createSession } from '@/lib/server/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  if (!dbReady()) return noDatabase();
  const ip = (req.headers.get('x-forwarded-for') || 'local').split(',')[0].trim();
  const limit = await rateLimit('login:' + ip, LIMITS.login.max, LIMITS.login.window);
  if (!limit.ok) return tooMany(limit.retryAfterSeconds);

  const body = await readJson<{ email?: string; password?: string }>(req);
  const email = String(body.email || '').trim().toLowerCase();
  const rows = await getDb().select().from(schema.accounts)
    .where(eq(schema.accounts.email, email)).limit(1);
  const account = rows[0];

  /* One message for a wrong address and a wrong password alike, and the hash
     is verified either way so the timing does not answer the question the
     message refuses to. */
  const good = await verifyPassword(String(body.password || ''), account?.passwordHash ?? null);
  if (!account || !good) return fail(401, 'That email and password do not match.');

  await createSession(account.id);
  return ok({ user: publicUser(account) });
}
