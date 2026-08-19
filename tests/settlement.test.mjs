/* Settlement engine tests.
 *
 * Every rule in the locked list in CLAUDE.md has at least one test here.
 * If you change the engine and one of these goes red, the engine is wrong,
 * not the test, check with the owner before touching the expectation.
 *
 * Money is integer pence throughout. £100.00 is 10000.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  settle, settleMulti, settleCashOut, parseSelection, gradeMarket,
  vsLine, isQuarter, flip, payoutFor, rulesFor, bookKey, ledgerOutcome,
  cashOutcome, ninetyMinute, norm, soft, sideOf,
  WON, LOST, VOID, HALF_WON, HALF_LOST
} from '../lib/settlement/settlement.js';

const FT = (hg, ag, extra = {}) => ({
  status: 'FT', home: 'Arsenal', away: 'Chelsea', hg, ag, ...extra
});
const bet = (selection, o = {}) => ({
  selection, stakePence: 10000, odds: 2.0, book: 'Paddy Power', ...o
});

/* ===================================================================
   1. NINETY MINUTES ONLY. Extra time and penalties never count.
   =================================================================== */

test('90 mins: a normal FT result settles', () => {
  const r = settle(bet('Over 2.5'), FT(2, 1));
  assert.equal(r.status, 'settled');
  assert.equal(r.result, WON);
});

test('90 mins: AET with no 90-minute score in the feed asks, never guesses', () => {
  const r = settle(bet('Over 2.5'), { status: 'AET', home: 'A', away: 'B', hg: 3, ag: 2 });
  assert.equal(r.status, 'ask');
  assert.match(r.reason, /extra time/i);
});

test('90 mins: AET with an explicit 90-minute score uses that score, not the AET one', () => {
  /* 1-1 at 90, 3-2 after extra time. Over 2.5 must LOSE on the 90 score. */
  const r = settle(bet('Over 2.5'), {
    status: 'AET', home: 'A', away: 'B', hg: 3, ag: 2, ft90h: 1, ft90a: 1
  });
  assert.equal(r.status, 'settled');
  assert.equal(r.result, LOST);
});

test('90 mins: penalties are treated exactly like extra time', () => {
  const r = settle(bet('Arsenal'), { status: 'PEN', home: 'Arsenal', away: 'B', hg: 4, ag: 3 });
  assert.equal(r.status, 'ask');
});

test('90 mins: ninetyMinute() returns null without both halves of the 90 score', () => {
  assert.equal(ninetyMinute({ ft90h: 1 }), null);
  assert.equal(ninetyMinute({ ft90a: 1 }), null);
  assert.deepEqual(ninetyMinute({ ft90h: 1, ft90a: 0 }).hg, 1);
});

/* ===================================================================
   2. WHOLE LINES PUSH.
   =================================================================== */

test('whole line: Over 2.0 on 1-1 is a PUSH, not a loss', () => {
  const r = settle(bet('Over 2.0'), FT(1, 1));
  assert.equal(r.status, 'settled');
  assert.equal(r.result, VOID);
  assert.equal(r.profit, 0, 'a push returns the stake and makes no profit');
  assert.equal(r.payout, 10000);
});

test('whole line: Under 2.0 on 1-1 is also a push', () => {
  assert.equal(settle(bet('Under 2.0'), FT(1, 1)).result, VOID);
});

test('whole line: Over 2.0 on 2-1 wins', () => {
  assert.equal(settle(bet('Over 2.0'), FT(2, 1)).result, WON);
});

test('whole line: Over 2.0 on 1-0 loses', () => {
  assert.equal(settle(bet('Over 2.0'), FT(1, 0)).result, LOST);
});

test('void returns the stake and books exactly zero profit', () => {
  const r = settle(bet('Over 2.0', { stakePence: 3_061_8 }), FT(1, 1));
  assert.equal(r.profit, 0);
  assert.equal(r.payout, 30618);
  assert.equal(r.outcome, 'void');
});

/* ===================================================================
   3. QUARTER LINES SPLIT THE STAKE.
   =================================================================== */

test('quarter line: Over 2.25 on 1-1 is HALF LOST', () => {
  const r = settle(bet('Over 2.25'), FT(1, 1));
  assert.equal(r.result, HALF_LOST);
});

test('quarter line: Under 2.25 on 1-1 is HALF WON', () => {
  const r = settle(bet('Under 2.25'), FT(1, 1));
  assert.equal(r.result, HALF_WON);
});

test('quarter line: half lost returns exactly half the stake', () => {
  const r = settle(bet('Over 2.25', { stakePence: 10000, odds: 1.9 }), FT(1, 1));
  assert.equal(r.payout, 5000);
  assert.equal(r.profit, -5000);
});

