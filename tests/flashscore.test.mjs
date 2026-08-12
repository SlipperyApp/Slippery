/* The FlashScore feed adapter.
 *
 * The thing worth testing here is not the parsing, it is the refusal. This
 * feed gives a final score and a half-time score, and neither proves a match
 * did not go to extra time. Whether a fixture claims to be a 90-minute
 * result decides whether a knockout tie gets settled on a 120-minute score,
 * which is the failure the whole engine is built to avoid.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseFeed, toFootball, toTennis, isLeague, dayOffset } from '../api/_lib/flashscore.js';
import { settle } from '../src/js/settlement.js';

const SEP = '¬';
const KV = '÷';
const feed = blocks => blocks.map(b =>
  Object.entries(b).map(([k, v]) => k + KV + v).join(SEP)).join('~');

test('a competition heading carries to the events under it', () => {
  const text = '~' + feed([
    { ZA: 'ENGLAND: Premier League', AA: 'x1', AB: 3, AC: 3, AE: 'Arsenal', AF: 'Chelsea', AG: 2, AH: 1 },
    { AA: 'x2', AB: 3, AC: 3, AE: 'Spurs', AF: 'Fulham', AG: 1, AH: 1 }
  ]);
  const records = parseFeed(text);
  assert.equal(records.length, 2);
  assert.equal(records[0].competition, 'ENGLAND: Premier League');
  assert.equal(records[1].competition, 'ENGLAND: Premier League',
    'the second event is in the same competition and has no heading of its own');
});

test('league football claims 90 minutes; a cup tie does not', () => {
  assert.equal(isLeague('ENGLAND: Premier League'), true);
  assert.equal(isLeague('SWEDEN: Allsvenskan'), true);
  for (const cup of [
    'ENGLAND: FA Cup', 'EUROPE: Champions League - Play Offs',
    'SPAIN: Copa del Rey', 'GERMANY: DFB Pokal',
    'WORLD: Friendly International', 'ENGLAND: Championship - Play Offs',
    'EUROPE: Euro Qualification'
  ]) {
    assert.equal(isLeague(cup), false, 'must not claim 90 minutes: ' + cup);
  }
});

test('a league result carries a provable 90-minute score', () => {
  const [rec] = parseFeed('~' + feed([
    { ZA: 'ENGLAND: Premier League', AA: 'x1', AB: 3, AC: 3,
      AE: 'Arsenal', AF: 'Chelsea', AG: 2, AH: 1, BC: 1, BD: 0, AD: 1786554000 }
  ]));
  const fx = toFootball(rec);
  assert.equal(fx.status, 'FT');
  assert.equal(fx.ft90h, 2);
  assert.equal(fx.ft90a, 1);
  assert.equal(fx.hth, 1);
  assert.equal(fx.hta, 0);
  const out = settle({ selection: 'Over 2.5', stakePence: 10000, odds: 1.9, book: 'bet365' }, fx);
  assert.equal(out.status, 'settled');
});

test('A CUP TIE IS NEVER SETTLED, because the feed cannot prove 90 minutes', () => {
  const [rec] = parseFeed('~' + feed([
    { ZA: 'ENGLAND: FA Cup', AA: 'x9', AB: 3, AC: 3,
      AE: 'Arsenal', AF: 'Chelsea', AG: 2, AH: 1 }
  ]));
  const fx = toFootball(rec);
  assert.equal(fx.status, 'FINISHED_UNKNOWN');
  assert.equal(fx.ft90h, undefined, 'no 90-minute claim on a tie that could have gone to extra time');
  const out = settle({ selection: 'Over 2.5', stakePence: 10000, odds: 1.9, book: 'bet365' }, fx);
  assert.notEqual(out.status, 'settled');
});

test('an undocumented finished sub-code asks rather than settling', () => {
  /* AC 9, 11 and 54 all appear on finished matches and none is documented.
     One of them is very likely "after extra time". */
  for (const ac of [9, 11, 54]) {
    const [rec] = parseFeed('~' + feed([
      { ZA: 'ENGLAND: Premier League', AA: 'x' + ac, AB: 3, AC: ac,
        AE: 'Arsenal', AF: 'Chelsea', AG: 2, AH: 1 }
    ]));
    const fx = toFootball(rec);
    assert.equal(fx.status, 'FINISHED_UNKNOWN', 'AC=' + ac + ' must not read as a clean finish');
    assert.notEqual(settle({ selection: 'Over 2.5', stakePence: 10000, odds: 1.9 }, fx).status, 'settled');
  }
});

