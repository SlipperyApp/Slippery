import { hasDatabase, query } from '@/lib/server/db';
import { hashCode, newCode } from '@/lib/server/auth';
import { isEmail } from '@/lib/server/codes';
import { sendEmail, verificationEmail } from '@/lib/server/mail';
import { fail, limitOr429, ok, readJson, str } from '@/lib/server/respond';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const limited = limitOr429(req, 'resend', 3, 300);
  if (limited) return limited;

  const email = str((await readJson(req)).email).toLowerCase();
  if (!isEmail(email)) return fail(400, 'bad_email', 'That address does not look right.');
  if (!hasDatabase()) return fail(503, 'no_store', 'This deployment has no database, so no code was sent.');

  const code = newCode();
  await query(
    `insert into verification_codes (email, code_hash, purpose, expires_at)
     values ($1, $2, 'signup', now() + interval '10 minutes')`,
    [email, hashCode(email, code)],
  );
  const mail = verificationEmail(code);
  const sent = await sendEmail(email, mail.subject, mail.text);
  return ok({ emailSent: sent.sent });
}
