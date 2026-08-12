/* POST /api/auth/forgot, start a password reset.
 *
 * Answers the same way whether or not the account exists. The form is public
 * and unauthenticated, so a different answer for "no such account" turns this
 * endpoint into a way to test whether an address is registered, on a
 * gambling product, that is a genuinely harmful thing to leak.
 */
import { json, methodGuard, readJson, clientIp, fail } from '../http.js';
import { ensureSchema, configured } from '../db.js';
import { guard } from '../rate.js';
import * as mail from '../mail.js';
import { identifierProblem, findByIdentifier, issueResetCode } from '../auth.js';

const SAME_ANSWER = {
  ok: true,
  message: 'If that account exists, a reset code is on its way. It expires in thirty minutes.'
};

export default async function handler(req, res) {
  if (!methodGuard(req, res, ['POST'])) return;
  try {
    if (!configured()) return json(res, 503, { error: 'No database is connected yet.' });
    if (!(await guard(res, 'forgot:' + clientIp(req), 8, 3600))) return;
    await ensureSchema();

    const body = await readJson(req, 8 * 1024);
    const identifier = String(body.identifier || body.email || '').trim();
    const problem = identifierProblem(identifier);
    if (problem) return json(res, 400, { error: problem });

    if (!mail.configured()) {
      /* Without a mail provider there is no way to deliver a code, and
         pretending otherwise strands someone at a screen waiting for an
         email that will never arrive. Say so plainly. */
      return json(res, 503, {
        error: 'Password reset needs email, which is not switched on for this deployment yet.',
        needs: ['GMAIL_USER', 'GMAIL_APP_PASSWORD']
      });
    }

    const user = await findByIdentifier(identifier);
    if (user) {
      /* Second limit, per account: without it the per-IP allowance can be
         spent entirely on mailbombing one person from a rotating address. */
      if (await guard(null, 'forgot-acct:' + user.id, 5, 3600)) {
        const code = await issueResetCode(user.id);
        try {
          await mail.sendResetEmail(user.email, code);
        } catch (err) {
          /* Log the failure, answer the same as always. A send error would
             otherwise reveal that the address is registered. */
          console.error('[slippery] reset mail failed', err.message);
        }
      }
    }
    return json(res, 200, SAME_ANSWER);
  } catch (err) {
    return fail(res, err, 'Could not start a password reset right now.');
  }
}