test('quarter line: half won pays half at odds plus half back', () => {
  /* £100 at 2.50: £50 returns £125, plus £50 back = £175, profit £75 */
  const r = settle(bet('Under 2.25', { stakePence: 10000, odds: 2.5 }), FT(1, 1));
  assert.equal(r.payout, 17500);
  assert.equal(r.profit, 7500);
});

test('quarter line: Over 2.75 on 1-1 loses outright, no split', () => {
  assert.equal(settle(bet('Over 2.75'), FT(1, 1)).result, LOST);
});

test('quarter line: Over 1.75 on 1-1 is HALF WON (1.5 wins, 2.0 pushes)', () => {
  assert.equal(settle(bet('Over 1.75'), FT(1, 1)).result, HALF_WON);
});

test('quarter line: Over 1.75 on 2-1 wins outright, no split', () => {
  assert.equal(settle(bet('Over 1.75'), FT(2, 1)).result, WON);
});

test('quarter line: Over 2.25 on 3-0 wins outright', () => {
  assert.equal(settle(bet('Over 2.25'), FT(3, 0)).result, WON);
});

test('isQuarter recognises .25 and .75 and rejects .0 and .5', () => {
  assert.equal(isQuarter(2.25), true);
  assert.equal(isQuarter(2.75), true);
  assert.equal(isQuarter(-1.25), true);
  assert.equal(isQuarter(2.0), false);
  assert.equal(isQuarter(2.5), false);
});

test('flip inverts every outcome including the halves', () => {
  assert.equal(flip(WON), LOST);
  assert.equal(flip(LOST), WON);
  assert.equal(flip(HALF_WON), HALF_LOST);
  assert.equal(flip(HALF_LOST), HALF_WON);
  assert.equal(flip(VOID), VOID);
});

/* ===================================================================
   4. HANDICAPS BY BOOKMAKER. Lookup table, not hardcoded.
   =================================================================== */

test('handicap: bet365 is Asian, so a whole line PUSHES', () => {
  /* Molde -1, Molde win 2-1: margin exactly 0 */
  const fx = { status: 'FT', home: 'Molde', away: 'Bodo Glimt', hg: 2, ag: 1 };
  const r = settle(bet('Molde -1 handicap', { book: 'bet365' }), fx);
  assert.equal(r.result, VOID);
  assert.equal(r.profit, 0);
});

test('handicap: every other bookmaker is European, so that same bet LOSES', () => {
  const fx = { status: 'FT', home: 'Molde', away: 'Bodo Glimt', hg: 2, ag: 1 };
  for (const book of ['Paddy Power', 'Betfair', 'Sky Bet', 'William Hill', 'Coral']) {
    const r = settle(bet('Molde -1 handicap', { book }), fx);
    assert.equal(r.result, LOST, book + ' should settle -1 like -1.5');
  }
});

test('handicap: an unknown bookmaker defaults to European, the safer read', () => {
  const fx = { status: 'FT', home: 'Molde', away: 'Bodo', hg: 2, ag: 1 };
  assert.equal(settle(bet('Molde -1 handicap', { book: 'SomeNewBookie' }), fx).result, LOST);
  assert.equal(rulesFor('SomeNewBookie').handicap, 'european');
});

test('handicap: bookmaker names match despite spacing and case on the slip', () => {
  assert.equal(bookKey('BET 365'), 'bet365');
  assert.equal(bookKey('bet365'), 'bet365');
  assert.equal(rulesFor('BET 365').handicap, 'asian');
  assert.equal(rulesFor('Bet-365').handicap, 'asian');
  assert.equal(rulesFor('paddy power').handicap, 'european');
});

test('handicap: a covered whole line wins on both rule sets', () => {
  const fx = { status: 'FT', home: 'Legia Warsaw', away: 'Rakow', hg: 3, ag: 0 };
  assert.equal(settle(bet('Legia -1 handicap', { book: 'bet365' }), fx).result, WON);
  assert.equal(settle(bet('Legia -1 handicap', { book: 'Betfair' }), fx).result, WON);
});

test('handicap: a half line cannot push under either rule set', () => {
  const fx = { status: 'FT', home: 'Molde', away: 'Bodo', hg: 2, ag: 1 };
  assert.equal(settle(bet('Molde -1.5 handicap', { book: 'bet365' }), fx).result, LOST);
  assert.equal(settle(bet('Molde -0.5 handicap', { book: 'bet365' }), fx).result, WON);
});

