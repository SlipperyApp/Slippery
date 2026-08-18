/* POST /api/auth/signup
 *
 * NOTHING IS RESERVED UNTIL THE ADDRESS IS PROVED.
 *
 * This used to INSERT the users row before the code was even sent, and the
 * partial unique indexes key on deleted_at IS NULL rather than on
 * verification, so an abandoned signup held the email and the display name
 * for ever. It also started the trial clock and burned the promo code.
 *
 * The signup now lands in pending_signups and becomes an account only in
 * verify.js, which is where the email, the name, the fourteen day clock and
 * the promo redemption are all claimed at once.
 *
 * Uniqueness is still decided by the database rather than by the check
 * below: two people can be waiting to verify the same name and only one can
 * have it, so the check here is a courtesy and the unique index at
 * verification is the answer.
 *
 * One exception, deliberate: a deployment with no mail provider creates the
 * account directly, because a code nobody can receive would strand every
 * signup at the verify step.
 */
import { json, methodGuard, readJson, clientIp, fail } from '../http.js';
import { db, ensureSchema, configured } from '../db.js';
import { guard } from '../rate.js';
import * as mail from '../mail.js';
import { lookup as lookupPromo, planUntil, trialEnd, TRIAL_DAYS, TRIAL_SLIPS } from '../promo.js';
import {
  hashPassword, linkCode, createSession, setSessionCookie,
  issuePendingSignup, clearPendingSignup,
  emailProblem, passwordProblem, nameProblem
} from '../auth.js';

export default async function handler(req, res) {
  if (!methodGuard(req, res, ['POST'])) return;
  try {
    if (!configured()) {
      /* No demo code. An account that does not exist, holding bets that
         are not saved, is worse than an honest refusal. */
      return json(res, 503, {
        error: 'Accounts are not switched on for this deployment yet.',
        needs: ['DATABASE_URL']
      });
    }
    if (!(await guard(res, 'signup:' + clientIp(req), 10, 3600))) return;
    await ensureSchema();

    const body = await readJson(req, 64 * 1024);
    const email = String(body.email || '').trim();
    const password = String(body.password || '');
    const name = String(body.name || '').trim();

    let problem = emailProblem(email);
    if (problem) return json(res, 400, { error: problem, field: 'email' });
    problem = passwordProblem(password);
    if (problem) return json(res, 400, { error: problem, field: 'password' });
    problem = nameProblem(name);
    if (problem) return json(res, 400, { error: problem, field: 'name' });
    if (body.ageConfirmed !== true) {
      return json(res, 400, { error: 'You must confirm you are 18 or over.', field: 'age' });
    }

    /* A promo code offered at signup is checked before the account exists, so
       a wrong one is a correctable typo rather than something to sort out
       afterwards. An empty box is not an error: most people will not have one. */
    const promo = body.promo ? lookupPromo(body.promo) : null;
    if (body.promo && !promo) {
      return json(res, 400, { error: 'That code is not one we recognise.', field: 'promo' });
    }
    /* The plan a promo grants always wins over the one the form chose: the
       code IS the choice. Otherwise the free tier applies until it is paid
       for, which is exactly what "free trial" means. */
    const plan = promo ? promo.plan : 'free';
    const until = promo ? planUntil(promo) : null;
    /* The trial clock starts at signup and is written down rather than
       derived from created_at, so extending somebody's trial later is an
       UPDATE rather than a lie about when they joined. A code that grants a
       plan still gets a date: if the plan lapses, the trial is what is left,
       and a NULL here would read as "trial never started". */
    const trialEndsAt = trialEnd();
    /* The tick, if the code carries one. */
    const verified = Boolean(promo && promo.verify);

    const sql = db();
    const passwordHash = await hashPassword(password);

    /* NOTHING IS RESERVED UNTIL THE ADDRESS IS PROVED.
     *
     * The users row used to be INSERTed right here, before the code was
     * even sent. The partial unique indexes key on deleted_at IS NULL, not
     * on verification, so an abandoned signup held the email AND the
     * display name permanently, with no expiry sweep anywhere. The second
     * attempt got a flat "that email already has an account", login refuses
     * unverified accounts, and the name was gone for good. It also started
     * the fourteen day trial clock and consumed the promo code, which is
     * UNIQUE per user and therefore unrecoverable.
     *
     * A courtesy check, not the decision. The decision is made at
     * verification, against the unique indexes, because two people can be
     * waiting to verify the same name at once and only one can have it. */
    const taken = await sql`
      SELECT email_lower, name_lower FROM users
      WHERE (email_lower = ${email.toLowerCase()} OR name_lower = ${name.toLowerCase()})
        AND deleted_at IS NULL`;
    for (const row of taken) {
      if (row.email_lower === email.toLowerCase()) {
        return json(res, 409, {
          error: 'That email already has an account. Log in instead?', field: 'email'
        });
      }
    }
    if (taken.length) {
      return json(res, 409, { error: name + ' is already taken. Try another.', field: 'name' });
    }

    const grant = promo ? { code: promo.code, label: promo.label, note: promo.note } : null;
    /* What the new account actually has: a fortnight and 35 slips. Sent back
       with the signup so the client can say so straight away rather than
       waiting for the first ledger load to reveal it. */
    const trial = { endsAt: trialEndsAt.toISOString(), days: TRIAL_DAYS, slips: TRIAL_SLIPS };

    if (mail.configured()) {
      const code = await issuePendingSignup({
        email, name, passwordHash, promoCode: promo ? promo.code : null
      });
      try {
        await mail.sendVerificationEmail(email, code);
      } catch (err) {
        /* Nothing was reserved, so there is nobody to strand. Clear the
           pending row and say the mail did not go, rather than signing
           somebody in on an address nobody has proved. */
        console.error('[slippery] verification mail failed', err.message);
        await clearPendingSignup(email);
        return json(res, 502, {
          error: 'We could not send the code just now. Try again in a moment.'
        });
      }
      return json(res, 201, {
        ok: true, name, emailSent: true, plan, grant, trial,
        /* So the verify screen can name what to look for in a spam folder. */
        from: mail.fromAddress()
      });
    }

    /* No mail provider on this deployment.
       A code nobody can receive would strand every signup at the verify
       step, so the account is created and signed in directly. This is the
       one path that still writes a users row without proof of the address,
       and it is deliberate: set the mail credentials and the normal flow
       resumes with no other change. */
    const made = await sql`
      INSERT INTO users (email, email_lower, display_name, name_lower,
                         password_hash, age_confirmed, link_code, link_code_expires_at, email_verified,
                         plan, plan_until, promo_code, verified, trial_ends_at)
      VALUES (${email}, ${email.toLowerCase()}, ${name}, ${name.toLowerCase()},
              ${passwordHash}, true, ${linkCode()},
              now() + interval '10 minutes', true,
              ${plan}, ${until}, ${promo ? promo.code : null},
              ${Boolean(promo && promo.verify)}, ${trialEndsAt})
      RETURNING id, display_name`;
    if (promo) {
      await sql`INSERT INTO promo_redemptions (user_id, code, plan, months)
                VALUES (${made[0].id}, ${promo.code}, ${promo.plan}, ${promo.months || null})`;
    }
    setSessionCookie(res, await createSession(made[0].id));
    return json(res, 201, {
      ok: true, name: made[0].display_name, emailSent: false, verified: true, plan, grant, trial,
      notice: 'Email verification is off on this deployment, so you are signed in already.'
    });
  } catch (err) {
    return fail(res, err, 'Could not create that account right now.');
  }
}
