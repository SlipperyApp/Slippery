import { hasDatabase, query } from '@/lib/server/db';
import { setSession, verifyPassword } from '@/lib/server/auth';
import { isEmail } from '@/lib/server/codes';
import { fail, limitOr429, ok, readJson, str } from '@/lib/server/respond';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const limited = limitOr429(req, 'login', 8, 900);
  if (limited) return limited;

  const body = await readJson(req);
  const email = str(body.email).toLowerCase();
  const password = str(body.password);

  if (!isEmail(email) || !password) {
    return fail(400, 'bad_input', 'An email address and a password are both needed.');
  }
  if (!hasDatabase()) {
    return fail(503, 'no_store', 'This deployment has no database. The example account is open at /app without signing in.');
  }

  const rows = await query<{ id: string; password_hash: string | null }>(
    'select id, password_hash from accounts where email = $1 limit 1', [email],
  );
  const account = rows[0];

  // The same message either way, so this route cannot be used to find out
  // which addresses have accounts.
  if (!account?.password_hash || !verifyPassword(password, account.password_hash)) {
    return fail(401, 'no_match', 'That email and password do not match an account.');
  }

  await setSession(account.id, req.headers.get('user-agent') ?? undefined);
  return ok({ next: '/app' });
}
