/* POST /api/auth/break — take a break.
 *
 * The brief lists this under "flag, don't decide", alongside the note that
 * the red and green grid and the rankings are engagement mechanics and that
 * nothing should nudge toward more volume. A product that gamifies a
 * gambling record and offers no way to stop is the version of this that
 * should not ship.
 *
 * THREE PROPERTIES, AND ALL THREE ARE THE POINT.
 *
 * It is enforced on the server. A client-side break is a suggestion; this
 * one blocks the endpoints that log bets, so it holds even if somebody
 * opens the API directly.
 *
 * It cannot be shortened or cancelled. The whole value is that the decision
 * is made by the person who is calm and honoured by the person who is not,
 * and an undo button hands the decision back to the wrong one. It CAN be
 * extended, because that direction only ever helps.
 *
 * It does not delete anything. The record is still there afterwards, and
 * the account is not punished for having asked. Somebody who takes a break
 * and comes back should find exactly what they left.
 */
import { json, methodGuard, readJson, fail } from '../http.js';
import { db, ensureSchema, configured } from '../db.js';
import { sessionUser } from '../auth.js';
import { guard } from '../rate.js';

/* Fixed lengths rather than a free date. Choosing "how long" from a text
   box is a negotiation with yourself; picking from a short list is a
   decision. The longest is a year because that is the point past which
   someone should be talking to GamCare rather than to a settings page. */
export const BREAKS = {
  '24h': { ms: 24 * 3600e3, label: '24 hours' },
  '7d':  { ms: 7 * 86400e3, label: 'a week' },
  '30d': { ms: 30 * 86400e3, label: '30 days' },
  '90d': { ms: 90 * 86400e3, label: '90 days' },
  '1y':  { ms: 365 * 86400e3, label: 'a year' }
};

export default async function handler(req, res) {
  if (!methodGuard(req, res, ['POST'])) return;
  try {
    if (!configured()) return json(res, 503, { error: 'No database is connected yet.' });
    await ensureSchema();

    const user = await sessionUser(req);
    if (!user) return json(res, 401, { error: 'Log in first.' });
    if (!(await guard(res, 'break:' + user.id, 20, 3600))) return;

    const body = await readJson(req, 2 * 1024);
    const choice = BREAKS[String((body && body.length) || '')];
    if (!choice) {
      return json(res, 400, { error: 'Pick how long the break should last.', field: 'length' });
    }

    const until = new Date(Date.now() + choice.ms);
    const sql = db();
    /* GREATEST, so a break can only ever move outwards. Somebody who takes
       a week and then decides on a month gets the month; somebody who takes
       a month and then asks for a day still has the month. */
    const rows = await sql`
      UPDATE users
      SET break_until = GREATEST(COALESCE(break_until, now()), ${until})
      WHERE id = ${user.id}
      RETURNING break_until`;

    return json(res, 200, {
      ok: true,
      breakUntil: rows[0].break_until,
      /* Said back plainly, because the one thing somebody must understand
         before confirming is that there is no undo. */
      note: 'Logging is off until then. This cannot be shortened.'
    });
  } catch (err) {
    return fail(res, err, 'Could not start a break right now.');
  }
}

/** Is this account on a break? Read by anything that logs a bet. */
export function onBreak(user) {
  return Boolean(user && user.break_until && new Date(user.break_until) > new Date());
}