test('handicap: the plus side of a whole line pushes on Asian, loses on European', () => {
  /* Bodo +1 away, losing 2-1: margin (1-2)+1 = 0 */
  const fx = { status: 'FT', home: 'Molde', away: 'Bodo', hg: 2, ag: 1 };
  assert.equal(settle(bet('Bodo +1 handicap', { book: 'bet365' }), fx).result, VOID);
  assert.equal(settle(bet('Bodo +1 handicap', { book: 'Coral' }), fx).result, LOST);
});

test('handicap: the reason text explains the European -1 behaves like -1.5', () => {
  const fx = { status: 'FT', home: 'Molde', away: 'Bodo', hg: 2, ag: 1 };
  const r = settle(bet('Molde -1 handicap', { book: 'Paddy Power' }), fx);
  assert.match(r.reason, /european/);
  assert.match(r.reason, /-1\.5/);
});

/* ===================================================================
   5. DEAD FIXTURES. Postponed/cancelled void, abandoned asks.
   =================================================================== */

test('postponed voids and returns the stake', () => {
  const r = settle(bet('Over 2.5'), { status: 'POSTPONED', home: 'A', away: 'B' });
  assert.equal(r.status, 'settled');
  assert.equal(r.result, VOID);
  assert.equal(r.profit, 0);
  assert.equal(r.payout, 10000);
});

test('cancelled voids, with both spellings the feeds use', () => {
  assert.equal(settle(bet('Over 2.5'), { status: 'CANCELLED' }).result, VOID);
  assert.equal(settle(bet('Over 2.5'), { status: 'CANCELED' }).result, VOID);
});

test('abandoned ASKS, because bookmakers settle them differently', () => {
  const r = settle(bet('Over 2.5'), { status: 'ABANDONED', home: 'A', away: 'B', hg: 2, ag: 0 });
  assert.equal(r.status, 'ask');
  assert.match(r.reason, /you decide/i);
});

test('abandoned asks even when a score is available', () => {
  const r = settle(bet('Over 1.5'), { status: 'ABANDONED', hg: 5, ag: 0 });
  assert.equal(r.status, 'ask', 'a 5-0 abandoned game is still not ours to grade');
});

test('interrupted and suspended also ask', () => {
  assert.equal(settle(bet('Over 2.5'), { status: 'INTERRUPTED' }).status, 'ask');
  assert.equal(settle(bet('Over 2.5'), { status: 'SUSPENDED' }).status, 'ask');
});

test('a fixture still in progress is pending, not settled and not asked', () => {
  const r = settle(bet('Over 2.5'), { status: 'IN_PLAY', hg: 1, ag: 0 });
  assert.equal(r.status, 'pending');
});

test('no fixture at all is pending', () => {
  assert.equal(settle(bet('Over 2.5'), null).status, 'pending');
});

test('a finished fixture with no score asks rather than assuming 0-0', () => {
  const r = settle(bet('Over 2.5'), { status: 'FT', home: 'A', away: 'B' });
  assert.equal(r.status, 'ask');
  assert.match(r.reason, /without a score/i);
});

/* ===================================================================
   6. ALWAYS ASK. Player props, cards, corners, builders, in-play.
   =================================================================== */

const ALWAYS_ASK = [
  'Anytime goalscorer',
  'Saka anytime scorer',
  'First goalscorer Havertz',
  'Last scorer Palmer',
  'Saka 1+ shots on target',
  'Over 9.5 corners',
  'Over 3.5 cards',
  'Booking points over 30',
  'Rice 2+ tackles',
  'Player to be carded',
  'Hat trick',
  'Saka to score a brace',
  'Rest of match over 0.5',
  'Next goal Arsenal',
  'Race to 3 goals',
  'Bet builder, 3 legs',
  'Same game multi',
  'Scorecast Saka 2-1',
  'Winning margin 2+',
  'Half time/full time Arsenal/Arsenal',
  'Method of first goal'
];

for (const sel of ALWAYS_ASK) {
  test(`always ask: "${sel}"`, () => {
    const r = settle(bet(sel), FT(2, 1));
    assert.equal(r.status, 'ask', `"${sel}" must never be auto-graded`);
  });
}

test('always ask: an in-play market covering part of a match is caught by soft()', () => {
  /* norm() strips "match" and "goal", so these only survive on the soft pass.
     This is exactly the case that regressed once before. */
  assert.equal(norm('Rest of match over 0.5').includes('match'), false);
  assert.equal(soft('Rest of match over 0.5').includes('rest of match'), true);
  assert.equal(settle(bet('Rest of match over 0.5'), FT(3, 0)).status, 'ask');
});

