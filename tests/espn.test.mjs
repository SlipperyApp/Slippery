/* ESPN provider tests.
 *
 * ESPN leads the scraper chain for one reason: `linescores` carries the
 * score period by period, so the 90-minute score on an extra-time tie is
 * provable rather than inferred. These tests run against recorded payload
 * shapes, because what can go wrong is the mapping — handing the grader a
 * score that includes extra time — and that is fully reproducible offline.
 * Reachability is an IP-reputation question and is answered by /api/sources
 * from the host that actually matters.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalise } from '../api/_lib/espn.js';
import { settle } from '../src/js/settlement.js';

const ev = (over = {}) => ({
  id: '700123',
  date: '2026-08-09T19:00Z',
  competitions: [{
    status: { type: { name: 'STATUS_FULL_TIME', completed: true } },
    competitors: [
      { homeAway: 'home', team: { shortDisplayName: 'Arsenal', displayName: 'Arsenal' },
        score: '2', linescores: [{ value: 1 }, { value: 1 }] },
      { homeAway: 'away', team: { shortDisplayName: 'Chelsea', displayName: 'Chelsea' },
        score: '1', linescores: [{ value: 0 }, { value: 1 }] }
    ],
    ...(over.competition || {})
  }],
  ...over
});

test('a finished match maps to FT with a provable 90-minute score', () => {
  const fx = normalise(ev());
  assert.equal(fx.status, 'FT');
  assert.equal(fx.home, 'Arsenal');
  assert.equal(fx.hg, 2); assert.equal(fx.ag, 1);
  assert.equal(fx.hth, 1); assert.equal(fx.hta, 0);
  assert.equal(fx.ft90h, 2); assert.equal(fx.ft90a, 1);
});

test('extra time settles on the two halves, NOT the headline score', () => {
  /* Finished 3-2 after extra time, 1-1 at 90. The brief settles on 90
     minutes only, so Over 2.5 must lose. */
  const fx = normalise(ev({
    competition: {
      status: { type: { name: 'STATUS_FINAL_AET', completed: true } },
      competitors: [
        { homeAway: 'home', team: { shortDisplayName: 'Arsenal' }, score: '3',
          linescores: [{ value: 0 }, { value: 1 }, { value: 2 }, { value: 0 }] },
        { homeAway: 'away', team: { shortDisplayName: 'Chelsea' }, score: '2',
          linescores: [{ value: 1 }, { value: 0 }, { value: 1 }, { value: 0 }] }
      ]
    }
  }));
  assert.equal(fx.status, 'AET');
  assert.equal(fx.hg, 3, 'the headline score is still recorded');
  assert.equal(fx.ft90h, 1); assert.equal(fx.ft90a, 1);

  const out = settle({ selection: 'Over 2.5', stakePence: 10000, odds: 1.9, book: 'bet365' }, fx);
  assert.equal(out.status, 'settled');
  assert.equal(out.outcome, 'lost', '1-1 at 90 loses Over 2.5 despite finishing 3-2');
});

test('a penalty shootout is AET and settles on 90 minutes', () => {
  const fx = normalise(ev({
    competition: {
      status: { type: { name: 'STATUS_FINAL_PEN', completed: true } },
      competitors: [
        { homeAway: 'home', team: { shortDisplayName: 'Molde' }, score: '1',
          linescores: [{ value: 0 }, { value: 1 }, { value: 0 }, { value: 0 }, { value: 5 }] },
        { homeAway: 'away', team: { shortDisplayName: 'Bodø/Glimt' }, score: '1',
          linescores: [{ value: 1 }, { value: 0 }, { value: 0 }, { value: 0 }, { value: 3 }] }
      ]
    }
  }));
  assert.equal(fx.status, 'AET');
  assert.equal(fx.ft90h, 1); assert.equal(fx.ft90a, 1);
  assert.equal(settle({ selection: 'Under 2.5', stakePence: 10000, odds: 1.8 }, fx).outcome, 'won');
});

test('extra time with no period detail makes the engine ASK', () => {
  const fx = normalise(ev({
    competition: {
      status: { type: { name: 'STATUS_FINAL_AET', completed: true } },
      competitors: [
        { homeAway: 'home', team: { shortDisplayName: 'Arsenal' }, score: '3' },
        { homeAway: 'away', team: { shortDisplayName: 'Chelsea' }, score: '2' }
      ]
    }
  }));
  assert.equal(fx.ft90h, undefined, 'no provable 90-minute score must stay undefined');
  const out = settle({ selection: 'Over 2.5', stakePence: 10000, odds: 1.9 }, fx);
  assert.equal(out.status, 'ask');
  assert.match(out.reason, /extra time/i);
});

