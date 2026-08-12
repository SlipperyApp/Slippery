/* POST /api/auth/resend, issue a fresh verification code. */
import { json, methodGuard, readJson, clientIp, fail } from '../http.js';
import { db, ensureSchema, configured } from '../db.js';
import { guard } from '../rate.js';
import * as mail from '../mail.js';
import { issueVerificationCode, emailProblem } from '../auth.js';

export default async function handler(req, res) {
  if (!methodGuard(req, res, ['POST'])) return;
  try {
    if (!configured()) return json(res, 503, { error: 'No database is connected yet.' });
    if (!(await guard(res, 'resend:' + clientIp(req), 5, 900))) return;
    await ensureSchema();

    const body = await readJson(req, 8 * 1024);
    const email = String(body.email || '').trim();
    if (emailProblem(email)) return json(res, 400, { error: 'Enter a valid email address.' });

    const rows = await db()`
      SELECT id FROM users
      WHERE email_lower = ${email.toLowerCase()} AND deleted_at IS NULL AND email_verified = false`;
    /* Always report success. A different answer for "no such account" turns
       this endpoint into an address checker. */
    if (rows.length) {
      const code = await issueVerificationCode(rows[0].id);
      if (mail.configured()) await mail.sendVerificationEmail(email, code);
    }
    return json(res, 200, { ok: true });
  } catch (err) {
    return fail(res, err, 'Could not resend that code right now.');
  }
}
