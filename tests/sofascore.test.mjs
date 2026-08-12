/* SofaScore provider tests.
 *
 * The live endpoint refuses datacenter IPs, so these run against recorded
 * payload shapes rather than the network. That is the right trade: what can
 * actually go wrong here is the MAPPING, feeding the grader a score that
 * includes extra time, or settling against the wrong game, and a mapping
 * bug is fully reproducible offline. Reachability is a deploy-time concern
 * and is handled by the fallback in fixtures.js.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalise, findExact } from '../api/_lib/sofascore.js';
import { settle } from '../src/js/settlement.js';

const ev = (over = {}) => ({
  id: 11223344,
  startTimestamp: 1786000000,
  homeTeam: { name: 'Arsenal FC', shortName: 'Arsenal' },
  awayTeam: { name: 'Chelsea FC', shortName: 'Chelsea' },
  status: { code: 100, type: 'finished', description: 'Ended' },
  homeScore: { current: 2, display: 2, period1: 1, period2: 1 },
  awayScore: { current: 1, display: 1, period1: 0, period2: 1 },
  ...over
});

test('a match that ended in normal time maps to FT with a provable 90-minute score', () => {
  const fx = normalise(ev());
  assert.equal(fx.status, 'FT');
  assert.equal(fx.hg, 2); assert.equal(fx.ag, 1);
  assert.equal(fx.hth, 1); assert.equal(fx.hta, 0);
  assert.equal(fx.ft90h, 2); assert.equal(fx.ft90a, 1);
  assert.equal(fx.home, 'Arsenal');
});

test('extra time is marked AET and settles on normaltime, NOT the headline score', () => {
  /* This is the entire reason for moving off football-data.org's free tier.
     The tie finished 3-2 after extra time but was 1-1 at 90 minutes, and
     the brief settles on 90 minutes only. */
  const fx = normalise(ev({
    status: { code: 110, type: 'finished', description: 'AET' },
    homeScore: { current: 3, period1: 0, period2: 1, normaltime: 1, extra1: 2 },
    awayScore: { current: 2, period1: 1, period2: 0, normaltime: 1, extra1: 1 }
  }));
  assert.equal(fx.status, 'AET');
  assert.equal(fx.hg, 3, 'the headline score is still recorded');
  assert.equal(fx.ft90h, 1, 'but 90-minute settlement uses normaltime');
  assert.equal(fx.ft90a, 1);

  const out = settle({ selection: 'Over 2.5', stakePence: 10000, odds: 1.9, book: 'bet365' }, fx);
  assert.equal(out.status, 'settled');
  assert.equal(out.outcome, 'lost', '1-1 at 90 loses Over 2.5, despite finishing 3-2');
});

test('a penalty shootout is AET and still settles on the 90-minute score', () => {
  const fx = normalise(ev({
    status: { code: 120, type: 'finished', description: 'AP' },
    homeScore: { current: 1, period1: 0, period2: 1, normaltime: 1, penalties: 5 },
    awayScore: { current: 1, period1: 1, period2: 0, normaltime: 1, penalties: 3 }
  }));
  assert.equal(fx.status, 'AET');
  assert.equal(fx.ft90h, 1); assert.equal(fx.ft90a, 1);
  assert.equal(settle({ selection: 'Under 2.5', stakePence: 10000, odds: 1.8 }, fx).outcome, 'won');
});

test('both halves are an equally provable 90 minutes when normaltime is missing', () => {
  const fx = normalise(ev({
    status: { code: 110, type: 'finished' },
    homeScore: { current: 4, period1: 1, period2: 1, extra1: 2 },
    awayScore: { current: 2, period1: 0, period2: 2, extra1: 0 }
  }));
  assert.equal(fx.ft90h, 2); assert.equal(fx.ft90a, 2);
});

test('AET with no period detail at all makes the engine ASK rather than guess', () => {
  const fx = normalise(ev({
    status: { code: 110, type: 'finished' },
    homeScore: { current: 3 }, awayScore: { current: 2 }
  }));
  assert.equal(fx.ft90h, undefined, 'no provable 90-minute score must stay undefined');
  const out = settle({ selection: 'Over 2.5', stakePence: 10000, odds: 1.9 }, fx);
  assert.equal(out.status, 'ask');
  assert.match(out.reason, /extra time/i);
});

test('postponed and cancelled void, abandoned asks, in-progress stays pending', () => {
  const bet = { selection: 'Over 2.5', stakePence: 10000, odds: 1.9 };
  const st = (code, type) => normalise(ev({ status: { code, type },
    homeScore: {}, awayScore: {} }));
  assert.equal(settle(bet, st(60, 'postponed')).outcome, 'void');
  assert.equal(settle(bet, st(70, 'canceled')).outcome, 'void');
  assert.equal(settle(bet, st(90, 'finished')).status, 'ask', 'bookmakers differ on abandoned');
  assert.equal(settle(bet, st(0, 'notstarted')).status, 'pending');
  assert.equal(settle(bet, st(7, 'inprogress')).status, 'pending');
});

test('an unrecognised status code never settles', () => {
  /* SofaScore adds codes over time. A new one must not be read as "ended". */
  const fx = normalise(ev({ status: { code: 987, type: 'something-new' },
    homeScore: { current: 2 }, awayScore: { current: 1 } }));
  assert.equal(fx.status, 'UNKNOWN');
  assert.notEqual(settle({ selection: 'Over 2.5', stakePence: 10000, odds: 1.9 }, fx).status, 'settled');
});

test('a scoreless unstarted match does not produce phantom zeros', () => {
  const fx = normalise(ev({ status: { code: 0, type: 'notstarted' }, homeScore: {}, awayScore: {} }));
  assert.equal(fx.hg, undefined);
  assert.equal(fx.ft90h, undefined);
});

test('junk in gives null out rather than a half-built fixture', () => {
  assert.equal(normalise(null), null);
  assert.equal(normalise({}), null);
  assert.equal(normalise({ homeTeam: { name: 'A' } }), null);
});

/* ---------------- exact matching ---------------- */
const fixtures = [
  { id: '1', home: 'Arsenal', away: 'Chelsea', status: 'FT' },
  { id: '2', home: 'Bodø/Glimt', away: 'Tromsø', status: 'FT' },
  { id: '3', home: 'Brighton', away: 'Everton', status: 'FT' }
];

test('finds the exact fixture, including through ASCII-mangled Nordic names', () => {
  assert.equal(findExact('Arsenal v Chelsea', fixtures).id, '1');
  assert.equal(findExact('BODO GLIMT vs TROMSO', fixtures).id, '2');
  assert.equal(findExact('Arsenal FC - Chelsea F.C.', fixtures).id, '1');
});

test('refuses anything short of an exact, unambiguous match', () => {
  assert.equal(findExact('Arsenal to win', fixtures), null, 'one team is not a match');
  assert.equal(findExact('Vaasa v Honka', fixtures), null);
  assert.equal(findExact('Fivefold acca', fixtures), null);
  assert.equal(findExact('', fixtures), null);
  assert.equal(findExact('Arsenal v Chelsea', [
    { id: 'a', home: 'Arsenal', away: 'Chelsea' },
    { id: 'b', home: 'Arsenal', away: 'Chelsea' }
  ]), null, 'two candidates must stay pending, not pick one');
});