test('always ask: an unreadable selection asks rather than guessing', () => {
  assert.equal(settle(bet('~~~ garbled ~~~'), FT(2, 1)).status, 'ask');
  assert.equal(settle(bet(''), FT(2, 1)).status, 'ask');
});

test('always ask: "Match result" with no side named cannot be graded', () => {
  /* The slip says only "Match result", we do not know which team was backed. */
  assert.equal(settle(bet('Match result'), FT(2, 1)).status, 'ask');
});

test('BTTS is not swallowed by the "to score" guard', () => {
  /* "both teams to score" contains "to score", which is on the ask list.
     BTTS must be recognised first or every BTTS bet would defer. */
  assert.equal(settle(bet('BTTS Yes'), FT(1, 1)).result, WON);
  assert.equal(settle(bet('Both teams to score - No'), FT(1, 1)).result, LOST);
});

/* ===================================================================
   7. MARKETS THE FEED CAN RESOLVE.
   =================================================================== */

test('1x2 home, away and draw', () => {
  assert.equal(settle(bet('Arsenal'), FT(2, 1)).result, WON);
  assert.equal(settle(bet('Chelsea'), FT(2, 1)).result, LOST);
  assert.equal(settle(bet('Draw'), FT(1, 1)).result, WON);
  assert.equal(settle(bet('Draw'), FT(2, 1)).result, LOST);
});

test('1x2 accepts the numeric shorthand', () => {
  assert.equal(gradeMarket(parseSelection('1', FT(2, 1)), FT(2, 1)), WON);
  assert.equal(gradeMarket(parseSelection('2', FT(2, 1)), FT(2, 1)), LOST);
});

test('double chance 1X, X2 and 12', () => {
  assert.equal(settle(bet('1X'), FT(1, 1)).result, WON);
  assert.equal(settle(bet('1X'), FT(0, 1)).result, LOST);
  assert.equal(settle(bet('X2'), FT(1, 1)).result, WON);
  assert.equal(settle(bet('12'), FT(1, 1)).result, LOST);
  assert.equal(settle(bet('12'), FT(2, 1)).result, WON);
});

test('draw no bet voids on the draw', () => {
  const r = settle(bet('Arsenal draw no bet'), FT(1, 1));
  assert.equal(r.result, VOID);
  assert.equal(r.profit, 0);
  assert.equal(settle(bet('Arsenal draw no bet'), FT(2, 1)).result, WON);
  assert.equal(settle(bet('Arsenal draw no bet'), FT(0, 1)).result, LOST);
});

test('BTTS both ways', () => {
  assert.equal(settle(bet('BTTS Yes'), FT(2, 1)).result, WON);
  assert.equal(settle(bet('BTTS Yes'), FT(2, 0)).result, LOST);
  assert.equal(settle(bet('BTTS No'), FT(2, 0)).result, WON);
  assert.equal(settle(bet('BTTS No'), FT(0, 0)).result, WON);
});

test('team totals attach to the right side', () => {
  const p = parseSelection('Arsenal over 1.5', FT(2, 1));
  assert.equal(p.market, 'ou_team');
  assert.equal(p.side, 'home');
  assert.equal(settle(bet('Arsenal over 1.5'), FT(2, 1)).result, WON);
  assert.equal(settle(bet('Chelsea over 1.5'), FT(2, 1)).result, LOST);
});

test('half-time totals need the half-time score and ask without it', () => {
  assert.equal(settle(bet('First half over 1.5'), FT(3, 0)).status, 'ask');
  const r = settle(bet('First half over 1.5'), FT(3, 0, { hth: 2, hta: 0 }));
  assert.equal(r.result, WON);
});

test('second half totals subtract the first half correctly', () => {
  /* 3-1 final, 1-0 at the break, so the second half was 2-1 = 3 goals */
  const fx = FT(3, 1, { hth: 1, hta: 0 });
  assert.equal(settle(bet('Second half over 2.5'), fx).result, WON);
  assert.equal(settle(bet('Second half over 3.5'), fx).result, LOST);
});

test('correct score', () => {
  assert.equal(settle(bet('Correct score 2-1'), FT(2, 1)).result, WON);
  assert.equal(settle(bet('Correct score 2-1'), FT(1, 2)).result, LOST);
});

test('clean sheet and win to nil', () => {
  assert.equal(settle(bet('Arsenal clean sheet'), FT(2, 0)).result, WON);
  assert.equal(settle(bet('Arsenal clean sheet'), FT(2, 1)).result, LOST);
  assert.equal(settle(bet('Arsenal win to nil'), FT(2, 0)).result, WON);
  assert.equal(settle(bet('Arsenal win to nil'), FT(0, 0)).result, LOST);
});

