/* POST /api/auth/link, issue or revoke the Telegram link.
 *
 * Two actions on one route, because they are the two halves of one switch
 * and Vercel Hobby allows twelve serverless functions in total.
 *
 *   {action:'new'}    issue a fresh six character code, ten minute life
 *   {action:'unlink'} disconnect the chat, keeping every bet
 *
 * The code is generated here rather than in the browser, because a code
 * the client chooses is a code the client can choose to be somebody
 * else's. randomInt is the CSPRNG, not Math.random: this is a key to a
 * ledger for ten minutes.
 */
import { randomInt } from 'node:crypto';
import { json, methodGuard, readJson, fail } from '../http.js';
import { db, ensureSchema, configured, uniqueViolation } from '../db.js';
import { sessionUser } from '../auth.js';
import { limit } from '../rate.js';
import { LINK_ALPHABET, LINK_LENGTH, LINK_TTL_MS } from '../bot-strings.js';

function makeCode() {
  let out = '';
  for (let i = 0; i < LINK_LENGTH; i++) out += LINK_ALPHABET[randomInt(LINK_ALPHABET.length)];
  return out;
}

export default async function handler(req, res) {
  if (!methodGuard(req, res, ['POST'])) return;
  try {
    if (!configured()) return json(res, 503, { error: 'No database is connected yet.' });
    await ensureSchema();
    const user = await sessionUser(req);
    if (!user) return json(res, 401, { error: 'Log in first.' });

    const body = await readJson(req, 4 * 1024);
    const action = String((body && body.action) || 'new');

    if (action === 'unlink') {
      /* RETURNING, so the answer is what happened rather than what was
         attempted. Four controls in this codebase once confirmed actions
         they never performed, and this is the fifth candidate: a button
         that says "unlinked" while the chat still posts into the ledger
         is worse than one that does nothing. */
      const rows = await db()`
        UPDATE users
        SET telegram_id = NULL, telegram_linked_at = NULL, telegram_username = NULL
        WHERE id = ${user.id} AND telegram_id IS NOT NULL
        RETURNING id`;
      return json(res, 200, { unlinked: rows.length > 0, telegramLinked: false });
    }

    if (action !== 'new') return json(res, 400, { error: 'That is not something this does.' });

    /* Generating a code is cheap but it invalidates the previous one, so
       somebody hammering the button while a friend is typing the old code
       is a real way to break the flow for themselves. */
    if (!(await limit('link:' + user.id, 12, 600)).allowed) {
      return json(res, 429, { error: 'That is a lot of codes. Wait a minute and try again.' });
    }

    const expiresAt = new Date(Date.now() + LINK_TTL_MS);
    /* Retry on a collision rather than failing. Six characters from thirty
       gives 729 million, so this effectively never runs, but a unique
       index that can reject an insert needs a caller that handles it. */
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = makeCode();
      try {
        await db()`
          UPDATE users SET link_code = ${code}, link_code_expires_at = ${expiresAt}
          WHERE id = ${user.id}`;
        return json(res, 200, {
          linkCode: code,
          linkCodeExpiresAt: expiresAt.toISOString(),
          /* The client shows a countdown, so it needs the length as well
             as the deadline: a clock that is a minute out otherwise shows
             a code as expired the moment it arrives. */
          ttlMs: LINK_TTL_MS
        });
      } catch (err) {
        if (!uniqueViolation(err)) throw err;
      }
    }
    return json(res, 503, { error: 'Could not issue a code just now. Try again.' });
  } catch (err) {
    return fail(res, err, 'Could not set up the bot link.');
  }
}
