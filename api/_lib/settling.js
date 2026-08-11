/* Settle one user's running bets against the scraped results.
 *
 * Three callers want exactly this: the refresh button (POST /api/settle),
 * the sign-in check (GET /api/auth/me), and the daily sweep, which runs it
 * per user. Writing it once means there is one grader, one matching rule and
 * one set of pence — three copies of this would eventually disagree, and a
 * ledger that disagrees with itself is the failure this product cannot have.
 *
 * The engine is src/js/settlement.js, the same module the browser holds.
 * Anything it returns as {status:'ask'} is recorded with its reason and left
 * for the user, because a wrong grade is worse than no grade.
 */
import { settle } from '../../src/js/settlement.js';
import { db } from './db.js';
import * as feed from './fixtures.js';

/* How far back to look. A bet placed on a Saturday and checked on a Monday
   still needs its game found. */
const LOOKBACK_DAYS = 4;
const MAX_BETS = 100;

/**
 * @param {string} userId
 * @returns {Promise<{provider:string, checked:number, settled:number,
 *                    asked:number, stillRunning:number, bets:object[]}>}
 */
export async function settleForUser(userId) {
  const sql = db();
  const pending = await sql`
    SELECT id, event, selection, bookmaker, odds, stake_pence, placed_at
    FROM bets
    WHERE user_id = ${userId} AND status IN ('pending', 'ask')
      AND placed_at > now() - interval '30 days'
    ORDER BY placed_at DESC LIMIT ${MAX_BETS}`;

  if (!pending.length) {
    return { provider: null, checked: 0, settled: 0, asked: 0, stillRunning: 0, bets: [] };
  }

  /* One fetch for the whole window, not one per bet. A user with twelve
     pending bets on a Saturday would otherwise make twelve scrapes to
     answer one question, which is how a scraper earns a block. */
  const today = new Date();
  const from = iso(new Date(today.getTime() - LOOKBACK_DAYS * 86400000));
  const to = iso(new Date(today.getTime() + 86400000));
  const { provider, fixtures } = await feed.resolveFinished(from, to);

  /* Anything the sweep did not match gets one direct lookup each. A sweep
     only sees the days and competitions it pulled, so a bet outside that
     window would otherwise stay pending forever — indistinguishable from
     "still running", and the more annoying of the two failures. */
  const unmatched = pending.filter(b => !feed.matchFixture(b.event, fixtures));
  const extra = unmatched.length
    ? await feed.lookupEach(unmatched.map(b => b.event))
    : new Map();

  let settled = 0, asked = 0, stillRunning = 0;
  const bets = [];

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
        WHERE id = ${bet.id} AND user_id = ${userId}`;
      settled++;
      bets.push({ id: bet.id, outcome: out.outcome, profit: out.profit, reason: out.reason });
    } else if (out.status === 'ask') {
      await sql`
        UPDATE bets SET status = 'ask', settle_reason = ${out.reason},
                        fixture_id = ${String(fixture.id)}
        WHERE id = ${bet.id} AND user_id = ${userId}`;
      asked++;
      bets.push({ id: bet.id, ask: out.reason });
    } else {
      stillRunning++;
    }
  }

  return { provider, checked: pending.length, fixtures: fixtures.length,
           settled, asked, stillRunning, bets };
}

const iso = d => d.toISOString().slice(0, 10);