test('team names survive the club-suffix noise on slips', () => {
  const fx = { status: 'FT', home: 'Djurgarden IF', away: 'Hammarby FC', hg: 2, ag: 0 };
  assert.equal(sideOf('Djurgarden', fx), 'home');
  assert.equal(sideOf('Hammarby', fx), 'away');
  assert.equal(settle(bet('Djurgarden'), fx).result, WON);
});

test('a short ambiguous fragment does not match a team by accident', () => {
  const fx = { status: 'FT', home: 'AS Roma', away: 'Lazio', hg: 1, ag: 0 };
  /* "as" strips to "" and must not prefix-match everything */
  assert.equal(sideOf('as', fx), null);
});

/* ===================================================================
   8. ACCUMULATORS.
   =================================================================== */

const legFx = (hg, ag, status = 'FT') => ({ status, home: 'H', away: 'A', hg, ag });

test('acca: every leg winning multiplies the odds', () => {
  const r = settleMulti({
    stakePence: 10000, book: 'bet365',
    legs: [
      { selection: 'Over 1.5', odds: 1.5, fixture: legFx(2, 1) },
      { selection: 'Over 1.5', odds: 2.0, fixture: legFx(3, 0) }
    ]
  });
  assert.equal(r.status, 'settled');
  assert.equal(r.result, WON);
  assert.equal(r.payout, 30000, '1.5 x 2.0 = 3.0 on a £100 stake');
  assert.equal(r.profit, 20000);
});

test('acca: one losing leg loses the whole bet', () => {
  const r = settleMulti({
    stakePence: 10000,
    legs: [
      { selection: 'Over 1.5', odds: 1.5, fixture: legFx(2, 1) },
      { selection: 'Over 4.5', odds: 2.0, fixture: legFx(1, 0) }
    ]
  });
  assert.equal(r.result, LOST);
  assert.equal(r.payout, 0);
  assert.equal(r.profit, -10000);
});

test('acca: a void leg drops out and the odds recalculate on the survivors', () => {
  const r = settleMulti({
    stakePence: 10000,
    legs: [
      { selection: 'Over 1.5', odds: 2.0, fixture: legFx(2, 1) },
      { selection: 'Over 2.5', odds: 3.0, fixture: { status: 'POSTPONED' } }
    ]
  });
  assert.equal(r.result, WON);
  assert.equal(r.payout, 20000, 'only the surviving 2.0 leg counts');
  assert.match(r.reason, /1 void leg dropped/);
});

test('acca: every leg void voids the whole bet and returns the stake', () => {
  const r = settleMulti({
    stakePence: 10000,
    legs: [
      { selection: 'Over 1.5', odds: 2.0, fixture: { status: 'POSTPONED' } },
      { selection: 'Over 2.5', odds: 3.0, fixture: { status: 'CANCELLED' } }
    ]
  });
  assert.equal(r.result, VOID);
  assert.equal(r.payout, 10000);
  assert.equal(r.profit, 0);
});

test('acca: one ungradeable leg defers the WHOLE bet', () => {
  const r = settleMulti({
    stakePence: 10000,
    legs: [
      { selection: 'Over 1.5', odds: 2.0, fixture: legFx(2, 1) },
      { selection: 'Anytime goalscorer', odds: 3.0, fixture: legFx(2, 1) }
    ]
  });
  assert.equal(r.status, 'ask');
  assert.match(r.reason, /Cannot grade leg/);
});

test('acca: one unfinished leg leaves the whole bet pending', () => {
  const r = settleMulti({
    stakePence: 10000,
    legs: [
      { selection: 'Over 1.5', odds: 2.0, fixture: legFx(2, 1) },
      { selection: 'Over 1.5', odds: 3.0, fixture: legFx(0, 0, 'IN_PLAY') }
    ]
  });
  assert.equal(r.status, 'pending');
});

test('acca: an abandoned leg asks', () => {
  const r = settleMulti({
    stakePence: 10000,
    legs: [
      { selection: 'Over 1.5', odds: 2.0, fixture: legFx(2, 1) },
      { selection: 'Over 1.5', odds: 3.0, fixture: legFx(2, 0, 'ABANDONED') }
    ]
  });
  assert.equal(r.status, 'ask');
});

test('acca: a leg that went to extra time without a 90 score asks', () => {
  const r = settleMulti({
    stakePence: 10000,
    legs: [
      { selection: 'Over 1.5', odds: 2.0, fixture: legFx(2, 1) },
      { selection: 'Over 1.5', odds: 3.0, fixture: legFx(3, 2, 'AET') }
    ]
  });
  assert.equal(r.status, 'ask');
  assert.match(r.reason, /extra time/);
});

