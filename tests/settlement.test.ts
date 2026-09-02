import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  gradeTotals, gradeHandicap, gradeMatchResult, gradeLeg, settleMulti, settleBet,
  handicapStyle, marketAlwaysAsks, parseLine, isQuarterLine, isWholeLine,
  type FootballScore,
} from '@/lib/settlement/engine';

const ft = (home: number, away: number, over: Partial<FootballScore> = {}): FootballScore =>
  ({ home, away, ninetyMinute: true, status: 'finished', ...over });

// ------------------------------------------------- a wrong grade is worse

test('no 90 minute score in the feed asks rather than guessing', () => {
  const g = gradeMatchResult('home', ft(2, 1, { ninetyMinute: false }));
  assert.equal(g.status, 'ask');
});

test('extra time and penalties never count towards a match result', () => {
  // The feed can only offer the score after extra time, so we refuse it.
  const g = gradeMatchResult('home', ft(3, 2, { ninetyMinute: false }));
  assert.equal(g.status, 'ask');
  assert.match(g.why, /extra time/i);
});

test('postponed and cancelled are void', () => {
  assert.equal((gradeMatchResult('home', ft(0, 0, { status: 'postponed' })) as any).result, 'void');
  assert.equal((gradeMatchResult('home', ft(0, 0, { status: 'cancelled' })) as any).result, 'void');
});

test('abandoned asks, because bookmakers differ', () => {
  assert.equal(gradeMatchResult('home', ft(1, 0, { status: 'abandoned' })).status, 'ask');
});

test('an unfinished fixture defers rather than grading', () => {
  assert.equal(gradeMatchResult('home', ft(1, 0, { status: 'in_play' })).status, 'defer');
});

// --------------------------------------------------------------- totals

test('whole lines PUSH: over 2.0 on 1-1 is a void, not a loss', () => {
  const g = gradeTotals('over', 2, ft(1, 1));
  assert.equal(g.status, 'graded');
  assert.equal((g as any).result, 'void');
});

test('quarter lines SPLIT the stake: over 2.25 on 1-1 loses half', () => {
  const g = gradeTotals('over', 2.25, ft(1, 1));
  assert.equal((g as any).result, 'half_lost');
});

test('over 2.25 on a 2-1 wins outright, because both halves win', () => {
  assert.equal((gradeTotals('over', 2.25, ft(2, 1)) as any).result, 'won');
});

test('over 1.75 on exactly 2 goals wins half and pushes half', () => {
  // over 1.5 wins, over 2.0 pushes.
  assert.equal((gradeTotals('over', 1.75, ft(1, 1)) as any).result, 'half_won');
  // under 2.0 pushes, under 2.5 wins.
  assert.equal((gradeTotals('under', 2.25, ft(1, 1)) as any).result, 'half_won');
});

test('half lines cannot push', () => {
  assert.equal((gradeTotals('over', 2.5, ft(1, 1)) as any).result, 'lost');
  assert.equal((gradeTotals('over', 2.5, ft(2, 1)) as any).result, 'won');
});

// ------------------------------------------------------------ handicaps

test('the handicap convention comes from a lookup, never a hardcode', () => {
  assert.equal(handicapStyle('bet365'), 'asian');
  assert.equal(handicapStyle('sky-bet'), 'european');
  assert.equal(handicapStyle('a-book-nobody-added'), 'european', 'the safe default');
});

test('bet365 is Asian, so a whole line pushes on the exact scoreline', () => {
  const g = gradeHandicap('home', -1, ft(2, 1), handicapStyle('bet365'));
  assert.equal((g as any).result, 'void');
});

test('a European book gives the handicap draw its own outcome, so -1 LOSES on a one goal win', () => {
  const g = gradeHandicap('home', -1, ft(2, 1), handicapStyle('sky-bet'));
  assert.equal((g as any).result, 'lost');
});

test('a two goal win covers a -1 under either convention', () => {
  assert.equal((gradeHandicap('home', -1, ft(3, 1), 'asian') as any).result, 'won');
  assert.equal((gradeHandicap('home', -1, ft(3, 1), 'european') as any).result, 'won');
});

test('a quarter line handicap splits under the Asian convention', () => {
  // -0.75 on a one goal win: -0.5 wins, -1.0 pushes.
  assert.equal((gradeHandicap('home', -0.75, ft(1, 0), 'asian') as any).result, 'half_won');
});

// ----------------------------------------------------- markets that ask

test('the markets that always ask, always ask', () => {
  for (const m of ['Anytime scorer', 'Player props', 'Total corners over 9.5', 'Cards over 3.5',
    'Bet builder', 'Same game multi', 'Next goal', 'Rest of match']) {
    assert.ok(marketAlwaysAsks(m), `${m} should always ask`);
    assert.equal(gradeLeg({ marketRaw: m, selection: 'A', bookmakerId: 'bet365', score: ft(2, 0) }).status, 'ask');
  }
});

