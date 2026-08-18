/* A bet builder is not three singles, and it is not an accumulator either.
 *
 * All three arrive as marks on one screenshot and they are three different
 * things:
 *   three singles  three stakes, three bets, three rows
 *   accumulator    one stake, legs in DIFFERENT fixtures, grades when
 *                  every leg grades and void legs drop out
 *   bet builder    one stake, legs in the SAME fixture, correlated, priced
 *                  as one product, and never auto-graded
 *
 * Before this the database could not tell any of them apart. `bet_type`
 * was read for display and never stored, there was no legs column, and a
 * multiple was saved as one row whose selection was its legs joined by an
 * ampersand. That is why settleMulti() — written, tested, and carrying the
 * locked accumulator rules — had never run once in production: the legs
 * were destroyed at save time and api/_lib/settling.js built the settle()
 * argument without them.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { sanitise } from '../api/extract.js';
import { inferBetType, cleanLegs, betProblem, isMulti, BET_TYPES } from '../src/js/betshape.js';
import { settle } from '../src/js/settlement.js';

const read = f => readFile(new URL('../' + f, import.meta.url), 'utf8');
const leg = (selection, event, odds = 2) =>
  ({ selection, event, market: 'Full Time Result', odds, result: 'open' });
const betOf = over => Object.assign(
  { selection: 'x', event: 'A v B', market: 'Full Time Result', bookmaker: 'bet365',
    odds: 3, stake: 10, returns: 30, result: 'open', stage: 'prematch',
    placed_at: '2026-08-01', bet_type: 'unknown', selections: [] }, over);

/* ---------------- the reader ---------------- */

test('legs in one fixture are a bet builder', () => {
  const out = sanitise({ bets: [betOf({ selections: [
    leg('Arsenal to win', 'Arsenal v Chelsea'),
    leg('Over 2.5 Goals', 'Arsenal v Chelsea'),
    leg('Saka to score', 'Arsenal v Chelsea')
  ] })] });
  assert.equal(out.bets.length, 1, 'one stake is one bet');
  assert.equal(out.bets[0].bet_type, 'bet_builder');
  assert.equal(out.bets[0].legs, 3);
});

test('legs across fixtures are an accumulator', () => {
  const out = sanitise({ bets: [betOf({ selections: [
    leg('Arsenal to win', 'Arsenal v Chelsea'),
    leg('Spurs to win', 'Spurs v Everton')
  ] })] });
  assert.equal(out.bets[0].bet_type, 'multiple');
});

test('a label on the slip beats the fixture test', () => {
  /* Bookmakers print "Bet Builder" on the thing they are selling, and a
     builder can span two listed fixtures on some books. */
  const out = sanitise({ bets: [betOf({ bet_type: 'bet_builder', selections: [
    leg('Arsenal to win', 'Arsenal v Chelsea'),
    leg('Spurs to win', 'Spurs v Everton')
  ] })] });
  assert.equal(out.bets[0].bet_type, 'bet_builder');
});

test('one selection is a single whatever the reader said', () => {
  assert.equal(sanitise({ bets: [betOf({ bet_type: 'multiple', selections: [] })] })
    .bets[0].bet_type, 'single');
});

test('a system bet keeps its own type and is never inferred away', () => {
  const out = sanitise({ bets: [betOf({ bet_type: 'system', selections: [
    leg('a', 'A v B'), leg('b', 'C v D')
  ] })] });
  assert.equal(out.bets[0].bet_type, 'system');
});

test('an unreadable type is null and is named, not guessed', () => {
  /* Legs with no fixture on them cannot be classified by the fixture test,
     and guessing between the two would be a wrong grade waiting to
     happen. The card asks instead. */
  const out = sanitise({ bets: [betOf({ selections: [leg('a', ''), leg('b', '')] })] });
  assert.equal(out.bets[0].bet_type, null);
  assert.ok(out.unreadable_fields.some(f => /type/.test(f)),
    'an unreadable type must be named: ' + JSON.stringify(out.unreadable_fields));
});

