import { NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';
import { getDb, schema, dbReady } from '@/lib/db';
import { verifyPassword } from '@/lib/server/crypto';
import { createSession } from '@/lib/server/session';
import { validEmail, passwordProblems } from '@/lib/server/email';
import { rateLimit, LIMITS } from '@/lib/server/ratelimit';
import { ok, fail, tooMany, noDatabase, readJson, publicUser } from '@/lib/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/* ONE DOOR.
 *
 * Sign in and sign up were two screens with a link between them, and the
 * only thing that decided which one you needed was whether an account with
 * your address already existed — which the server knows and you do not. So
 * the screen stopped asking and the server answers: this route takes an
 * address and a password and reports whether that was a sign in or the
 * start of a sign up.
 *
 * ENUMERATION. Telling a stranger whether an address is registered is a real
 * leak, and the login route is careful to give one message for a wrong
 * address and a wrong password alike. This route cannot be, because the
 * whole point is to branch — but it only branches on a CORRECT password.
 * A wrong password on an existing account returns the same single message
 * the login route does, so the only way to learn that an address is
 * registered is to already know its password.
 */
export async function POST(req: NextRequest) {
  if (!dbReady()) return noDatabase();
  const ip = (req.headers.get('x-forwarded-for') || 'local').split(',')[0].trim();
  const limit = await rateLimit('continue:' + ip, LIMITS.login.max, LIMITS.login.window);
  if (!limit.ok) return tooMany(limit.retryAfterSeconds);

  const body = await readJson<{ email?: string; password?: string }>(req);
  const email = String(body.email || '').trim().toLowerCase();
  const password = String(body.password || '');

  if (!validEmail(email)) return fail(400, 'That does not look like an email address.');

  const rows = await getDb().select().from(schema.accounts)
    .where(eq(schema.accounts.email, email)).limit(1);
  const account = rows[0];

  /* Verified either way, so the timing does not answer the question the
     message refuses to. */
  const good = await verifyPassword(password, account?.passwordHash ?? null);

  if (account) {
    if (!good) return fail(401, 'That email and password do not match.');
    await createSession(account.id);
    return ok({ mode: 'signin', user: publicUser(account) });
  }

  /* No account. The password rules apply from here, because this is now the
     first step of creating one rather than a failed attempt at signing in. */
  const problems = passwordProblems(password);
  if (problems.length) return fail(400, problems[0]);

  /* Nothing is written yet. A row appears only once the emailed code is
     verified, which is the rule the signup route already holds. */
  return ok({ mode: 'signup', email });
}
