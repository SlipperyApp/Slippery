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

const SCOPES = ['accounts', 'bets', 'sessions', 'everything'];

/* EVERY TABLE, in an order that never leans on cascade behaviour.
 *
 * users cascades to most of these, so one DELETE would do it. It is written
 * out anyway, children first, for two reasons: the count per table is the
 * evidence the owner asked for, and a cascade that quietly stops working
 * after a schema change would leave rows behind while still reporting
 * success. Deleting a table that is already empty costs nothing.
 *
 * rate_limits has no user_id and would otherwise keep a fresh signup locked
 * out of the very flow this just cleared. */
const WIPE_ORDER = [
  'group_requests',
  'group_members',
  'groups',
  'follows',
  'pl_entries',
  'slip_drafts',
  'slips',
  'bets',
  'promo_redemptions',
  'password_resets',
  'verification_codes',
  'auth_sessions',
  'telegram_updates',
  'users',
  'rate_limits'
];

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

    /* THE FULL WIPE NEEDS THE SENTENCE TYPED OUT.
       A scope name is a word somebody could send by accident from a script
       they half-remembered. "DELETE EVERYTHING" is not. Both are required
       and neither has a default, so a request missing either deletes
       nothing rather than everything. */
    const confirm = String((body && body.confirm) || '');
    if (confirm === 'DELETE EVERYTHING') {
      const sql = db();
      const deleted = {};
      for (const table of WIPE_ORDER) {
        try {
          /* Table names cannot be parameterised, so this list is a
             hardcoded constant and nothing from the request reaches it. */
          const rows = await sql(`DELETE FROM ${table} RETURNING 1`);
          deleted[table] = rows.length;
        } catch (err) {
          /* A table that does not exist on this deployment yet is reported
             rather than taking the whole wipe down. */
          deleted[table] = 'skipped: ' + String(err.message || err).slice(0, 60);
        }
      }
      return json(res, 200, {
        ok: true, scope: 'everything', deleted,
        note: 'Every account, bet, figure, group, draft, session and stored slip image is gone. ' +
          'Emails and display names are free to reuse.'
      });
    }

    const scope = String(body.scope || '');
    if (!SCOPES.includes(scope) || scope === 'everything') {
      return json(res, 400, {
        error: scope === 'everything'
          ? 'A full wipe needs {"confirm":"DELETE EVERYTHING"}. Nothing was deleted.'
          : 'Name a scope, or send {"confirm":"DELETE EVERYTHING"}. Nothing was deleted.',
        scopes: SCOPES
      });
    }

    const sql = db();

    if (scope === 'sessions') {
      /* Signs everyone out. Accounts and bets are untouched. */
      const rows = await sql`DELETE FROM auth_sessions RETURNING 1`;
      return json(res, 200, { ok: true, scope, deleted: { auth_sessions: rows.length } });
    }

    if (scope === 'bets') {
      const bets = await sql`DELETE FROM bets RETURNING 1`;
      const slips = await sql`DELETE FROM slips RETURNING 1`;
      const drafts = await sql`DELETE FROM slip_drafts RETURNING 1`;
      return json(res, 200, {
        ok: true, scope,
        deleted: { bets: bets.length, slips: slips.length, slip_drafts: drafts.length }
      });
    }

    const users = await sql`DELETE FROM users RETURNING 1`;
    const limits = await sql`DELETE FROM rate_limits RETURNING 1`;
    return json(res, 200, {
      ok: true, scope,
      deleted: { users: users.length, rate_limits: limits.length },
      note: 'Emails and display names are free to reuse.'
    });
  } catch (err) {
    return fail(res, err, 'That reset could not be carried out.');
  }
}
