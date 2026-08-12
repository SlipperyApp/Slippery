/* POST /api/auth/logout */
import { json, methodGuard, fail } from '../http.js';
import { configured } from '../db.js';
import { destroySession, clearSessionCookie } from '../auth.js';

export default async function handler(req, res) {
  if (!methodGuard(req, res, ['POST'])) return;
  try {
    if (configured()) await destroySession(req);
    clearSessionCookie(res);
    return json(res, 200, { ok: true });
  } catch (err) {
    return fail(res, err, 'Could not log you out right now.');
  }
}
