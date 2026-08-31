import { hasDatabase, query } from '@/lib/server/db';
import { hashCode, newCode } from '@/lib/server/auth';
import { isEmail } from '@/lib/server/codes';
import { sendEmail } from '@/lib/server/mail';
import { fail, limitOr429, ok, readJson, str } from '@/lib/server/respond';

export const runtime = 'nodejs';

/** Deliberately outside the sign-in attempt limit, because somebody locked
 *  out by attempts is exactly the person who needs this. */
export async function POST(req: Request) {
  const limited = limitOr429(req, 'reset', 4, 900);
  if (limited) return limited;

  const email = str((await readJson(req)).email).toLowerCase();
  if (!isEmail(email)) return fail(400, 'bad_email', 'That address does not look right.');

  if (hasDatabase()) {
    const rows = await query<{ id: string }>('select id from accounts where email = $1', [email]);
    if (rows.length) {
      const code = newCode();
      await query(
        `insert into verification_codes (email, code_hash, purpose, expires_at)
         values ($1, $2, 'reset', now() + interval '1 hour')`,
        [email, hashCode(email, code)],
      );
      await sendEmail(email, 'Set a new Slippery password', [
        `Your code is ${code}.`,
        '',
        'It is good for one hour and can be used once.',
        'If you did not ask for this, nothing has changed and you can ignore it.',
      ].join('\n'));
    }
  }

  // Always the same answer. Telling you whether an address exists would tell
  // anybody else too.
  return ok({ sent: true });
}