test('a finished match with no linescores still settles on full time', () => {
  /* Ended inside 90, so full time IS the 90-minute score. */
  const fx = normalise(ev({
    competition: {
      status: { type: { name: 'STATUS_FULL_TIME', completed: true } },
      competitors: [
        { homeAway: 'home', team: { shortDisplayName: 'Arsenal' }, score: '2' },
        { homeAway: 'away', team: { shortDisplayName: 'Chelsea' }, score: '1' }
      ]
    }
  }));
  assert.equal(fx.ft90h, 2); assert.equal(fx.ft90a, 1);
  assert.equal(settle({ selection: 'Over 2.5', stakePence: 10000, odds: 1.9 }, fx).outcome, 'won');
});

test('postponed and cancelled void, abandoned asks, scheduled stays pending', () => {
  const bet = { selection: 'Over 2.5', stakePence: 10000, odds: 1.9 };
  const withStatus = name => normalise(ev({
    competition: {
      status: { type: { name, completed: false } },
      competitors: [
        { homeAway: 'home', team: { shortDisplayName: 'Arsenal' } },
        { homeAway: 'away', team: { shortDisplayName: 'Chelsea' } }
      ]
    }
  }));
  assert.equal(settle(bet, withStatus('STATUS_POSTPONED')).outcome, 'void');
  assert.equal(settle(bet, withStatus('STATUS_CANCELED')).outcome, 'void');
  assert.equal(settle(bet, withStatus('STATUS_ABANDONED')).status, 'ask');
  assert.equal(settle(bet, withStatus('STATUS_SCHEDULED')).status, 'pending');
  assert.equal(settle(bet, withStatus('STATUS_IN_PROGRESS')).status, 'pending');
});

test('an unrecognised status never settles', () => {
  /* ESPN adds names over time. A new one must not be read as "ended". */
  const fx = normalise(ev({
    competition: {
      status: { type: { name: 'STATUS_SOMETHING_NEW', completed: false } },
      competitors: [
        { homeAway: 'home', team: { shortDisplayName: 'Arsenal' }, score: '2' },
        { homeAway: 'away', team: { shortDisplayName: 'Chelsea' }, score: '1' }
      ]
    }
  }));
  assert.equal(fx.status, 'UNKNOWN');
  assert.notEqual(settle({ selection: 'Over 2.5', stakePence: 10000, odds: 1.9 }, fx).status, 'settled');
});

test('a completed match whose name lags is still treated as finished', () => {
  const fx = normalise(ev({
    competition: {
      status: { type: { name: 'STATUS_SCHEDULED', completed: true } },
      competitors: [
        { homeAway: 'home', team: { shortDisplayName: 'Arsenal' }, score: '2' },
        { homeAway: 'away', team: { shortDisplayName: 'Chelsea' }, score: '1' }
      ]
    }
  }));
  assert.equal(fx.status, 'FT');
});

test('scores arrive as strings and become numbers', () => {
  const fx = normalise(ev());
  assert.equal(typeof fx.hg, 'number');
  assert.equal(typeof fx.ag, 'number');
});

test('junk in gives null out rather than a half-built fixture', () => {
  assert.equal(normalise(null), null);
  assert.equal(normalise({}), null);
  assert.equal(normalise({ competitions: [] }), null);
  assert.equal(normalise({ competitions: [{ competitors: [] }] }), null);
  /* One side missing is not a fixture. */
  assert.equal(normalise({ competitions: [{ competitors: [
    { homeAway: 'home', team: { shortDisplayName: 'Arsenal' } },
    { homeAway: 'home', team: { shortDisplayName: 'Spurs' } }
  ] }] }), null);
});

test('a match with no scores does not produce phantom zeros', () => {
  const fx = normalise(ev({
    competition: {
      status: { type: { name: 'STATUS_SCHEDULED', completed: false } },
      competitors: [
        { homeAway: 'home', team: { shortDisplayName: 'Arsenal' } },
        { homeAway: 'away', team: { shortDisplayName: 'Chelsea' } }
      ]
    }
  }));
  assert.equal(fx.hg, undefined);
  assert.equal(fx.ft90h, undefined);
});
