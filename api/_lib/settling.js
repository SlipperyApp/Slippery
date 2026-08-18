/* Settle one user's running bets against the scraped results.
 *
 * Three callers want exactly this: the refresh button (POST /api/settle),
 * the sign-in check (GET /api/auth/me), and the daily sweep, which runs it
 * per user. Writing it once means there is one grader, one matching rule and
 * one set of pence, three copies of this would eventually disagree, and a
 * ledger that disagrees with itself is the failure this product cannot have.
 *
 * The engine is src/js/settlement.js, the same module the browser holds.
 * Anything it returns as {status:'ask'} is recorded with its reason and left
 * for the user, because a wrong grade is worse than no grade.
 */
import { settle } from '../../src/js/settlement.js';
import { sportOf, HORSES_REASON } from '../../src/js/sports.js';
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
    SELECT id, event, selection, market, bookmaker, odds, stake_pence, placed_at,
           bet_type, legs
    FROM bets
    WHERE user_id = ${userId} AND status IN ('pending', 'ask')
      AND placed_at > now() - interval '30 days'
    ORDER BY placed_at DESC LIMIT ${MAX_BETS}`;

  if (!pending.length) {
    return { provider: null, checked: 0, settled: 0, asked: 0, stillRunning: 0, bets: [] };
  }

  /* Split by sport before anything is fetched.
     A racing bet has no feed to look up, and a tennis bet must not be
     matched against a list of football fixtures, so the sport decides both
     which fixtures to pull and which rules grade it. */
  const bySport = { football: [], tennis: [], horses: [] };
  for (const bet of pending) {
    bySport[sportOf({ event: bet.event, selection: bet.selection, market: bet.market })].push(bet);
  }

  /* One fetch for the whole window, not one per bet. A user with twelve
     pending bets on a Saturday would otherwise make twelve scrapes to
     answer one question, which is how a scraper earns a block. */
  /* THE WINDOW IS WHAT THE BETS NEED, NOT A FIXED LOOKBACK.
   *
   * This used to pull LOOKBACK_DAYS every time regardless. Measured on
   * production: one bet placed two days ago pulled 2814 fixtures and the
   * request took 7.8 seconds against a ten second function ceiling, and the
   * call before it returned nothing at all. That is not slow, it is a
   * settlement path that fails silently on any account with a few more
   * bets than mine.
   *
   * The oldest pending bet is the only thing that decides how far back to
   * look. Most sweeps are one or two days wide now; the cap still applies
   * so a bet somebody logged with a wrong date from last year cannot make
   * the sweep pull a year. */
  const today = new Date();
  const oldest = pending.reduce((a, b) => {
    const t = new Date(b.placed_at).getTime();
    return Number.isFinite(t) && t < a ? t : a;
  }, today.getTime());
  const daysBack = Math.min(LOOKBACK_DAYS,
    Math.max(1, Math.ceil((today.getTime() - oldest) / 86400000) + 1));
  const from = iso(new Date(today.getTime() - daysBack * 86400000));
  const to = iso(new Date(today.getTime() + 86400000));

  /* Only fetch what there are bets for. Someone with three football bets
     should not make a tennis request, and someone with only racing bets
     should make none at all. */
  const football = bySport.football.length
    ? await feed.resolveFinished(from, to)
    : { provider: null, fixtures: [] };
  const tennis = bySport.tennis.length
    ? await feed.resolveTennis(from, to)
    : { provider: null, fixtures: [] };
  const provider = [football.provider, tennis.provider].filter(Boolean).join(' + ') || null;
  const fixtures = football.fixtures.concat(tennis.fixtures);

  /* Anything the sweep did not match gets one direct lookup each. A sweep
     only sees the days and competitions it pulled, so a bet outside that
     window would otherwise stay pending forever, indistinguishable from
     "still running", and the more annoying of the two failures. */
  const unmatched = bySport.football.filter(b => !feed.matchFixture(b.event, football.fixtures));
  const extra = unmatched.length
    /* The window goes through so the widened re-pull knows where to look.
       Without it lookupEach could only use SofaScore search, which is 403
       from a serverless IP, so in production it returned nothing at all. */
    ? await feed.lookupEach(unmatched.map(b => b.event), 8, from, to)
    : new Map();

  let settled = 0, asked = 0, stillRunning = 0;
  const bets = [];

  /* Racing never reaches a feed. It is recorded as needing the user, once,
     with the reason, so it stops looking identical to a bet that is still
     running. */
  for (const bet of bySport.horses) {
    await sql`
      UPDATE bets SET status = 'ask', settle_reason = ${HORSES_REASON}
      WHERE id = ${bet.id} AND user_id = ${userId}`;
    asked++;
    bets.push({ id: bet.id, ask: HORSES_REASON });
  }

  for (const bet of bySport.football.concat(bySport.tennis)) {
    const pool = bySport.tennis.includes(bet) ? tennis.fixtures : football.fixtures;
    const fixture = feed.matchFixture(bet.event, pool) || extra.get(bet.event);
    if (!fixture) { stillRunning++; continue; }

    /* THE LEGS TRAVEL WITH THE BET.
     *
     * They did not, and that is why settleMulti() in the engine — written,
     * tested, and carrying the locked accumulator rules — had never run
     * once in production. A multiple was stored as one row with its legs
     * joined into the selection string and graded as though that string
     * were a single market, which it is not.
     *
     * Each leg of an accumulator is a different fixture, so each one needs
     * its own result. Matched here, by the leg's own event, and attached
     * as leg.fixture, which is exactly what settleMulti reads. A leg with
     * no match leaves the whole bet pending, which is the rule: all legs
     * grade or the bet defers. */
    const legs = Array.isArray(bet.legs) && bet.legs.length
      ? bet.legs.map(leg => Object.assign({}, leg, {
          fixture: leg.event
            ? (feed.matchFixture(leg.event, pool) || extra.get(leg.event) || null)
            : null
        }))
      : null;

    const out = settle({
      selection: bet.selection,
      market: bet.market,
      event: bet.event,
      stakePence: bet.stake_pence,
      odds: Number(bet.odds),
      book: bet.bookmaker,
      betType: bet.bet_type,
      legs
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
