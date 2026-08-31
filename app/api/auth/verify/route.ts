import { hasDatabase, query } from '@/lib/server/db';
import { hashCode, setSession } from '@/lib/server/auth';
import { fail, limitOr429, ok, readJson, str } from '@/lib/server/respond';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const limited = limitOr429(req, 'verify', 10, 900);
  if (limited) return limited;

  const body = await readJson(req);
  const email = str(body.email).toLowerCase();
  const code = str(body.code);

  if (!/^\d{6}$/.test(code)) return fail(400, 'bad_code', 'Six digits, and that is not six digits.');
  if (!hasDatabase()) return fail(503, 'no_store', 'This deployment has no database, so there is nothing to check the code against.');

  const rows = await query<{ id: string }>(
    `select id from verification_codes
      where email = $1 and code_hash = $2 and purpose = 'signup'
        and used_at is null and expires_at > now()
      order by created_at desc limit 1`,
    [email, hashCode(email, code)],
  );
  if (!rows.length) return fail(400, 'no_match', 'That code did not match, or it has expired. Send a new one.');

  await query('update verification_codes set used_at = now() where id = $1', [rows[0].id]);

  const acc = await query<{ id: string }>('select id from accounts where email = $1', [email]);
  if (!acc.length) return fail(400, 'no_account', 'That address has no account waiting on a code.');

  await setSession(acc[0].id, req.headers.get('user-agent') ?? undefined);
  return ok({ next: '/signup/name' });
}
