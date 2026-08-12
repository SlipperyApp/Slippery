/* Which sport is this, and what happens when we are not sure.
 *
 * The football engine is greedy: it will find "Over 2.5" in a tennis
 * selection and grade it against goals. So the routing is the thing that
 * keeps the LOCKED rule true across three sports, and it is tested from the
 * direction that matters: a wrong route is a wrong grade.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sportOf, HORSES_REASON } from '../src/js/sports.js';
import { settle, totalGames, settleTennis } from '../src/js/settlement.js';

const tennisFx = (hg, ag, sets, status = 'FT') => ({
  sport: 'tennis', status, home: 'Alcaraz C.', away: 'Sinner J.', hg, ag, sets
});
const bet = (selection, extra) => Object.assign({ selection, stakePence: 10000, odds: 2.0 }, extra);

test('racing is recognised from the wording bookmakers actually use', () => {
  for (const text of [
    'Constitution Hill each way', 'Galopin Des Champs e/w', '14:35 Ascot',
    'Novices Hurdle', 'Gold Cup Chase', 'Trap 4', 'Forecast 1-2',
    'State Man to win race'
  ]) {
    assert.equal(sportOf({ selection: text }), 'horses', 'should be racing: ' + text);
  }
});

test('tennis is recognised from sets, games and the tours', () => {
  for (const text of [
    'Alcaraz in straight sets', 'Set betting 3-1', 'Over 21.5 games',
    'Sinner to win a set', 'ATP Cincinnati', 'Total sets over 2.5'
  ]) {
    assert.equal(sportOf({ selection: text }), 'tennis', 'should be tennis: ' + text);
  }
  /* Two players rather than two teams, from the fixture name alone. */
  assert.equal(sportOf({ event: 'Alcaraz C. - Sinner J.', selection: 'Alcaraz C.' }), 'tennis');
});

test('football stays football, including the words that look like other sports', () => {
  for (const ev of [
    { event: 'Arsenal v Chelsea', selection: 'Over 2.5 Goals' },
    { event: 'Molde v Bodo/Glimt', selection: 'Molde -1 handicap' },
    /* "Nott'm Forest v Man Utd" must not read as two players. */
    { event: "Nott'm Forest v Man Utd", selection: 'Draw' },
    { event: 'Sirius v Djurgarden', selection: 'Both teams to score' }
  ]) {
    assert.equal(sportOf(ev), 'football', 'should be football: ' + ev.selection);
  }
});

test('an explicit sport beats any guess made from wording', () => {
  assert.equal(sportOf({ sport: 'tennis', selection: 'Over 2.5 Goals' }), 'tennis');
  assert.equal(sportOf({ sport: 'football', selection: 'each way' }), 'football');
});

test('a racing bet is NEVER graded against a football scoreline', () => {
  /* The bug this exists to stop: matchFixture pairs a racing bet with some
     fixture, the football engine finds a market it recognises, and money
     moves on a guess. */
  const out = settle(bet('Constitution Hill e/w'),
    { status: 'FT', home: 'Arsenal', away: 'Chelsea', hg: 2, ag: 1, ft90h: 2, ft90a: 1 });
  assert.equal(out.status, 'ask');
  assert.equal(out.reason, HORSES_REASON);
});

test('a tennis bet is not graded by football rules', () => {
  /* "Over 2.5" against 2-1 in sets is 3 sets, which is over. Against a
     football score of 2-1 it is also over, so the two agree here by luck.
     What must not happen is the football grader running at all, and the
     reason says which one did. */
  const out = settle(bet('Over 2.5 sets'), tennisFx(2, 1, [[6, 4], [3, 6], [7, 5]]));
  assert.equal(out.status, 'settled');
  assert.match(out.reason, /in sets/);
});

test('tennis match winner comes from sets, not games', () => {
  /* Sinner wins more games (17 to 16) and loses the match. A grader working
     from a football-shaped "score" would settle this the wrong way round. */
  const fx = tennisFx(2, 1, [[6, 4], [3, 6], [7, 5]]);
  assert.equal(settle(bet('Alcaraz C.'), fx).outcome, 'won');
  assert.equal(settle(bet('Sinner J.'), fx).outcome, 'lost');
});