test('three separate singles stay three bets, each with its own type', () => {
  const out = sanitise({ bets: [
    betOf({ selection: 'Arsenal', stake: 10 }),
    betOf({ selection: 'Spurs', stake: 25 }),
    betOf({ selection: 'Chelsea', stake: 5 })
  ] });
  assert.equal(out.bets.length, 3);
  assert.equal(out.bet_count, 3, 'the badge must match the cards');
  for (const b of out.bets) assert.equal(b.bet_type, 'single');
  assert.deepEqual(out.bets.map(b => b.stake), [10, 25, 5], 'each keeps its own stake');
});

test('a single and a treble on one page are read as what they are', () => {
  const out = sanitise({ bets: [
    betOf({ selection: 'Arsenal', stake: 10 }),
    betOf({ selection: 'Treble', stake: 5, selections: [
      leg('a', 'A v B'), leg('b', 'C v D'), leg('c', 'E v F')
    ] })
  ] });
  assert.deepEqual(out.bets.map(b => b.bet_type), ['single', 'multiple']);
});

/* ---------------- the shared classifier ---------------- */

test('inferBetType refuses rather than guesses', () => {
  assert.equal(inferBetType([leg('a', 'A v B'), leg('b', 'A v B')]), 'bet_builder');
  assert.equal(inferBetType([leg('a', 'A v B'), leg('b', 'C v D')]), 'multiple');
  assert.equal(inferBetType([leg('a', 'A v B')]), null, 'one leg is not a multiple');
  assert.equal(inferBetType([leg('a', ''), leg('b', 'C v D')]), null, 'a missing fixture is unknown');
  assert.equal(inferBetType(null), null);
});

test('cleanLegs keeps exactly what the grader reads and nothing else', () => {
  const [one] = cleanLegs([{ selection: ' Arsenal ', event: 'A v B', market: 'FTR',
                             odds: '2.5', result: 'open', junk: 'x' }]);
  assert.deepEqual(Object.keys(one).sort(), ['event', 'market', 'odds', 'selection']);
  assert.equal(one.selection, 'Arsenal');
  assert.equal(one.odds, 2.5);
  assert.equal(cleanLegs([{ selection: '' }]), null, 'a leg with no selection is not a leg');
});

test('a malformed leg is rejected before it can be saved', () => {
  assert.equal(betProblem({ stakePence: 1000, odds: 2, selection: 'x', legs: [] }), '');
  assert.match(betProblem({ stakePence: 1000, odds: 2, selection: 'x',
    legs: [{ selection: '' }] }), /needs a selection/);
  assert.match(betProblem({ stakePence: 1000, odds: 2, selection: 'x',
    legs: [{ selection: 'a', odds: 0.5 }] }), /greater than 1/);
  assert.match(betProblem({ stakePence: 1000, odds: 2, selection: 'x', legs: 'no' }), /list/);
});

test('the four types are the four the database and the schema agree on', async () => {
  const extract = await read('api/extract.js');
  for (const t of BET_TYPES) assert.ok(extract.includes("'" + t + "'"), t + ' is not in the schema');
  assert.equal(isMulti('single'), false);
  assert.ok(isMulti('multiple') && isMulti('bet_builder') && isMulti('system'));
});

/* ---------------- settlement ---------------- */

const FX = { status: 'FT', hg: 2, ag: 0, home: 'Arsenal', away: 'Chelsea', event: 'Arsenal v Chelsea' };

test('a bet builder is never graded, however readable the score', () => {
  const out = settle({
    selection: 'Arsenal', market: 'Full Time Result', event: 'Arsenal v Chelsea',
    stakePence: 1000, odds: 3, betType: 'bet_builder',
    legs: [{ selection: 'Arsenal', event: 'Arsenal v Chelsea', odds: 1.5 },
           { selection: 'Over 1.5 Goals', event: 'Arsenal v Chelsea', odds: 2 }]
  }, FX);
  assert.equal(out.status, 'ask');
  assert.match(out.reason, /bet builder/i);
});

test('a system bet is never graded either', () => {
  const out = settle({ selection: 'Yankee', market: '', event: 'Arsenal v Chelsea',
    stakePence: 1000, odds: 6, betType: 'system' }, FX);
  assert.equal(out.status, 'ask');
  assert.match(out.reason, /system/i);
});

