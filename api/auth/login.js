/* POST /api/auth/login
 *
 * Takes a username or an email. People remember the name they chose far more
 * reliably than which of their addresses they signed up with, and the display
 * name is already unique, so there is no reason to insist on one of them.
 */
import { json, methodGuard, readJson, clientIp, fail } from '../_lib/http.js';
import { ensureSchema, configured } from '../_lib/db.js';
import { guard } from '../_lib/rate.js';
import {
  verifyPassword, equalisePasswordTiming, createSession, setSessionCookie,
  identifierProblem, findByIdentifier
} from '../_lib/auth.js';

export default async function handler(req, res) {
  if (!methodGuard(req, res, ['POST'])) return;
  try {
    if (!configured()) return json(res, 503, { error: 'No database is connected yet.' });
    const ip = clientIp(req);
    if (!(await guard(res, 'login:' + ip, 20, 900))) return;
    await ensureSchema();

    const body = await readJson(req, 8 * 1024);
    /* `identifier` is the field now. `email` is still read so an older cached
       build of the page keeps working through a deploy. */
    const identifier = String(body.identifier || body.email || '').trim();
    const password = String(body.password || '');
    if (identifierProblem(identifier) || !password) {
      return json(res, 400, { error: 'That username and password do not match.' });
    }
    /* Per-account limit as well as per-IP, so a botnet cannot spread a
       brute force across addresses and stay under the IP limit. */
    if (!(await guard(res, 'login-acct:' + identifier.toLowerCase(), 10, 900))) return;

    const user = await findByIdentifier(identifier);
    if (!user) {
      /* Hash anyway. Returning early here makes "no such account" measurably
         faster than "wrong password", which is an account enumeration oracle. */
      await equalisePasswordTiming(password);
      return json(res, 401, { error: 'That username and password do not match.' });
    }
    if (!(await verifyPassword(password, user.password_hash))) {
      return json(res, 401, { error: 'That username and password do not match.' });
    }
    if (!user.email_verified) {
      return json(res, 403, {
        error: 'Verify your email first. We can resend the code.',
        needsVerification: true, email: user.email
      });
    }

    const token = await createSession(user.id);
    setSessionCookie(res, token);
    return json(res, 200, { ok: true, name: user.display_name });
  } catch (err) {
    return fail(res, err, 'Could not log you in right now.');
  }
}
