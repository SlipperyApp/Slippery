/* Results-feed adapter tests.
 *
 * The engine is only as safe as what it is fed. football-data.org reports
 * `fullTime` INCLUDING extra time on knockout ties, so a naive adapter would
 * hand the grader a 3-2 AET score and it would happily settle "Over 2.5, 90
 * minutes only" as a win on a game that finished 1-1. These tests exist to
 * make that specific mistake impossible to reintroduce.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { matchFixture } from '../api/_lib/fixtures.js';
import { normalise } from '../api/_lib/footballdata.js';
import { settle } from '../src/js/settlement.js';

const match = (over = {}) => ({
  id: 4242,
  utcDate: '2026-08-09T19:00:00Z',
  status: 'FINISHED',
  homeTeam: { name: 'Arsenal FC', shortName: 'Arsenal' },
  awayTeam: { name: 'Chelsea FC', shortName: 'Chelsea' },
  score: { duration: 'REGULAR', fullTime: { home: 2, away: 1 }, halfTime: { home: 1, away: 0 } },
  ...over
});

test('a normal finished match maps to FT with both scores', () => {
  const fx = normalise(match());
  assert.equal(fx.status, 'FT');
  assert.equal(fx.hg, 2);
  assert.equal(fx.ag, 1);
  assert.equal(fx.hth, 1);
  assert.equal(fx.hta, 0);
  assert.equal(fx.home, 'Arsenal');
});

test('a tie decided in extra time is marked AET, NOT FT', () => {
  const fx = normalise(match({
    score: {
      duration: 'EXTRA_TIME',
      fullTime: { home: 3, away: 2 },      // includes extra time
      halfTime: { home: 0, away: 1 },
      extraTime: { home: 1, away: 0 }
    }
  }));
  assert.equal(fx.status, 'AET');
});

test('an AET fixture with no provable 90-minute score makes the engine ASK', () => {
  /* This is the whole point. The feed says 3-2; the 90-minute score is
     unknown. Settling "Over 2.5, 90 mins" on 3-2 would be a wrong grade. */
  const fx = normalise(match({
    score: { duration: 'EXTRA_TIME', fullTime: { home: 3, away: 2 }, halfTime: { home: 0, away: 1 } }
  }));
  assert.equal(fx.ft90h, undefined);
  assert.equal(fx.ft90a, undefined);

  const out = settle({ selection: 'Over 2.5', stakePence: 10000, odds: 1.9, book: 'bet365' }, fx);
  assert.equal(out.status, 'ask');
  assert.match(out.reason, /extra time/i);
});

test('an AET fixture WITH a regular-time score settles on the 90-minute score', () => {
  const fx = normalise(match({
    score: {
      duration: 'PENALTY_SHOOTOUT',
      fullTime: { home: 3, away: 2 },
      regularTime: { home: 1, away: 1 },   // paid tiers supply this
      halfTime: { home: 0, away: 1 },
      penalties: { home: 4, away: 2 }
    }
  }));
  assert.equal(fx.ft90h, 1);
  assert.equal(fx.ft90a, 1);

  const out = settle({ selection: 'Over 2.5', stakePence: 10000, odds: 1.9, book: 'bet365' }, fx);
  assert.equal(out.status, 'settled');
  assert.equal(out.outcome, 'lost', '1-1 at 90 minutes loses Over 2.5, despite the 3-2 AET score');
});

test('a penalty shootout counts as extra time', () => {
  const fx = normalise(match({
    score: { duration: 'PENALTY_SHOOTOUT', fullTime: { home: 1, away: 1 },
             halfTime: { home: 0, away: 0 }, penalties: { home: 5, away: 3 } }
  }));
  assert.equal(fx.status, 'AET');
});

test('postponed and cancelled map to the void statuses the engine expects', () => {
  const post = normalise(match({ status: 'POSTPONED', score: { fullTime: {}, halfTime: {} } }));
  assert.equal(post.status, 'POSTPONED');
  assert.equal(settle({ selection: 'Over 2.5', stakePence: 10000, odds: 1.9 }, post).outcome, 'void');

  const canc = normalise(match({ status: 'CANCELLED', score: { fullTime: {}, halfTime: {} } }));
  assert.equal(settle({ selection: 'Over 2.5', stakePence: 10000, odds: 1.9 }, canc).outcome, 'void');
});