test('an accumulator now reaches the multi grader at all', () => {
  /* The regression this whole change exists to close: with no legs the
     engine graded the joined selection string as a single market. */
  const out = settle({
    selection: 'Arsenal & Over 1.5', market: 'Full Time Result',
    event: 'Arsenal v Chelsea', stakePence: 1000, odds: 3, betType: 'multiple',
    legs: [
      { selection: 'Arsenal', market: 'Full Time Result', odds: 1.5,
        fixture: { status: 'FT', hg: 2, ag: 0, home: 'Arsenal', away: 'Chelsea', event: 'Arsenal v Chelsea' } },
      { selection: 'Over 1.5 Goals', market: 'Over/Under', odds: 2,
        fixture: { status: 'FT', hg: 3, ag: 1, home: 'Spurs', away: 'Everton', event: 'Spurs v Everton' } }
    ]
  }, FX);
  assert.equal(out.status, 'settled');
  assert.equal(out.outcome, 'won');
  /* Stake times the legs multiplied out: 1000 × 1.5 × 2 = 3000, profit 2000. */
  assert.equal(out.profit, 2000);
});

test('one losing leg loses the accumulator', () => {
  const out = settle({
    selection: 'x', market: 'Full Time Result', event: 'Arsenal v Chelsea',
    stakePence: 1000, odds: 3, betType: 'multiple',
    legs: [
      { selection: 'Arsenal', market: 'Full Time Result', odds: 1.5,
        fixture: { status: 'FT', hg: 2, ag: 0, home: 'Arsenal', away: 'Chelsea', event: 'Arsenal v Chelsea' } },
      { selection: 'Everton', market: 'Full Time Result', odds: 2,
        fixture: { status: 'FT', hg: 3, ag: 1, home: 'Spurs', away: 'Everton', event: 'Spurs v Everton' } }
    ]
  }, FX);
  assert.equal(out.outcome, 'lost');
  assert.equal(out.profit, -1000);
});

test('a leg still running holds the whole accumulator', () => {
  const out = settle({
    selection: 'x', market: 'Full Time Result', event: 'Arsenal v Chelsea',
    stakePence: 1000, odds: 3, betType: 'multiple',
    legs: [
      { selection: 'Arsenal', market: 'Full Time Result', odds: 1.5,
        fixture: { status: 'FT', hg: 2, ag: 0, home: 'Arsenal', away: 'Chelsea', event: 'Arsenal v Chelsea' } },
      { selection: 'Spurs', market: 'Full Time Result', odds: 2,
        fixture: { status: 'LIVE', hg: 0, ag: 0, home: 'Spurs', away: 'Everton',
                   event: 'Spurs v Everton' } }
    ]
  }, FX);
  assert.equal(out.status, 'pending');
});

/* ---------------- the wiring, which is where it broke before ---------------- */

test('the grader is given the legs and the type', async () => {
  const settling = await read('api/_lib/settling.js');
  assert.match(settling, /bet_type, legs/, 'the pending query must select them');
  assert.match(settling, /betType: bet\.bet_type/);
  assert.match(settling, /legs\s*$/m, 'settle() must be passed legs');
  /* Each leg of an accumulator is a different fixture and needs its own
     result, which is what settleMulti reads off leg.fixture. */
  assert.match(settling, /matchFixture\(leg\.event, pool\)/);
});

test('the columns exist and are written on both save paths', async () => {
  const db = await read('api/_lib/db.js');
  assert.match(db, /ADD COLUMN IF NOT EXISTS bet_type text/);
  assert.match(db, /ADD COLUMN IF NOT EXISTS legs jsonb/);
  const bets = await read('api/bets.js');
  assert.equal((bets.match(/bet_type, legs\)/g) || []).length, 2,
    'the single path and the bulk path must both store them');
  assert.match(bets, /betTypeOf/);
});

test('the client sends the legs it read rather than joining them away', async () => {
  const main = await read('src/js/main.js');
  assert.match(main, /legs: card\.dataset\.legList \? JSON\.parse\(card\.dataset\.legList\) : undefined/);
  assert.match(main, /betType: card\.dataset\.betType \|\| undefined/);
  /* And a multiple whose kind is unknown cannot be confirmed. */
  assert.match(main, /card\.dataset\.needsType/);
});
