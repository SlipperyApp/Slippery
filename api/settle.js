/* POST /api/settle, settle this user's running bets, on demand.
 *
 * The scheduled sweep in results.js does the same job for everybody every
 * twenty minutes. This is the button: someone whose game has just finished
 * wants the answer now, not at the next tick.
 *
 * It is per-user and session-authenticated, which is what makes it safe to
 * expose. The sweep is cron-secret protected because it reads every pending
 * bet in the database; this only ever touches the caller's own.
 *
 * The engine is the same one the browser uses, src/js/settlement.js,
 * imported directly. There is no second grader to drift out of sync, and
 * everything it returns as {status:'ask'} is left for the user with the
 * reason recorded rather than guessed at.
 */
import { json, methodGuard, fail, clientIp, blockCrossOrigin } from './_lib/http.js';
import { ensureSchema, configured as dbConfigured } from './_lib/db.js';
import { sessionUser } from './_lib/auth.js';
import { limit } from './_lib/rate.js';
import { settleForUser } from './_lib/settling.js';

export default async function handler(req, res) {
  if (!methodGuard(req, res, ['POST'])) return;
  /* Second layer behind SameSite=Lax. A write arriving from another origin
     is refused before it can spend a session it did not earn. */
  if (blockCrossOrigin(req, res)) return;
  try {
    if (!dbConfigured()) {
      return json(res, 503, { error: 'No database is connected yet.', needs: ['DATABASE_URL'] });
    }
    await ensureSchema();
    const user = await sessionUser(req);
    if (!user) return json(res, 401, { error: 'Log in to check your bets.' });

    /* The feed is rate limited and this is a button someone can hold down.
       Six checks in five minutes is generous for a human and useless for a
       script. */
    /* limit() answers {allowed, retryAfter}. Testing the object is always
       true, so neither of these limits was doing anything at all, and the
       button was a way to hammer the scrapers as fast as a finger moves. */
    if (!(await limit('settle:' + user.id, 6, 300)).allowed) {
      return json(res, 429, {
        error: 'You checked a moment ago. Results come in on their own too, give it a minute.'
      });
    }
    if (!(await limit('settle-ip:' + clientIp(req), 40, 300)).allowed) {
      return json(res, 429, { error: 'Too many checks from this connection.' });
    }

    try {
      const result = await settleForUser(user.id);
      return json(res, 200, result);
    } catch (err) {
      /* Every source refused, or the lookup broke. Say so plainly, the
         bets are fine, the lookup is not, and reporting "nothing settled"
         would be a lie about the ledger rather than about the network. */
      return json(res, 503, {
        error: err.blocked
          ? 'Every results source is refusing requests from the server right now. Your bets are safe, and the daily check keeps trying.'
          : 'No results source could be reached. Nothing was changed.',
        tried: err.tried || []
      });
    }
  } catch (err) {
    return fail(res, err, 'Your bets could not be checked just now.');
  }
}

