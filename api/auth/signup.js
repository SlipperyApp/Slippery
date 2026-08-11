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

    const sql = db();
    const passwordHash = await hashPassword(password);

    let user;
    try {
      const rows = await sql`
        INSERT INTO users (email, email_lower, display_name, name_lower,
                           password_hash, age_confirmed, link_code)
        VALUES (${email}, ${email.toLowerCase()}, ${name}, ${name.toLowerCase()},
                ${passwordHash}, true, ${linkCode()})
        RETURNING id, display_name`;
      user = rows[0];
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

    if (mail.configured()) {
      const code = await issueVerificationCode(user.id);
      await mail.sendVerificationEmail(email, code);
      return json(res, 201, { ok: true, name: user.display_name, emailSent: true });
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
      ok: true, name: user.display_name, emailSent: false, verified: true,
      notice: 'Email verification is off on this deployment, so you are signed in already.'
    });
  } catch (err) {
    return fail(res, err, 'Could not create that account right now.');
  }
}
