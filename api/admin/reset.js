/* POST /api/admin/reset, wipe accounts, so beta testing can reuse addresses.
 *
 * Signing up burns an email and a display name permanently: both are UNIQUE,
 * and the partial index only frees them when the row is actually gone. During
 * beta that makes retesting the signup flow impossible after the first run,
 * which is why this exists.
 *
 * IT IS DESTRUCTIVE AND IT IS NOT UNDOABLE. Three things stand in front of
 * it, and none of them is optional:
 *   · ADMIN_SECRET must be set on the deployment. Unset, the route refuses,
 *     it does not fall back to anything.
 *   · The secret is sent as a header, never a query string, because query
 *     strings land in access logs and browser history.
 *   · The body must name the scope. There is no default, so a request that
 *     forgets one deletes nothing rather than everything.
 *
 * DELETE, not a soft delete. `deleted_at` would leave the rows in place and
 * the partial unique indexes would keep the addresses reserved, which is the
 * exact problem this is here to solve. Everything else cascades from users.
 */
import { timingSafeEqual } from 'node:crypto';
import { json, methodGuard, readJson, clientIp, fail } from '../_lib/http.js';
import { db, ensureSchema, configured } from '../_lib/db.js';
import { guard } from '../_lib/rate.js';

/* Compare without leaking length or position through timing. Buffers of
   different lengths cannot go into timingSafeEqual at all, so that case is
   answered first and identically. */
function secretMatches(given) {
  const want = process.env.ADMIN_SECRET || '';
  if (!want || !given) return false;
  const a = Buffer.from(String(given));
  const b = Buffer.from(want);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

const SCOPES = ['accounts', 'bets', 'sessions'];

export default async function handler(req, res) {
  if (!methodGuard(req, res, ['POST'])) return;
  try {
    if (!process.env.ADMIN_SECRET) {
      return json(res, 503, {
        error: 'Admin actions are switched off on this deployment.',
        needs: ['ADMIN_SECRET']
      });
    }
    /* Rate limited before the secret is checked, so this cannot be used to
       grind at ADMIN_SECRET from a script. */
    if (!(await guard(res, 'admin:' + clientIp(req), 12, 3600))) return;

    const header = req.headers['x-admin-secret'];
    if (!secretMatches(Array.isArray(header) ? header[0] : header)) {
      return json(res, 401, { error: 'Not authorised.' });
    }
    if (!configured()) return json(res, 503, { error: 'No database is connected yet.' });
    await ensureSchema();

    const body = await readJson(req, 4 * 1024);
    const scope = String(body.scope || '');
    if (!SCOPES.includes(scope)) {
      return json(res, 400, {
        error: 'Name a scope. Nothing was deleted.',
        scopes: SCOPES
      });
    }

    const sql = db();

    if (scope === 'sessions') {
      /* Signs everyone out. Accounts and bets are untouched. */
      const rows = await sql`DELETE FROM auth_sessions RETURNING 1`;
      return json(res, 200, { ok: true, scope, sessions: rows.length });
    }

    if (scope === 'bets') {
      const rows = await sql`DELETE FROM bets RETURNING 1`;
      await sql`DELETE FROM slips`;
      await sql`DELETE FROM slip_drafts`;
      return json(res, 200, { ok: true, scope, bets: rows.length });
    }

    /* accounts: everything. Users cascade to bets, slips, drafts, sessions,
       verification codes, resets and redemptions, so one statement is the
       whole job, but rate_limits has no user_id and would otherwise keep a
       fresh signup locked out of the flow it just cleared. */
    const users = await sql`DELETE FROM users RETURNING 1`;
    await sql`DELETE FROM rate_limits`;
    return json(res, 200, {
      ok: true, scope,
      accounts: users.length,
      note: 'Emails and display names are free to reuse.'
    });
  } catch (err) {
    return fail(res, err, 'That reset could not be carried out.');
  }
}
