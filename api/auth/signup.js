/* POST /api/auth/signup
 *
 * Uniqueness on email and display name is enforced by the database, not by a
 * check-then-insert. Two simultaneous signups for the same name both read
 * "free" and both insert; only a UNIQUE index actually decides. So the insert
 * runs optimistically and the constraint violation is the answer.
 */
import { json, methodGuard, readJson, clientIp, fail } from '../_lib/http.js';
import { db, ensureSchema, configured, uniqueViolation, violatedIndex } from '../_lib/db.js';
import { guard } from '../_lib/rate.js';
import * as mail from '../_lib/mail.js';
import { lookup as lookupPromo, planUntil } from '../_lib/promo.js';
import {
  hashPassword, issueVerificationCode, linkCode, createSession, setSessionCookie,
  emailProblem, passwordProblem, nameProblem
} from '../_lib/auth.js';

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

    const sql = db();
    const passwordHash = await hashPassword(password);

    let user;
    try {
      const rows = await sql`
        INSERT INTO users (email, email_lower, display_name, name_lower,
                           password_hash, age_confirmed, link_code,
                           plan, plan_until, promo_code)
        VALUES (${email}, ${email.toLowerCase()}, ${name}, ${name.toLowerCase()},
                ${passwordHash}, true, ${linkCode()},
                ${plan}, ${until}, ${promo ? promo.code : null})
        RETURNING id, display_name`;
      user = rows[0];
      if (promo) {
        await sql`INSERT INTO promo_redemptions (user_id, code, plan, months)
                  VALUES (${user.id}, ${promo.code}, ${promo.plan}, ${promo.months || null})`;
      }
    } catch (err) {
      if (!uniqueViolation(err)) throw err;
      const index = violatedIndex(err);
      if (index.includes('name')) {
        return json(res, 409, { error: name + ' is already taken. Try another.', field: 'name' });
      }
      /* Email collision. Say the address is in use rather than inventing a
         different story: this endpoint is behind a rate limit, the signup
         form is public, and a vague message just strands a real user who
         forgot they had signed up. */
      return json(res, 409, {
        error: 'That email already has an account. Log in instead?', field: 'email'
      });
    }

    const grant = promo ? { code: promo.code, label: promo.label, note: promo.note } : null;

    if (mail.configured()) {
      const code = await issueVerificationCode(user.id);
      try {
        await mail.sendVerificationEmail(email, code);
      } catch (err) {
        /* The account exists and the address is now taken, so failing here
           would strand someone on an account they cannot get into. Sign them
           in and say the email did not go out — the address is unproven, and
           the resend button is still there. */
        console.error('[slippery] verification mail failed', err.message);
        await sql`UPDATE users SET email_verified = true WHERE id = ${user.id}`;
        const token = await createSession(user.id);
        setSessionCookie(res, token);
        return json(res, 201, {
          ok: true, name: user.display_name, emailSent: false, verified: true, plan, grant,
          notice: 'We could not send the code just now, so you are signed in already.'
        });
      }
      return json(res, 201, { ok: true, name: user.display_name, emailSent: true, plan, grant });
    }

    /* No mail provider on this deployment.
       Issuing a code nobody can receive would strand every signup at the
       verify step, so the account is marked verified and signed in instead,
       and the client is told delivery is off rather than shown a code it
       cannot have received. This is a real trade-off and it is deliberate:
       until RESEND_API_KEY is set, an address is unproven. Set the key and
       the normal code flow resumes with no other change. */
    await db()`UPDATE users SET email_verified = true WHERE id = ${user.id}`;
    const token = await createSession(user.id);
    setSessionCookie(res, token);
    return json(res, 201, {
      ok: true, name: user.display_name, emailSent: false, verified: true, plan, grant,
      notice: 'Email verification is off on this deployment, so you are signed in already.'
    });
  } catch (err) {
    return fail(res, err, 'Could not create that account right now.');
  }
}