test('acca: a quarter-line leg asks rather than guessing the split treatment', () => {
  const r = settleMulti({
    stakePence: 10000,
    legs: [
      { selection: 'Over 1.5', odds: 2.0, fixture: legFx(2, 1) },
      { selection: 'Over 2.25', odds: 3.0, fixture: legFx(1, 1) }
    ]
  });
  assert.equal(r.status, 'ask');
  assert.match(r.reason, /quarter line/);
});

test('acca: settle() routes multi-leg bets to the multi grader', () => {
  const r = settle({
    selection: 'Double', stakePence: 10000, odds: 3.0, book: 'bet365',
    legs: [
      { selection: 'Over 1.5', odds: 1.5, fixture: legFx(2, 1) },
      { selection: 'Over 1.5', odds: 2.0, fixture: legFx(3, 0) }
    ]
  }, legFx(2, 1));
  assert.equal(r.result, WON);
  assert.equal(r.payout, 30000);
});

/* ===================================================================
   9. CASH OUT. Always a user action, never inferred.
   =================================================================== */

test('cash out at a profit', () => {
  const r = settleCashOut({ stakePence: 10000 }, 14820);
  assert.equal(r.outcome, 'cash-profit');
  assert.equal(r.profit, 4820);
});

test('cash out at a loss', () => {
  const r = settleCashOut({ stakePence: 12500 }, 9273);
  assert.equal(r.outcome, 'cash-loss');
  assert.equal(r.profit, -3227);
});

test('cash out flat', () => {
  const r = settleCashOut({ stakePence: 10000 }, 10000);
  assert.equal(r.outcome, 'cash-flat');
  assert.equal(r.profit, 0);
});

test('the grader NEVER produces a cash outcome from a feed', () => {
  /* Sweep a wide space of markets, lines, scores, books and statuses.
     A cash-* outcome escaping the grader would mean we invented a cash
     out the user never took. */
  const sels = ['Over 2.5', 'Under 2.25', 'Over 2.0', 'Arsenal', 'Draw', 'BTTS Yes',
                'Arsenal -1 handicap', 'Chelsea +1 handicap', '1X', 'Arsenal draw no bet'];
  const books = ['bet365', 'Paddy Power', 'Nowhere'];
  const statuses = ['FT', 'POSTPONED', 'ABANDONED', 'IN_PLAY', 'AET'];
  for (const s of sels) for (const b of books) for (const st of statuses) {
    for (let hg = 0; hg <= 4; hg++) for (let ag = 0; ag <= 4; ag++) {
      const r = settle(bet(s, { book: b }), { status: st, home: 'Arsenal', away: 'Chelsea', hg, ag });
      assert.ok(!String(r.outcome || '').startsWith('cash'),
        `${s} / ${b} / ${st} ${hg}-${ag} produced ${r.outcome}`);
    }
  }
});

/* ===================================================================
   10. THE SIX OUTCOMES, AND MONEY INTEGRITY.
   =================================================================== */

const SIX = ['won', 'lost', 'cash-profit', 'cash-loss', 'cash-flat', 'void'];

test('every settled result maps into exactly one of the six ledger outcomes', () => {
  assert.equal(ledgerOutcome(WON), 'won');
  assert.equal(ledgerOutcome(HALF_WON), 'won');
  assert.equal(ledgerOutcome(LOST), 'lost');
  assert.equal(ledgerOutcome(HALF_LOST), 'lost');
  assert.equal(ledgerOutcome(VOID), 'void');
  for (const o of [WON, HALF_WON, LOST, HALF_LOST, VOID]) {
    assert.ok(SIX.includes(ledgerOutcome(o)));
  }
  for (const p of [1, -1, 0]) assert.ok(SIX.includes(cashOutcome(p)));
});

test('a half win files as a WIN, never as a cash out', () => {
  const r = settle(bet('Under 2.25'), FT(1, 1));
  assert.equal(r.result, HALF_WON);
  assert.equal(r.outcome, 'won');
});

test('a half loss files as a LOSS, never as a cash out', () => {
  const r = settle(bet('Over 2.25'), FT(1, 1));
  assert.equal(r.result, HALF_LOST);
  assert.equal(r.outcome, 'lost');
});

