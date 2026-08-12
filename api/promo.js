/* POST /api/promo — redeem a code against the signed-in account.
 *
 * Redemption is a server act, always. A code that unlocked the plan in the
 * browser would unlock it for anyone who read the JavaScript, and the whole
 * point of "free for life" is that it is given, not taken.
 */
import { json, methodGuard, readJson, fail } from './_lib/http.js';
import { db, ensureSchema, configured, uniqueViolation } from './_lib/db.js';
import { sessionUser } from './_lib/auth.js';
import { guard } from './_lib/rate.js';
import { lookup, planUntil } from './_lib/promo.js';

export default async function handler(req, res) {
  if (!methodGuard(req, res, ['POST'])) return;
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
    if (user.plan === 'lifetime') {
      return json(res, 200, {
        ok: true, plan: 'lifetime', planUntil: null,
        label: promo.label, note: 'This account is already free for life.'
      });
    }

    await sql`UPDATE users SET plan = ${promo.plan}, plan_until = ${until}, promo_code = ${promo.code}
              WHERE id = ${user.id}`;

    return json(res, 200, {
      ok: true,
      plan: promo.plan,
      planUntil: until ? until.toISOString() : null,
      label: promo.label,
      note: promo.note
    });
  } catch (err) {
    return fail(res, err, 'That code could not be redeemed right now.');
  }
}
