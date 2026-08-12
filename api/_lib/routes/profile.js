/* POST /api/auth/profile — the settings that belong to the account.
 *
 * These were never persisted. Unit size and privacy lived in the browser's
 * S object and nowhere else, so:
 *   · setting a unit of £50 during setup left the database on its 10000
 *     default, and every group board therefore ranked you against a unit
 *     size you had not chosen. Units are the whole basis of the ranking,
 *     so this was not a cosmetic loss.
 *   · privacy was a toggle that changed a label and nothing else. The app
 *     said "your figures are now private" and no server ever heard.
 *
 * Both go in the users row. Nothing else does: theme, odds format and the
 * rest are display preferences that only matter on the device looking at
 * them, and putting them here would mean a write on every tap of a segment
 * control.
 */
import { json, methodGuard, readJson, fail } from '../http.js';
import { db, ensureSchema, configured } from '../db.js';
import { sessionUser } from '../auth.js';
import { guard } from '../rate.js';

/* A unit is a stake size in pence. The floor is a penny rather than zero
   because every board divides by it, and the ceiling is there so a typo
   cannot make somebody's entire record round to 0.00u. */
const MIN_UNIT = 1;
const MAX_UNIT = 100_000_00;

export const PRIVACIES = ['public', 'friends', 'private'];

export default async function handler(req, res) {
  if (!methodGuard(req, res, ['POST'])) return;
  try {
    if (!configured()) return json(res, 503, { error: 'No database is connected yet.' });
    await ensureSchema();

    const user = await sessionUser(req);
    if (!user) return json(res, 401, { error: 'Log in to change your settings.' });
    if (!(await guard(res, 'profile:' + user.id, 60, 3600))) return;

    const body = await readJson(req, 4 * 1024);

    /* Both fields are optional, and absent is different from invalid: a
       client saving only privacy must not have its unit reset to a
       default. Undefined means "leave it". */
    const sets = {};
    if (body.unitPence !== undefined) {
      const unit = Math.round(Number(body.unitPence));
      if (!Number.isFinite(unit) || unit < MIN_UNIT || unit > MAX_UNIT) {
        return json(res, 400, { error: 'That is not a usable unit size.', field: 'unit' });
      }
      sets.unit = unit;
    }
    if (body.privacy !== undefined) {
      if (!PRIVACIES.includes(body.privacy)) {
        return json(res, 400, { error: 'That is not a privacy setting.', field: 'privacy' });
      }
      sets.privacy = body.privacy;
    }
    if (!Object.keys(sets).length) return json(res, 400, { error: 'Nothing to change.' });

    const sql = db();
    /* COALESCE rather than a built statement: the Neon driver takes tagged
       templates, so assembling a SET clause from strings would mean
       interpolating into SQL, which is the one thing never to do. Passing
       null for "leave alone" keeps every value a bound parameter. */
    const rows = await sql`
      UPDATE users
      SET unit_pence = COALESCE(${sets.unit ?? null}, unit_pence),
          privacy    = COALESCE(${sets.privacy ?? null}, privacy)
      WHERE id = ${user.id}
      RETURNING unit_pence, privacy`;

    return json(res, 200, {
      ok: true,
      unitPence: rows[0].unit_pence,
      privacy: rows[0].privacy
    });
  } catch (err) {
    return fail(res, err, 'Could not save those settings.');
  }
}
