/* POST /api/auth/resend, issue a fresh verification code. */
import { json, methodGuard, readJson, clientIp, fail } from '../http.js';
import { db, ensureSchema, configured } from '../db.js';
import { guard } from '../rate.js';
import * as mail from '../mail.js';
import { issueVerificationCode, refreshPendingCode, emailProblem } from '../auth.js';

export default async function handler(req, res) {
  if (!methodGuard(req, res, ['POST'])) return;
  try {
    if (!configured()) return json(res, 503, { error: 'No database is connected yet.' });
    if (!(await guard(res, 'resend:' + clientIp(req), 5, 900))) return;
    await ensureSchema();

    const body = await readJson(req, 8 * 1024);
    const email = String(body.email || '').trim();
    if (emailProblem(email)) return json(res, 400, { error: 'Enter a valid email address.' });

    /* Two places an outstanding code can live. Since an unverified signup
       no longer creates a users row, the pending table is the usual one;
       the users branch is for accounts made before that change and for
       deployments with no mail provider, which still sign up directly. */
    const lower = email.toLowerCase();
    const rows = await db()`
      SELECT id FROM users
      WHERE email_lower = ${lower} AND deleted_at IS NULL AND email_verified = false`;

    /* Whether the ADDRESS exists stays secret, or this endpoint becomes an
       account checker. Whether the SEND worked does not: reporting "New
       code sent" when the mailer is not configured, or when the send threw,
       leaves somebody refreshing an inbox that will never receive anything.
       That is the dead end this button was reported for.

       So: the same answer for a known and an unknown address, and a
       different answer when we know the mail did not leave. */
    if (!mail.configured()) {
      return json(res, 503, {
        error: 'This deployment cannot send email yet, so a new code cannot be issued.',
        needs: 'mail'
      });
    }
    const code = rows.length
      ? await issueVerificationCode(rows[0].id)
      : await refreshPendingCode(lower);
    if (code) {
      try {
        await mail.sendVerificationEmail(email, code);
      } catch (err) {
        console.error('resend: send failed', err && err.message);
        return json(res, 502, { error: 'The email did not go out. Try again in a moment.' });
      }
    }
    return json(res, 200, { ok: true, from: mail.fromAddress() });
  } catch (err) {
    return fail(res, err, 'Could not resend that code right now.');
  }
}