test('set betting reads the scoreline, not just the name', () => {
  const fx = tennisFx(2, 1, [[6, 4], [3, 6], [7, 5]]);
  assert.equal(settle(bet('Alcaraz 2-1'), fx).outcome, 'won');
  assert.equal(settle(bet('Alcaraz 2-0'), fx).outcome, 'lost',
    'naming the winner is not enough when the slip also names a scoreline');
});

test('straight sets loses when a set was dropped', () => {
  assert.equal(settle(bet('Alcaraz in straight sets'), tennisFx(2, 1, [[6, 4], [3, 6], [7, 5]])).outcome, 'lost');
  assert.equal(settle(bet('Alcaraz in straight sets'), tennisFx(2, 0, [[6, 4], [6, 3]])).outcome, 'won');
});

test('total games needs every set, or it asks', () => {
  const complete = tennisFx(2, 1, [[6, 4], [3, 6], [7, 5]]);
  assert.equal(totalGames(complete), 31);
  assert.equal(settle(bet('Over 30.5 games'), complete).outcome, 'won');
  assert.equal(settle(bet('Under 30.5 games'), complete).outcome, 'lost');

  /* Two sets reported for a three-set match: the total is a floor, not a
     figure, and settling on it would be settling on an undercount. */
  const partial = tennisFx(2, 1, [[6, 4], [3, 6]]);
  assert.equal(totalGames(partial), null);
  const out = settle(bet('Over 30.5 games'), partial);
  assert.equal(out.status, 'ask');
  assert.match(out.reason, /every set/);
});

test('a whole games line pushes, exactly as it does in football', () => {
  const out = settle(bet('Over 31.0 games'), tennisFx(2, 1, [[6, 4], [3, 6], [7, 5]]));
  assert.equal(out.status, 'settled');
  assert.equal(out.outcome, 'void');
  assert.equal(out.profit, 0);
});

test('a retirement always asks, whatever the sets say', () => {
  const out = settle(bet('Alcaraz C.'), tennisFx(2, 0, [[6, 4], [3, 1]], 'RETIRED'));
  assert.equal(out.status, 'ask');
  assert.match(out.reason, /differently/);
});

test('an unrecognised tennis status never settles', () => {
  for (const status of ['FINISHED_UNKNOWN', 'WALKOVER', 'SOMETHING NEW']) {
    const out = settle(bet('Alcaraz C.'), tennisFx(2, 0, [[6, 4], [6, 3]], status));
    assert.notEqual(out.status, 'settled', status + ' must not settle');
  }
});

test('player props in tennis ask rather than guess', () => {
  const fx = tennisFx(2, 1, [[6, 4], [3, 6], [7, 5]]);
  for (const sel of ['Alcaraz aces over 8.5', 'Sinner double faults under 2.5']) {
    assert.equal(settle(bet(sel), fx).status, 'ask', sel);
  }
});

test('a named set is graded from that set, not from the match', () => {
  /* Alcaraz wins set 1 and the match; Sinner wins set 2. Falling through to
     the match winner would call "second set winner Sinner" a loss, which is
     the sort of wrong answer nobody notices. */
  const fx = tennisFx(2, 1, [[6, 4], [3, 6], [7, 5]]);
  assert.equal(settle(bet('First set winner Alcaraz'), fx).outcome, 'won');
  assert.equal(settle(bet('Sinner to win the second set'), fx).outcome, 'won');
  assert.equal(settle(bet('Alcaraz set 2'), fx).outcome, 'lost');
});

test('a named set the feed did not break out asks', () => {
  const fx = tennisFx(2, 0, [[6, 4], [6, 3]]);
  const out = settle(bet('Third set winner Alcaraz'), fx);
  assert.equal(out.status, 'ask');
  assert.match(out.reason, /set 3/);
});

test('tennis with no set score asks rather than settling on nothing', () => {
  const out = settleTennis(bet('Alcaraz C.'), { status: 'FT', home: 'Alcaraz C.', away: 'Sinner J.' });
  assert.equal(out.status, 'ask');
});