test('a suspended match asks rather than settling', () => {
  const fx = normalise(match({ status: 'SUSPENDED' }));
  assert.equal(settle({ selection: 'Over 2.5', stakePence: 10000, odds: 1.9 }, fx).status, 'ask');
});

test('an unstarted match is pending, never settled', () => {
  const fx = normalise(match({ status: 'TIMED', score: { fullTime: {}, halfTime: {} } }));
  assert.equal(settle({ selection: 'Over 2.5', stakePence: 10000, odds: 1.9 }, fx).status, 'pending');
});

test('a match with no score at all does not produce phantom zeros', () => {
  const fx = normalise(match({ status: 'TIMED', score: { fullTime: {}, halfTime: {} } }));
  assert.equal(fx.hg, undefined, 'a missing score must not become 0-0');
  assert.equal(fx.ag, undefined);
});

/* ---------------- fixture matching ---------------- */
const fixtures = [
  { id: '1', home: 'Arsenal', away: 'Chelsea', status: 'FT', hg: 2, ag: 1 },
  { id: '2', home: 'Molde', away: 'Bodø/Glimt', status: 'FT', hg: 2, ag: 1 },
  { id: '3', home: 'Brighton', away: 'Everton', status: 'FT', hg: 1, ag: 2 }
];

test('matches a bet to its fixture on both team names', () => {
  assert.equal(matchFixture('Arsenal v Chelsea', fixtures).id, '1');
  assert.equal(matchFixture('Molde v Bodø/Glimt', fixtures).id, '2');
});

test('matching survives club suffixes and punctuation on the slip', () => {
  assert.equal(matchFixture('Arsenal FC vs Chelsea F.C.', fixtures).id, '1');
  assert.equal(matchFixture('MOLDE  -  BODO/GLIMT', fixtures).id, '2');
});

test('refuses to match when only one team is present', () => {
  assert.equal(matchFixture('Arsenal to win', fixtures), null,
    'one team is not enough, settling against the wrong game is unrecoverable');
});

test('refuses to match an unrelated event', () => {
  assert.equal(matchFixture('Vaasa v Honka', fixtures), null);
  assert.equal(matchFixture('Fivefold acca', fixtures), null);
  assert.equal(matchFixture('', fixtures), null);
});

test('refuses to match when more than one fixture could be meant', () => {
  const ambiguous = [
    { id: 'a', home: 'Arsenal', away: 'Chelsea' },
    { id: 'b', home: 'Arsenal', away: 'Chelsea' }
  ];
  assert.equal(matchFixture('Arsenal v Chelsea', ambiguous), null,
    'an ambiguous match must stay pending rather than pick one');
});

/* ---------------- name folding ----------------
   Scandinavian clubs are most of this product's fixture list, and their
   names are the ones ASCII slips mangle. */
test('folds the letters NFD leaves alone, so ASCII slips still match', async () => {
  const { foldName } = await import('../api/_lib/fixtures.js');
  assert.equal(foldName('Bodø/Glimt'), 'bodoglimt');
  assert.equal(foldName('BODO GLIMT'), 'bodoglimt');
  assert.equal(foldName('Vålerenga'), 'valerenga');
  assert.equal(foldName('Tromsø'), 'tromso');
  assert.equal(foldName('Malmö FF'), 'malmo');
  assert.equal(foldName('Djurgården'), 'djurgarden');
  assert.equal(foldName('Lillestrøm'), 'lillestrom');
  assert.equal(foldName('Sarpsborg 08'), 'sarpsborg08');
});

test('a Norwegian fixture matches an ASCII slip end to end', () => {
  const nordic = [{ id: 'n1', home: 'Bodø/Glimt', away: 'Tromsø', status: 'FT', hg: 3, ag: 1 }];
  assert.equal(matchFixture('BODO GLIMT v TROMSO', nordic).id, 'n1');
  assert.equal(matchFixture('Bodø/Glimt v Tromsø', nordic).id, 'n1');
});