test('postponed and cancelled come through as themselves, so they void', () => {
  const text = '~' + feed([
    { ZA: 'ENGLAND: Premier League', AA: 'p1', AB: 3, AC: 4, AE: 'Arsenal', AF: 'Chelsea' },
    { AA: 'c1', AB: 3, AC: 5, AE: 'Spurs', AF: 'Fulham' }
  ]);
  const [a, b] = parseFeed(text).map(toFootball);
  assert.equal(a.status, 'POSTPONED');
  assert.equal(b.status, 'CANCELLED');
  const out = settle({ selection: 'Over 2.5', stakePence: 10000, odds: 1.9 }, a);
  assert.equal(out.outcome, 'void');
  assert.equal(out.profit, 0);
});

test('a fixture that has not finished is skipped rather than settled 0-0', () => {
  const text = '~' + feed([
    { ZA: 'ENGLAND: Premier League', AA: 's1', AB: 1, AC: 1, AE: 'Arsenal', AF: 'Chelsea' },
    { AA: 'l1', AB: 2, AC: 13, AE: 'Spurs', AF: 'Fulham', AG: 1, AH: 0 }
  ]);
  assert.deepEqual(parseFeed(text).map(toFootball), [null, null]);
});

test('tennis comes back with its sets, in order', () => {
  const [rec] = parseFeed('~' + feed([
    { ZA: 'ATP - SINGLES: Montreal (Canada), hard', AA: 't1', AB: 3, AC: 3,
      AE: 'Alcaraz C.', AF: 'Sinner J.', AG: 2, AH: 1,
      BA: 6, BB: 4, BC: 3, BD: 6, BE: 7, BF: 5 }
  ]));
  const fx = toTennis(rec);
  assert.equal(fx.sport, 'tennis');
  assert.equal(fx.status, 'FT');
  assert.deepEqual(fx.sets, [[6, 4], [3, 6], [7, 5]]);
  const out = settle({ selection: 'Over 30.5 games', stakePence: 10000, odds: 1.9 }, fx);
  assert.equal(out.status, 'settled');
  assert.equal(out.outcome, 'won');
});

test('a tennis set that stops part way through does not extend the list', () => {
  /* Sets are read until one is missing. A gap would otherwise let set four
     be read as set three and the games land in the wrong set. */
  const [rec] = parseFeed('~' + feed([
    { ZA: 'ATP', AA: 't2', AB: 3, AC: 3, AE: 'A B.', AF: 'C D.', AG: 2, AH: 0,
      BA: 6, BB: 4, BC: 6, BD: 3, BG: 6, BH: 0 }
  ]));
  assert.deepEqual(toTennis(rec).sets, [[6, 4], [6, 3]]);
});

test('a retired tennis match never settles', () => {
  const [rec] = parseFeed('~' + feed([
    { ZA: 'ATP', AA: 't3', AB: 3, AC: 40, AE: 'A B.', AF: 'C D.', AG: 2, AH: 0, BA: 6, BB: 4, BC: 3, BD: 1 }
  ]));
  const fx = toTennis(rec);
  assert.equal(fx.status, 'FINISHED_UNKNOWN');
  assert.notEqual(settle({ selection: 'A B.', stakePence: 10000, odds: 1.9 }, fx).status, 'settled');
});

test('the feed is addressed in days from today', () => {
  const today = new Date('2026-08-12T09:00:00Z');
  assert.equal(dayOffset(new Date('2026-08-12T23:00:00Z'), today), 0);
  assert.equal(dayOffset(new Date('2026-08-11T00:00:00Z'), today), -1);
  assert.equal(dayOffset(new Date('2026-08-15T00:00:00Z'), today), 3);
});

test('junk in gives nothing out rather than throwing', () => {
  assert.deepEqual(parseFeed(''), []);
  assert.deepEqual(parseFeed('nothing useful'), []);
  assert.equal(toFootball({ competition: '', fields: {} }), null);
});
