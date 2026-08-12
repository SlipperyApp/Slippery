/* POST /api/auth/reset, finish a password reset and sign in.
 *
 * Signing in on success is deliberate: someone who has just proved control of
 * the mailbox and set a new password has done everything a login would ask
 * for, and sending them back to a login form to type it again is the step
 * where people give up.
 */
import { json, methodGuard, readJson, clientIp, fail } from '../http.js';
import { ensureSchema, configured } from '../db.js';
import { guard } from '../rate.js';
import {
  identifierProblem, findByIdentifier, checkResetCode, setPassword,
  passwordProblem, createSession, setSessionCookie
} from '../auth.js';

export default async function handler(req, res) {
  if (!methodGuard(req, res, ['POST'])) return;
  try {
    if (!configured()) return json(res, 503, { error: 'No database is connected yet.' });
    if (!(await guard(res, 'reset:' + clientIp(req), 20, 3600))) return;
    await ensureSchema();

    const body = await readJson(req, 8 * 1024);
    const identifier = String(body.identifier || body.email || '').trim();
    const code = String(body.code || '').trim();
    const password = String(body.password || '');

    let problem = identifierProblem(identifier);
    if (problem) return json(res, 400, { error: problem, field: 'identifier' });
    if (!/^\d{6}$/.test(code)) return json(res, 400, { error: 'The code is six digits.', field: 'code' });
    problem = passwordProblem(password);
    if (problem) return json(res, 400, { error: problem, field: 'password' });

    const user = await findByIdentifier(identifier);
    /* No account behind that identifier. The same wording as a wrong code, so
       this endpoint cannot be used to enumerate addresses either. */
    if (!user) return json(res, 400, { error: 'That code is not right. Check the email or ask for another.', field: 'code' });

    const check = await checkResetCode(user.id, code);
    if (!check.ok) return json(res, 400, { error: check.reason, field: 'code' });

    await setPassword(user.id, password);
    const token = await createSession(user.id);
    setSessionCookie(res, token);
    return json(res, 200, { ok: true, name: user.display_name });
  } catch (err) {
    return fail(res, err, 'Could not reset that password right now.');
  }
}
