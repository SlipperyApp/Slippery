import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  cappedUnits, capNote, isResting, scoreFixture, sortTable, movementFor,
  swissPairs, formString, currentStreak, UNIT_CAP, RESTING_MIN_BETS,
  type Standing,
} from '../lib/league.ts';

const row = (name: string, p: number, u: number, resting = false): Standing =>
  ({ name, played: 4, won: 0, drawn: 0, lost: 0, units: u, points: p, resting, form: '' });

test('the cap is on the league figure only, and it is shown not hidden', () => {
  /* Without it, one 10u punt at 12/1 on the last day of the month is the
     optimal strategy, which is the exact behaviour a tracker must not pay
     for. Real P&L is untouched — this is only what the table counts. */
  assert.equal(cappedUnits(8.4), UNIT_CAP);
  assert.equal(cappedUnits(-9.1), -UNIT_CAP);
  assert.equal(cappedUnits(2.2), 2.2);
  assert.equal(capNote(8.4), '+8.4u · counts as +3.0u');
  assert.equal(capNote(-9.1), '−9.1u · counts as −3.0u');
  assert.equal(capNote(2.2), null, 'an uncapped bet says nothing');
});

test('a head to head decided by noise is a draw', () => {
  assert.deepEqual(scoreFixture({ home: 'a', away: 'b', homeUnits: 3.2, awayUnits: 1.8 }),
    { home: 3, away: 0 });
  assert.deepEqual(scoreFixture({ home: 'a', away: 'b', homeUnits: 1.02, awayUnits: 1.0 }),
    { home: 1, away: 1 }, '0.02u apart is not a win');
  assert.deepEqual(scoreFixture({ home: 'a', away: 'b', homeUnits: 0.5, awayUnits: 2.0 }),
    { home: 0, away: 3 });
});

test('the cap applies before the fixture is scored, not after', () => {
  /* 9u against 4u is a 5u margin in the ledger and a draw in the league,
     because both are capped to 3. That is the cap doing its job. */
  assert.deepEqual(scoreFixture({ home: 'a', away: 'b', homeUnits: 9, awayUnits: 4 }),
    { home: 1, away: 1 });
});

test('resting is protection, not a penalty', () => {
  assert.equal(isResting(4), true);
  assert.equal(isResting(RESTING_MIN_BETS), false);
  /* Bottom of the table and resting: stays up. Relegating somebody for not
     betting enough is a volume nudge with a table around it. */
  assert.equal(movementFor(24, 24, true, 'Championship'), 'stay');
  assert.equal(movementFor(24, 24, false, 'Championship'), 'down');
  /* And no promotion either, or resting becomes a strategy. */
  assert.equal(movementFor(1, 24, true, 'Championship'), 'stay');
});

test('the top division cannot promote and the bottom cannot relegate', () => {
  assert.equal(movementFor(1, 24, false, 'Premier'), 'stay');
  assert.equal(movementFor(24, 24, false, 'Conference'), 'stay');
  assert.equal(movementFor(1, 24, false, 'Conference'), 'up');
});

test('the table sorts on points, then units, then name so it never reorders itself', () => {
  const t = sortTable([row('B', 6, 1.0), row('A', 6, 4.0), row('C', 9, -2.0), row('D', 6, 4.0)]);
  assert.deepEqual(t.map((r) => r.name), ['C', 'A', 'D', 'B']);
});

test('the swiss draw pairs on record and does not repeat a fixture', () => {
  const t = [row('A', 9, 5), row('B', 9, 3), row('C', 6, 2), row('D', 3, 1)];
  const { pairs, bye } = swissPairs(t, new Set());
  assert.equal(bye, null);
  assert.deepEqual(pairs, [['A', 'B'], ['C', 'D']], 'top of the table plays top');
  /* Having already met, A takes the next available rather than a rematch. */
  const again = swissPairs(t, new Set(['A|B', 'B|A']));
  assert.deepEqual(again.pairs[0], ['A', 'C']);
});

test('an odd table gives someone the bye, and it is worth a draw', () => {
  const t = [row('A', 9, 5), row('B', 6, 3), row('C', 3, 1)];
  const { pairs, bye } = swissPairs(t, new Set());
  assert.equal(bye, 'C', 'the bye goes to the bottom, so it rotates as the table moves');
  assert.equal(pairs.length, 1);
});

test('a void does not break a run, because a non-runner is not a loss', () => {
  assert.equal(formString(['W', 'W', 'L', 'V', 'W', 'W']), 'WLVWW');
  assert.deepEqual(currentStreak(['W', 'W', 'V', 'W']), { kind: 'W', n: 3 });
  assert.deepEqual(currentStreak(['W', 'W', 'L']), { kind: 'L', n: 1 });
  assert.deepEqual(currentStreak(['V', 'V']), { kind: null, n: 0 });
});
