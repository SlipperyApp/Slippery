/* POST /api/auth/verify — prove the address, and only then have an account.
 *
 * Verification is where an account comes into existence. Everything that
 * used to be claimed at signup is claimed here instead, all at once: the
 * email, the display name, the fourteen day trial clock, and the promo
 * redemption. Before this point an abandoned signup held the address and
 * the name for ever, burned the trial, and consumed a promo code that is
 * UNIQUE per user and therefore unrecoverable.
 *
 * Two paths, because both kinds of account exist:
 *   · a pending_signups row  -> promote it into a users row
 *   · an existing users row  -> the old flow, for accounts created before
 *     this change and for deployments with no mail provider
 */
import { json, methodGuard, readJson, clientIp, fail } from '../http.js';
import { db, ensureSchema, configured, uniqueViolation, violatedIndex } from '../db.js';
import { guard } from '../rate.js';
import {
  checkVerificationCode, checkPendingCode, pendingSignup, clearPendingSignup,
  createSession, setSessionCookie, linkCode, nameProblem
} from '../auth.js';
import { lookup as lookupPromo, planUntil, trialEnd } from '../promo.js';

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

    /* Same message whether the address is unknown or the code is wrong: the
       difference would tell an attacker which addresses have accounts. */
    const generic = { error: 'That code is not right. Check the email or resend it.' };

    const pending = await pendingSignup(email);
    if (pending) return promote(req, res, pending, code, body);

    const sql = db();
    const rows = await sql`
      SELECT id, display_name FROM users
      WHERE email_lower = ${email} AND deleted_at IS NULL`;
    if (!rows.length) return json(res, 400, generic);

    const result = await checkVerificationCode(rows[0].id, code);
    if (!result.ok) return json(res, 400, { error: result.reason });

    setSessionCookie(res, await createSession(rows[0].id));
    return json(res, 200, { ok: true, name: rows[0].display_name });
  } catch (err) {
    return fail(res, err, 'Could not verify that code right now.');
  }
}

/* Turn a proved address into an account. */
async function promote(req, res, pending, code, body) {
  const result = await checkPendingCode(pending.email_lower, code);
  if (!result.ok) return json(res, 400, { error: result.reason });

  /* The name can be changed here, and sometimes has to be: pending rows do
     not reserve one, so somebody else may have verified it in the meantime.
     Asking for a new name at this point is the cost of not holding names
     hostage to signups that never complete. */
  let name = pending.display_name;
  if (body.name != null && String(body.name).trim()) {
    const wanted = String(body.name).trim();
    const problem = nameProblem(wanted);
    if (problem) return json(res, 400, { error: problem, field: 'name' });
    name = wanted;
  }

  const sql = db();
  const promo = pending.promo_code ? lookupPromo(pending.promo_code) : null;
  /* The clock starts NOW, not when the form was submitted. Somebody who
     never received the first mail and comes back a fortnight later used to
     find the trial already over. */
  const trialEndsAt = trialEnd();

  let user;
  try {
    const rows = await sql`
      INSERT INTO users (email, email_lower, display_name, name_lower,
                         password_hash, age_confirmed, link_code, link_code_expires_at, email_verified,
                         plan, plan_until, promo_code, verified, trial_ends_at)
      VALUES (${pending.email}, ${pending.email_lower}, ${name}, ${name.toLowerCase()},
              ${pending.password_hash}, true, ${linkCode()},
              now() + interval '10 minutes', true,
              ${promo ? promo.plan : 'free'}, ${promo ? planUntil(promo) : null},
              ${promo ? promo.code : null}, ${Boolean(promo && promo.verify)},
              ${trialEndsAt})
      RETURNING id, display_name`;
    user = rows[0];
  } catch (err) {
    if (!uniqueViolation(err)) throw err;
    /* The pending row stays put either way. Losing the password hash
       because the name went while they were reading the email would strand
       somebody who did everything right. */
    if (violatedIndex(err).includes('name')) {
      return json(res, 409, {
        error: name + ' was taken while you were verifying. Pick another and we will finish signing you up.',
        field: 'name', needsName: true
      });
    }
    return json(res, 409, {
      error: 'That email already has an account. Log in instead?', field: 'email'
    });
  }

  if (promo) {
    /* Redeemed here rather than at signup, so an abandoned signup no longer
       consumes a code that can never be used again. */
    try {
      await sql`INSERT INTO promo_redemptions (user_id, code, plan, months)
                VALUES (${user.id}, ${promo.code}, ${promo.plan}, ${promo.months || null})`;
    } catch (err) { if (!uniqueViolation(err)) throw err; }
  }

  await clearPendingSignup(pending.email_lower);
  setSessionCookie(res, await createSession(user.id));
  return json(res, 200, { ok: true, name: user.display_name, created: true });
}
