/* POST /api/auth/close — delete the account, or just the slip images.
 *
 * BOTH OF THESE USED TO BE A TOAST.
 * "Delete account" printed "Delete account completed" and disabled itself.
 * "Delete all stored images" printed "All stored slip images deleted". Both
 * lied. Nothing was removed, the session stayed valid, and somebody acting
 * on a privacy decision was told it had been carried out. That is the worst
 * shape a control can have: a missing button gets no trust, a lying one
 * gets all of it.
 *
 * Two actions in one route because they are the same decision at two
 * strengths, and Vercel Hobby allows twelve functions in total.
 *
 *   {images: true}   purge stored slip images, keep the account
 *   {confirm: name}  delete the account, matching the display name
 *
 * The account delete asks for the display name rather than a checkbox. It
 * is not friction for its own sake: this is the one action in the product
 * that cannot be undone, and typing the name is the difference between
 * deciding and mis-tapping.
 */
import { json, methodGuard, readJson, fail } from '../http.js';
import { db, ensureSchema, configured } from '../db.js';
import { sessionUser, clearSessionCookie } from '../auth.js';
import { guard } from '../rate.js';

export default async function handler(req, res) {
  if (!methodGuard(req, res, ['POST'])) return;
  try {
    if (!configured()) return json(res, 503, { error: 'No database is connected yet.' });
    await ensureSchema();

    const user = await sessionUser(req);
    if (!user) return json(res, 401, { error: 'Log in first.' });
    if (!(await guard(res, 'close:' + user.id, 10, 3600))) return;

    const body = await readJson(req, 4 * 1024);
    const sql = db();

    if (body && body.images === true) {
      const rows = await sql`DELETE FROM slips WHERE user_id = ${user.id} RETURNING id`;
      await sql`DELETE FROM slip_drafts WHERE user_id = ${user.id}`;
      return json(res, 200, { purged: rows.length });
    }

    /* Case-insensitive, trimmed. Somebody typing their own name on a phone
       keyboard should not be defeated by an autocapitalised first letter,
       and the point of the check is intent, not spelling. */
    const typed = String((body && body.confirm) || '').trim().toLowerCase();
    if (!typed || typed !== String(user.display_name || '').toLowerCase()) {
      return json(res, 400, {
        error: 'Type your display name exactly to confirm.', field: 'confirm'
      });
    }

    /* Soft delete, and it is deliberate rather than a shortcut.
     *
     * `deleted_at` is what the partial unique indexes on email and display
     * name are built around, so setting it frees both for reuse while the
     * row stays as the foreign key target for anything mid-flight. What
     * actually has to disappear now is the data: bets, slips, drafts,
     * memberships, follows and every session. Those are hard deletes,
     * because "we kept your betting record but marked the account dead" is
     * not what anybody means by delete.
     *
     * The email is overwritten rather than kept beside a tombstone. A
     * deleted account should not leave a readable address in the table.
     */
    const stamp = 'deleted+' + user.id + '@slippery.invalid';
    await sql`DELETE FROM bets          WHERE user_id = ${user.id}`;
    await sql`DELETE FROM slips         WHERE user_id = ${user.id}`;
    await sql`DELETE FROM slip_drafts   WHERE user_id = ${user.id}`;
    await sql`DELETE FROM group_members WHERE user_id = ${user.id}`;
    await sql`DELETE FROM follows       WHERE follower_id = ${user.id} OR followee_id = ${user.id}`;
    await sql`DELETE FROM auth_sessions WHERE user_id = ${user.id}`;
    /* A group with nobody left in it is a name and a code pointing at
       nothing, and the name is held against platform-wide uniqueness. */
    await sql`DELETE FROM groups g
              WHERE g.owner_id = ${user.id}
                AND NOT EXISTS (SELECT 1 FROM group_members m WHERE m.group_id = g.id)`;
    await sql`
      UPDATE users
      SET deleted_at = now(), email = ${stamp}, email_lower = ${stamp},
          telegram_id = NULL, link_code = NULL
      WHERE id = ${user.id}`;

    clearSessionCookie(res);
    return json(res, 200, { deleted: true });
  } catch (err) {
    return fail(res, err, 'Could not complete that right now.');
  }
}
