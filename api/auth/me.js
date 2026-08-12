/* GET /api/auth/me, who the session cookie belongs to. */
import { json, methodGuard, fail } from '../_lib/http.js';
import { configured, ensureSchema } from '../_lib/db.js';
import { sessionUser } from '../_lib/auth.js';
import { limit } from '../_lib/rate.js';
import { settleForUser } from '../_lib/settling.js';

/* limit() returns {allowed, retryAfter}. Testing the object itself is always
   true, which meant this re-scraped on every single page load rather than
   once every ten minutes. Read the field. */
async function settleQuietly(req, user) {
  const { allowed } = await limit('signin-settle:' + user.id, 1, 600);
  if (!allowed) return;
  await settleForUser(user.id);
}

export default async function handler(req, res) {
  if (!methodGuard(req, res, ['GET'])) return;
  try {
    if (!configured()) return json(res, 200, { user: null, configured: false });
    await ensureSchema();
    const user = await sessionUser(req);
    if (!user) return json(res, 200, { user: null, configured: true });

    /* Settle on sign-in.
       Someone opening the app after a Saturday afternoon expects their bets
       to have moved. Waiting for them to find the refresh button, or for the
       daily sweep, is a worse answer than looking now. It is rate limited to
       once every ten minutes per user so a reload does not re-scrape, and it
       is deliberately not awaited: the session must return immediately, and
       the ledger request that follows a moment later picks up whatever
       landed. A failed lookup is invisible here and that is correct, the
       refresh button reports properly when someone asks explicitly. */
    settleQuietly(req, user).catch(() => { /* never blocks the session */ });

    return json(res, 200, {
      configured: true,
      user: {
        name: user.display_name,
        email: user.email,
        emailVerified: user.email_verified,
        unitPence: user.unit_pence,
        plan: user.plan || 'free',
        planUntil: user.plan_until || null,
        promoCode: user.promo_code || null,
        /* Telegram state is real or absent. The settings page used to show
           a link code and a "connected since" date that were written into
           the markup, so an account with no bot linked was told it had
           one. */
        telegramLinked: Boolean(user.telegram_id),
        linkCode: user.link_code || null,
        since: user.created_at
      }
    });
  } catch (err) {
    return fail(res, err, 'Could not read your session.');
  }
}
