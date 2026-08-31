import { hasDatabase, query } from '@/lib/server/db';
import { hashCode, hashPassword, newCode } from '@/lib/server/auth';
import { isEmail, passwordOk, generateLinkCode } from '@/lib/server/codes';
import { sendEmail, verificationEmail } from '@/lib/server/mail';
import { bool, fail, limitOr429, ok, readJson, str } from '@/lib/server/respond';
import { TRIAL_DAYS, TRIAL_SLIPS } from '@/lib/domain/trial';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const limited = limitOr429(req, 'signup', 6, 900);
  if (limited) return limited;

  const body = await readJson(req);
  const email = str(body.email).toLowerCase();
  const password = str(body.password);

  if (!isEmail(email)) return fail(400, 'bad_email', 'That address does not look right.');
  if (!passwordOk(password)) return fail(400, 'weak_password', 'The password does not meet all three rules yet.');
  if (!bool(body.ageConfirmed)) return fail(400, 'age', 'Confirming you are 18 or over is required.');
  if (!bool(body.termsAccepted)) return fail(400, 'terms', 'Accepting the Terms is required.');

  const code = newCode();

  if (!hasDatabase()) {
    // Degrade honestly rather than pretending an account was made.
    return fail(503, 'no_store', 'This deployment has no database, so no account was created. Nothing was sent.');
  }

  const existing = await query<{ id: string }>('select id from accounts where email = $1', [email]);
  if (existing.length === 0) {
    await query(
      `insert into accounts (email, password_hash, age_confirmed_at, terms_accepted_at,
                             link_code, trial_ends_at, trial_slips_allowed)
       values ($1, $2, now(), now(), $3, now() + ($4 || ' days')::interval, $5)`,
      [email, hashPassword(password), generateLinkCode(), String(TRIAL_DAYS), TRIAL_SLIPS],
    );
  }

  await query(
    `insert into verification_codes (email, code_hash, purpose, expires_at)
     values ($1, $2, 'signup', now() + interval '10 minutes')`,
    [email, hashCode(email, code)],
  );

  const mail = verificationEmail(code);
  const sent = await sendEmail(email, mail.subject, mail.text);

  // The same answer whether or not the address already had an account, so
  // this route cannot be used to find out who has one.
  return ok({ emailSent: sent.sent, next: '/signup/verify' });
}
