/* GET /api/results — settlement sweep.
 *
 * Runs on a schedule (see vercel.json crons). Pulls the day's finished
 * fixtures, matches them to pending bets, and hands each pair to the SAME
 * settlement engine the browser uses — src/js/settlement.js, imported
 * directly. There is no second implementation to drift out of sync.
 *
 * Everything the engine returns as {status:'ask'} is left pending with the
 * reason recorded, so the user is asked rather than the bet being guessed.
 */
import { settle } from '../src/js/settlement.js';
import { json, methodGuard, fail } from './_lib/http.js';
import { db, ensureSchema, configured as dbConfigured } from './_lib/db.js';
import * as feed from './_lib/fixtures.js';

export default async function handler(req, res) {
  if (!methodGuard(req, res, ['GET', 'POST'])) return;
  try {
    /* Vercel signs cron invocations. Anything else needs the shared secret,
       so the endpoint cannot be used to burn the feed's rate limit. */
    if (!isAuthorised(req)) return json(res, 401, { error: 'Not authorised.' });
    if (!dbConfigured()) return json(res, 503, { error: 'No database is connected yet.', needs: ['DATABASE_URL'] });
    if (!feed.configured()) return json(res, 503, { error: 'No results feed is configured.', needs: ['FOOTBALL_DATA_TOKEN'] });


    await ensureSchema();
    const sql = db();

    const pending = await sql`
      SELECT id, user_id, event, selection, bookmaker, odds, stake_pence
      FROM bets WHERE status = 'pending' AND placed_at > now() - interval '14 days'
      ORDER BY placed_at ASC LIMIT 200`;
    if (!pending.length) return json(res, 200, { checked: 0, settled: 0, asked: 0, stillPending: 0 });

    const today = new Date();
    const from = iso(new Date(today.getTime() - 3 * 86400000));
    const to = iso(new Date(today.getTime() + 86400000));
    const { provider, fixtures } = await feed.resolveFinished(from, to);

    let settled = 0, asked = 0, stillPending = 0;
    const details = [];

    for (const bet of pending) {
      const fixture = feed.matchFixture(bet.event, fixtures);
      if (!fixture) { stillPending++; continue; }

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
                          settle_reason = ${out.reason}, fixture_id = ${fixture.id}
          WHERE id = ${bet.id}`;
        settled++;
        details.push({ bet: bet.id, outcome: out.outcome, profit: out.profit });
      } else if (out.status === 'ask') {
        /* The engine could not be certain. Record why and leave it to the
           user — a wrong grade is worse than no grade. */
        await sql`
          UPDATE bets SET status = 'ask', settle_reason = ${out.reason}, fixture_id = ${fixture.id}
          WHERE id = ${bet.id}`;
        asked++;
        details.push({ bet: bet.id, ask: out.reason });
      } else {
        stillPending++;
      }
    }

    return json(res, 200, {
      checked: pending.length, fixtures: fixtures.length, provider,
      settled, asked, stillPending,
      details: details.slice(0, 50)
    });
  } catch (err) {
    return fail(res, err, 'The settlement sweep could not run.');
  }
}

function isAuthorised(req) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = req.headers.authorization || '';
  if (header === 'Bearer ' + secret) return true;
  return req.headers['x-cron-secret'] === secret;
}

const iso = d => d.toISOString().slice(0, 10);