// --------------------------------------------------------------- parser

test('lines are parsed out of the bookmakers own wording', () => {
  assert.deepEqual(parseLine('Over 2.5 goals'), { kind: 'over', line: 2.5 });
  assert.deepEqual(parseLine('Under 3.25'), { kind: 'under', line: 3.25 });
  assert.deepEqual(parseLine('Asian handicap -1'), { kind: 'handicap', line: -1 });
  assert.equal(parseLine('Both teams to score'), null);
});

test('quarter and whole lines are told apart', () => {
  assert.ok(isQuarterLine(2.25) && isQuarterLine(-0.75));
  assert.ok(!isQuarterLine(2.5));
  assert.ok(isWholeLine(2) && !isWholeLine(2.5));
});

// ------------------------------------------------------------ multiples

test('a multiple defers until every leg has graded', () => {
  assert.equal(settleMulti(['won', 'open', 'won']).type, null);
});

test('one lost leg loses the multiple', () => {
  assert.equal(settleMulti(['won', 'lost', 'won']).type, 'lost');
});

test('a leg that needs a person stops the whole bet', () => {
  assert.equal(settleMulti(['won', 'ask', 'won']).type, null);
});

test('void legs drop and the rest decides', () => {
  assert.equal(settleMulti(['won', 'void', 'won']).type, 'won');
  assert.equal(settleMulti(['void', 'void']).type, 'void');
});

test('a single goes through the same path as a multiple, so there is one grader', () => {
  assert.equal(settleBet(['won']).type, 'won');
  assert.equal(settleBet(['lost']).type, 'lost');
  assert.equal(settleBet(['void']).type, 'void');
});

test('a quarter line leg inside a multiple carries its split up to the bet', () => {
  assert.equal(settleMulti(['won', 'half_lost']).type, 'half_lost');
  assert.equal(settleMulti(['won', 'half_won']).type, 'half_won');
});

// ---------------------------------------------------------- commission

/*  COMMISSION HAD NO APPENDER. The fold has understood a `commission` event
 *  since the first migration and nothing in the product ever wrote one, so
 *  every exchange winner in a real ledger was reported 1.5 to 2 per cent
 *  above what the exchange paid. The example account builds its own events
 *  and DID charge it, which is why the screenshots looked right.
 *
 *  Neither settlement path can be exercised without a database, so what is
 *  asserted here is that both of them go through the one appender that
 *  charges, and that neither has a second path around it. */

const SETTLEMENT_PATHS = ['app/api/settle/route.ts', 'app/api/cron/results/route.ts'];

test('both settlement paths append through the one thing that charges commission', () => {
  for (const f of SETTLEMENT_PATHS) {
    const src = readFileSync(f, 'utf8');
    assert.match(src, /appendResult\(/, `${f} settles a bet without charging commission`);
    assert.doesNotMatch(
      src.replace(/appendResult/g, ''),
      /appendEvent\(/,
      `${f} has a second append path that skips the charge`,
    );
  }
});

test('the appender charges on the state the result produced, and only once', () => {
  const src = readFileSync('lib/server/bets.ts', 'utf8');
  assert.match(src, /export async function appendResult/);
  assert.match(src, /commissionDue\(bet, events, state\)/, 'the charge is decided off something other than the fold');
  assert.match(src, /type: 'commission'/);
  // The amount is never worked out here. One commission formula, in the fold.
  assert.doesNotMatch(src, /Math\.(ceil|round)\([^)]*commission/i);
});

test('a bet is written with its bookmaker rate frozen on it, not with a zero', () => {
  /*  The insert carried a literal 0 for commission_pct, so even once
   *  settlement learned to charge, every bet had nothing to charge. */
  const src = readFileSync('app/api/bets/route.ts', 'utf8');
  assert.match(src, /select commission_pct from bookmakers/);
  assert.doesNotMatch(src, /commissionPct: 0/, 'the rate is hardcoded to zero again');
});

test('the migration that widens the outcome column is numbered past the branch that is not here', () => {
  const sql = readFileSync('migrations/0007_pl_truth.sql', 'utf8');
  assert.match(sql, /check \(outcome in \('won','lost','placed','cash-profit','cash-loss','cash-flat','void'\)\)/);
  assert.match(sql, /places_paid/);
  assert.match(sql, /bet_fingerprint/);
  /*  A check cannot be widened in place, so the old one has to go first, and
   *  it is found by what it contains rather than by a guessed name: 0001
   *  declared it inline, so a `drop constraint if exists` naming it wrongly
   *  is a silent no-op that leaves the old check standing and every `placed`
   *  write failing against a constraint that is not in this file. */
  assert.match(sql, /pg_get_constraintdef\(con\.oid\) like '%cash-flat%'/);
  assert.ok(
    sql.indexOf('drop constraint %I') < sql.indexOf('add constraint bet_state_outcome_check'),
    'the outcome check is added before the old one is dropped',
  );
});
