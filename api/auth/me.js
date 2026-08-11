/* GET /api/auth/me — who the session cookie belongs to. */
import { json, methodGuard, fail } from '../_lib/http.js';
import { configured, ensureSchema } from '../_lib/db.js';
import { sessionUser } from '../_lib/auth.js';

export default async function handler(req, res) {
  if (!methodGuard(req, res, ['GET'])) return;
  try {
    if (!configured()) return json(res, 200, { user: null, configured: false });
    await ensureSchema();
    const user = await sessionUser(req);
    if (!user) return json(res, 200, { user: null, configured: true });
    return json(res, 200, {
      configured: true,
      user: {
        name: user.display_name,
        email: user.email,
        emailVerified: user.email_verified,
        unitPence: user.unit_pence
      }
    });
  } catch (err) {
    return fail(res, err, 'Could not read your session.');
  }
}
