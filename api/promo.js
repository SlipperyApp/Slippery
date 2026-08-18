/* POST /api/promo, redeem a code against the signed-in account.
 *
 * Redemption is a server act, always. A code that unlocked the plan in the
 * browser would unlock it for anyone who read the JavaScript, and the whole
 * point of "free for life" is that it is given, not taken.
 */
import { json, methodGuard, readJson, fail, blockCrossOrigin } from './_lib/http.js';
import { db, ensureSchema, configured, uniqueViolation } from './_lib/db.js';
import { sessionUser } from './_lib/auth.js';
import { guard } from './_lib/rate.js';
import { lookup, planUntil } from './_lib/promo.js';
import { ensurePromoGroup } from './_lib/groups-core.js';

/* Turn what ensurePromoGroup did into something to show and something to
   say. The sentence is appended to the code's own note, so it always reads
   as the second half of one message rather than a separate announcement.
   A group that could not be joined says so plainly: claiming a place that
   was not given is the exact failure this codebase keeps correcting. */
export function groupResult(joined) {
  if (!joined) return { group: null, note: '' };
  const g = { id: joined.group.id, name: joined.group.name, created: joined.created };
  if (joined.created) return { group: g, note: ' You started ' + joined.group.name + '.' };
  if (joined.joined) return { group: g, note: ' You are in ' + joined.group.name + ' now.' };
  if (joined.why === 'already') return { group: g, note: ' You were already in ' + joined.group.name + '.' };
  if (joined.why === 'group-full') return { group: null, note: ' ' + joined.group.name + ' is full, so we could not add you.' };
  if (joined.why === 'user-full') return { group: null, note: ' You are in 20 groups already, so we could not add you to ' + joined.group.name + '.' };
  return { group: null, note: '' };
}

export default async function handler(req, res) {
  if (!methodGuard(req, res, ['POST'])) return;
  /* Second layer behind SameSite=Lax. A write arriving from another origin
     is refused before it can spend a session it did not earn. */
  if (blockCrossOrigin(req, res)) return;
  try {
    if (!configured()) return json(res, 503, { error: 'No database is connected yet.', needs: ['DATABASE_URL'] });
    await ensureSchema();

    const user = await sessionUser(req);
    if (!user) return json(res, 401, { error: 'Log in to redeem a code.' });
    /* Guessing at codes is the obvious attack, and they are short. */
    if (!(await guard(res, 'promo:' + user.id, 10, 3600))) return;

    const body = await readJson(req, 4 * 1024);
    const promo = lookup(body.code);
    if (!promo) return json(res, 400, { error: 'That code is not one we recognise.', field: 'code' });

    const sql = db();
    const until = planUntil(promo, new Date(), user.plan_until ? new Date(user.plan_until) : null);

    try {
      await sql`INSERT INTO promo_redemptions (user_id, code, plan, months)
                VALUES (${user.id}, ${promo.code}, ${promo.plan}, ${promo.months || null})`;
    } catch (err) {
      if (!uniqueViolation(err)) throw err;
      return json(res, 409, { error: 'You have already used that code.', field: 'code' });
    }

    /* A lifetime code beats anything already on the account, and nothing
       downgrades one. Otherwise redeeming a gift month on a lifetime account
       would quietly put an expiry date on it. */

    /* The tick is granted separately from the plan, because it survives the
       plan running out: ULTRAS is handed to people whose figures the owner
       already knows are real, and that does not stop being true in month
       three. It is only ever turned on here, never off, so redeeming a
       different code later cannot quietly strip it. */
    if (promo.verify) {
      await sql`UPDATE users SET verified = true WHERE id = ${user.id}`;
    }

    /* Some codes carry a group. This runs after the redemption row is
       already committed and must never undo it: the plan and the tick are
       what was redeemed, and a group that is full or unreachable is not a
       reason to refuse them. Anything unexpected is swallowed here for the
       same reason, and the response simply carries no group. */
    let joined = null;
    try {
      joined = await ensurePromoGroup(sql, user, promo);
    } catch {
      joined = null;
    }
    const groupPart = groupResult(joined);

    if (user.plan === 'lifetime') {
      return json(res, 200, {
        ok: true, plan: 'lifetime', planUntil: null, verified: Boolean(promo.verify) || Boolean(user.verified),
        label: promo.label, note: 'This account is already free for life.' + groupPart.note,
        group: groupPart.group
      });
    }

    await sql`UPDATE users SET plan = ${promo.plan}, plan_until = ${until}, promo_code = ${promo.code}
              WHERE id = ${user.id}`;

    return json(res, 200, {
      ok: true,
      plan: promo.plan,
      planUntil: until ? until.toISOString() : null,
      verified: Boolean(promo.verify) || Boolean(user.verified),
      label: promo.label,
      note: promo.note + groupPart.note,
      group: groupPart.group
    });
  } catch (err) {
    return fail(res, err, 'That code could not be redeemed right now.');
  }
}
