/* POST /api/auth/verify — confirm the six digit code, then sign in. */
import { json, methodGuard, readJson, clientIp, fail } from '../_lib/http.js';
import { db, ensureSchema, configured } from '../_lib/db.js';
import { guard } from '../_lib/rate.js';
import { checkVerificationCode, createSession, setSessionCookie } from '../_lib/auth.js';

export default async function handler(req, res) {
  if (!methodGuard(req, res, ['POST'])) return;
  try {
    if (!configured()) return json(res, 503, { error: 'No database is connected yet.' });
    if (!(await guard(res, 'verify:' + clientIp(req), 20, 900))) return;
    await ensureSchema();

    const body = await readJson(req, 8 * 1024);
    const email = String(body.email || '').trim().toLowerCase();
    const code = String(body.code || '').trim();
    if (!/^\d{6}$/.test(code)) return json(res, 400, { error: 'The code is six digits.' });

    const rows = await db()`
      SELECT id, display_name FROM users
      WHERE email_lower = ${email} AND deleted_at IS NULL`;
    /* Same message whether the address is unknown or the code is wrong: the
       difference would tell an attacker which addresses have accounts. */
    const generic = { error: 'That code is not right. Check the email or resend it.' };
    if (!rows.length) return json(res, 400, generic);

    const result = await checkVerificationCode(rows[0].id, code);
    if (!result.ok) return json(res, 400, { error: result.reason });

    const token = await createSession(rows[0].id);
    setSessionCookie(res, token);
    return json(res, 200, { ok: true, name: rows[0].display_name });
  } catch (err) {
    return fail(res, err, 'Could not verify that code right now.');
  }
}