test('payouts are always whole pence, never fractional', () => {
  const odds = [1.17, 1.25, 1.4979, 2.31, 3.4, 6.2, 1.0303];
  const stakes = [1, 7, 333, 10000, 30618, 999999];
  for (const o of odds) for (const s of stakes) {
    for (const res of [WON, LOST, VOID, HALF_WON, HALF_LOST]) {
      const p = payoutFor(res, s, o);
      assert.equal(p, Math.trunc(p), `${res} ${s}p at ${o} gave ${p}`);
      assert.ok(p >= 0, 'a payout can never be negative');
    }
  }
});

test('profit is always payout minus stake, with no float drift', () => {
  const r = settle(bet('Over 1.5', { stakePence: 30618, odds: 1.25 }), FT(2, 1));
  assert.equal(r.payout, 38273);
  assert.equal(r.profit, 7655, 'the £76.55 from the demo slip, to the penny');
});

test('a losing bet loses exactly the stake, never more', () => {
  const r = settle(bet('Over 4.5', { stakePence: 22500 }), FT(1, 0));
  assert.equal(r.payout, 0);
  assert.equal(r.profit, -22500);
});

test('summing a thousand settled bets stays exact in pence', () => {
  let total = 0;
  for (let i = 0; i < 1000; i++) {
    const r = settle(bet('Over 1.5', { stakePence: 333, odds: 1.1 }), FT(2, 1));
    total += r.profit;
  }
  assert.equal(total, 33000, 'no drift: 33p profit a thousand times');
  assert.equal(total, Math.trunc(total));
});

/* ===================================================================
   11. STRUCTURAL GUARANTEES.
   =================================================================== */

test('settle() only ever returns settled, ask or pending', () => {
  const statuses = new Set();
  for (const st of ['FT', 'AET', 'PEN', 'POSTPONED', 'CANCELLED', 'ABANDONED',
                    'INTERRUPTED', 'SUSPENDED', 'IN_PLAY', 'NS', '', 'GIBBERISH']) {
    for (const sel of ['Over 2.5', 'Anytime scorer', 'Arsenal', '']) {
      statuses.add(settle(bet(sel), { status: st, hg: 1, ag: 1, home: 'Arsenal', away: 'Chelsea' }).status);
    }
  }
  for (const s of statuses) assert.ok(['settled', 'ask', 'pending'].includes(s), s);
});

test('a settled result always carries payout, profit and a reason', () => {
  for (const sel of ['Over 2.5', 'Under 2.25', 'Arsenal', 'BTTS Yes', 'Over 2.0']) {
    const r = settle(bet(sel), FT(1, 1));
    if (r.status !== 'settled') continue;
    assert.equal(typeof r.payout, 'number', sel);
    assert.equal(typeof r.profit, 'number', sel);
    assert.ok(r.reason && r.reason.length, sel);
    assert.ok(SIX.includes(r.outcome), sel);
  }
});

test('an ask always explains itself to the user', () => {
  for (const sel of ['Anytime scorer', 'Bet builder', '~~~', 'Over 9.5 corners']) {
    const r = settle(bet(sel), FT(1, 1));
    assert.equal(r.status, 'ask');
    assert.ok(r.reason && r.reason.length > 10, `"${sel}" needs a human reason`);
  }
});

test('the engine is pure: identical inputs give identical outputs', () => {
  const a = settle(bet('Over 2.25'), FT(1, 1));
  const b = settle(bet('Over 2.25'), FT(1, 1));
  assert.deepEqual(a, b);
});

test('the engine never mutates the bet or the fixture it is given', () => {
  const b = bet('Over 2.5');
  const f = FT(2, 1);
  const bSnap = JSON.stringify(b), fSnap = JSON.stringify(f);
  settle(b, f);
  assert.equal(JSON.stringify(b), bSnap);
  assert.equal(JSON.stringify(f), fSnap);
});

test('vsLine is symmetric around the line', () => {
  assert.equal(vsLine(3, 2.5), WON);
  assert.equal(vsLine(2, 2.5), LOST);
  assert.equal(vsLine(2, 2), VOID);
  assert.equal(vsLine(2, 2.25), HALF_LOST);
  assert.equal(vsLine(3, 2.75), HALF_WON);
});

/* ---- finished, but not provably at 90 minutes ----
 *
 * FlashScore reports FINISHED_UNKNOWN for cup ties: the match is over and
 * the score it publishes may silently include extra time. This used to fall
 * through to `pending`, which reads as "still being played" everywhere it
 * is shown, so a finished cup tie sat in the running list forever and the
 * user was never prompted. Measured against a live three day window it was
 * 274 fixtures out of 1291.
 *
 * The requirement is not that it settles. It is that it never settles, AND
 * never hides. */
