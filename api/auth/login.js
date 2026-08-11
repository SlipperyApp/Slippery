/* POST /api/auth/login */
import { json, methodGuard, readJson, clientIp, fail } from '../_lib/http.js';
import { db, ensureSchema, configured } from '../_lib/db.js';
import { guard } from '../_lib/rate.js';
import {
  verifyPassword, equalisePasswordTiming, createSession, setSessionCookie, emailProblem
} from '../_lib/auth.js';

export default async function handler(req, res) {
  if (!methodGuard(req, res, ['POST'])) return;
  try {
    if (!configured()) return json(res, 503, { error: 'No database is connected yet.' });
    const ip = clientIp(req);
    if (!(await guard(res, 'login:' + ip, 20, 900))) return;
    await ensureSchema();

    const body = await readJson(req, 8 * 1024);
    const email = String(body.email || '').trim();
    const password = String(body.password || '');
    if (emailProblem(email) || !password) {
      return json(res, 400, { error: 'That email and password do not match.' });
    }
    /* Per-account limit as well as per-IP, so a botnet cannot spread a
       brute force across addresses and stay under the IP limit. */
    if (!(await guard(res, 'login-acct:' + email.toLowerCase(), 10, 900))) return;

    const rows = await db()`
      SELECT id, display_name, password_hash, email_verified FROM users
      WHERE email_lower = ${email.toLowerCase()} AND deleted_at IS NULL`;

    if (!rows.length) {
      /* Hash anyway. Returning early here makes "no such account" measurably
         faster than "wrong password", which is an account enumeration oracle. */
      await equalisePasswordTiming(password);
      return json(res, 401, { error: 'That email and password do not match.' });
    }
    const user = rows[0];
    if (!(await verifyPassword(password, user.password_hash))) {
      return json(res, 401, { error: 'That email and password do not match.' });
    }
    if (!user.email_verified) {
      return json(res, 403, { error: 'Verify your email first. We can resend the code.', needsVerification: true });
    }

    const token = await createSession(user.id);
    setSessionCookie(res, token);
    return json(res, 200, { ok: true, name: user.display_name });
  } catch (err) {
    return fail(res, err, 'Could not log you in right now.');
  }
}
