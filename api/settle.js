/* POST /api/settle — settle this user's running bets, on demand.
 *
 * The scheduled sweep in results.js does the same job for everybody every
 * twenty minutes. This is the button: someone whose game has just finished
 * wants the answer now, not at the next tick.
 *
 * It is per-user and session-authenticated, which is what makes it safe to
 * expose. The sweep is cron-secret protected because it reads every pending
 * bet in the database; this only ever touches the caller's own.
 *
 * The engine is the same one the browser uses — src/js/settlement.js,
 * imported directly. There is no second grader to drift out of sync, and
 * everything it returns as {status:'ask'} is left for the user with the
 * reason recorded rather than guessed at.
 */
import { settle } from '../src/js/settlement.js';
import { json, methodGuard, fail, clientIp } from './_lib/http.js';
import { db, ensureSchema, configured as dbConfigured } from './_lib/db.js';
import { sessionUser } from './_lib/auth.js';
import { limit } from './_lib/rate.js';
import * as feed from './_lib/fixtures.js';

/* How far back to look for fixtures. A bet placed on a Saturday and checked
   on a Monday still needs its game found. */
const LOOKBACK_DAYS = 4;

export default async function handler(req, res) {
  if (!methodGuard(req, res, ['POST'])) return;
  try {
    if (!dbConfigured()) {
      return json(res, 503, { error: 'No database is connected yet.', needs: ['DATABASE_URL'] });
    }
    await ensureSchema();
    const user = await sessionUser(req);
    if (!user) return json(res, 401, { error: 'Log in to check your bets.' });

    if (!feed.configured()) {
      return json(res, 503, {
        error: 'No results feed is configured yet, so bets cannot be settled automatically.',
        needs: ['RESULTS_PROVIDER or FOOTBALL_DATA_TOKEN']
      });
    }

    /* The feed is rate limited and this is a button someone can hold down.
       Six checks in five minutes is generous for a human and useless for a
       script. */
    if (!(await limit('settle:' + user.id, 6, 300))) {
      return json(res, 429, {
        error: 'You checked a moment ago. Results come in on their own too — give it a minute.'
      });
    }
    if (!(await limit('settle-ip:' + clientIp(req), 40, 300))) {
      return json(res, 429, { error: 'Too many checks from this connection.' });
    }

    const sql = db();
    const pending = await sql`
      SELECT id, event, selection, bookmaker, odds, stake_pence, placed_at
      FROM bets
      WHERE user_id = ${user.id} AND status IN ('pending', 'ask')
        AND placed_at > now() - interval '30 days'
      ORDER BY placed_at DESC LIMIT 100`;

    if (!pending.length) {
      return json(res, 200, { checked: 0, settled: 0, asked: 0, stillRunning: 0, bets: [] });
    }

    /* One fetch for the whole window, not one per bet. The feed's rate limit
       is the scarce resource here, and a user with twelve pending bets on a
       Saturday would otherwise burn twelve calls to answer one question. */
    const today = new Date();
    const from = iso(new Date(today.getTime() - LOOKBACK_DAYS * 86400000));
    const to = iso(new Date(today.getTime() + 86400000));

    let provider, fixtures;
    try {
      ({ provider, fixtures } = await feed.resolveFinished(from, to));
    } catch (err) {
      /* Blocked or down. Say so plainly — the bets are fine, the lookup is
         not, and telling someone "nothing settled" would be a lie. */
      return json(res, 503, {
        error: err.blocked
          ? 'The results provider is refusing requests from the server right now. Your bets are safe; this will retry automatically.'
          : 'The results feed could not be reached. Nothing was changed.'
      });
    }

    /* Anything the sweep did not match gets one direct lookup each. A sweep
       only sees the days it pulled and the competitions listed there, so a
       bet outside that window would otherwise stay pending forever — which
       looks identical to "still running" and is the more annoying failure. */
    const unmatched = pending.filter(b => !feed.matchFixture(b.event, fixtures));
    const extra = unmatched.length
      ? await feed.lookupEach(unmatched.map(b => b.event))
      : new Map();

    let settled = 0, asked = 0, stillRunning = 0;
    const updated = [];

    for (const bet of pending) {
      const fixture = feed.matchFixture(bet.event, fixtures) || extra.get(bet.event);
      if (!fixture) { stillRunning++; continue; }

      const out = settle({
        selection: bet.selection,
        stakePence: bet.stake_pence,
        odds: Number(bet.odds),
        book: bet.bookmaker
      }, fixture);

      if (out.status === 'settled') {
        await sql`
          UPDATE bets SET status = 'settled', outcome = ${out.outcome},
                          profit_pence = ${out.profit}, settled_at = now(),
                          settle_reason = ${out.reason}, fixture_id = ${String(fixture.id)}
          WHERE id = ${bet.id} AND user_id = ${user.id}`;
        settled++;
        updated.push({ id: bet.id, outcome: out.outcome, profit: out.profit, reason: out.reason });
      } else if (out.status === 'ask') {
        await sql`
          UPDATE bets SET status = 'ask', settle_reason = ${out.reason},
                          fixture_id = ${String(fixture.id)}
          WHERE id = ${bet.id} AND user_id = ${user.id}`;
        asked++;
        updated.push({ id: bet.id, ask: out.reason });
      } else {
        stillRunning++;
      }
    }

    return json(res, 200, {
      provider,
      checked: pending.length,
      fixtures: fixtures.length,
      settled, asked, stillRunning,
      bets: updated
    });
  } catch (err) {
    return fail(res, err, 'Your bets could not be checked just now.');
  }
}

const iso = d => d.toISOString().slice(0, 10);