test('a finished fixture with no provable 90 minute score asks, it does not sit pending', () => {
  const fx = { status: 'FINISHED_UNKNOWN', home: 'Morocco W', away: 'South Africa W', hg: 2, ag: 1 };
  const r = settle(
    { event: 'Morocco W v South Africa W', selection: 'Morocco W to win',
      market: 'Match result', book: 'bet365', odds: 2.0, stakePence: 1000 }, fx);
  assert.equal(r.status, 'ask', 'must not settle on a score that may include extra time');
  assert.notEqual(r.status, 'pending', 'and must not look like it is still running');
  assert.match(r.reason, /90 minute/);
});

test('a genuinely unfinished fixture is still pending, not ask', () => {
  /* The distinction has to survive: a match at half time is not something
     to prompt the user about. */
  const fx = { status: 'HT', home: 'Arsenal', away: 'Spurs', hg: 1, ag: 0 };
  const r = settle(
    { event: 'Arsenal v Spurs', selection: 'Arsenal to win',
      market: 'Match result', book: 'bet365', odds: 2.0, stakePence: 1000 }, fx);
  assert.equal(r.status, 'pending');
});

test('an unprovable tennis result asks rather than sitting pending', () => {
  const fx = { status: 'FINISHED_UNKNOWN', sport: 'tennis', home: 'Alcaraz', away: 'Sinner' };
  const r = settle(
    { event: 'Alcaraz v Sinner', selection: 'Alcaraz to win',
      market: 'Match result', book: 'bet365', odds: 2.0, stakePence: 1000 }, fx);
  assert.equal(r.status, 'ask');
});

/* ---- the bare handicap form ----
 *
 * Bookmakers print a handicap as "Arsenal -1", the team then a signed
 * number. The parser required the literal word "handicap", "hcp" or "ah",
 * or brackets, so against a live feed 9 handicap bets out of 300 parsed and
 * 291 came back "could not read this market with confidence".
 *
 * The rules being locked here are the brief's, and they are the reason this
 * cannot just be made permissive: bet365 is Asian, so a whole line PUSHES;
 * everyone else is European, where the handicap draw is its own outcome and
 * that same scoreline LOSES. */
test('a bare handicap parses without the word handicap in it', () => {
  const fx = { status: 'FT', home: 'Bayern Munich', away: 'Mainz', hg: 3, ag: 1 };
  const r = settle({ event: 'Bayern Munich v Mainz', selection: 'Bayern Munich -1',
    market: 'Asian Handicap', book: 'bet365', odds: 1.55, stakePence: 1000 }, fx);
  assert.equal(r.status, 'settled');
  assert.equal(r.outcome, 'won', '3-1 covers -1 outright');
});

test('a whole line pushes at bet365 and loses everywhere else', () => {
  /* Home wins by exactly one: the handicap lands dead. */
  const fx = { status: 'FT', home: 'Bayern Munich', away: 'Mainz', hg: 2, ag: 1 };
  const asian = settle({ event: 'Bayern Munich v Mainz', selection: 'Bayern Munich -1',
    market: 'Asian Handicap', book: 'bet365', odds: 1.9, stakePence: 1000 }, fx);
  assert.equal(asian.status, 'settled');
  assert.equal(asian.outcome, 'void', 'bet365 is Asian, a whole line pushes');
  assert.equal(asian.profit, 0);

  const euro = settle({ event: 'Bayern Munich v Mainz', selection: 'Bayern Munich -1',
    market: 'Handicap', book: 'Paddy Power', odds: 1.9, stakePence: 1000 }, fx);
  assert.equal(euro.status, 'settled');
  assert.equal(euro.outcome, 'lost',
    'European handicap: the handicap draw is its own outcome, so -1 acts like -1.5');
});

test('a bare signed number is not read as a handicap when no team is named', () => {
  /* The guard that stops this swallowing a totals line. */
  const fx = { status: 'FT', home: 'Arsenal', away: 'Spurs', hg: 2, ag: 1 };
  const r = settle({ event: 'Arsenal v Spurs', selection: 'Over 2.5 Goals',
    market: 'Over/Under', book: 'bet365', odds: 1.9, stakePence: 1000 }, fx);
  assert.equal(r.status, 'settled');
  assert.equal(r.outcome, 'won', 'still a totals bet, 3 goals beats 2.5');
});

test('the market label alone never invents a side', () => {
  const fx = { status: 'FT', home: 'Arsenal', away: 'Spurs', hg: 2, ag: 1 };
  const r = settle({ event: 'Arsenal v Spurs', selection: 'Handicap -1',
    market: 'Asian Handicap', book: 'bet365', odds: 1.9, stakePence: 1000 }, fx);
  assert.equal(r.status, 'ask', 'no team named, so there is no side to grade');
});
