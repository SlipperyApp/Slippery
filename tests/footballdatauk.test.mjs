/* football-data.co.uk parsing.
 *
 * This is the source that answers when the others are blocked, so its
 * mapping is the one carrying settlement in production. Two things it must
 * get right: day-first dates, because reading 03/04 as March would settle
 * bets against the wrong day; and the claim that full time equals 90
 * minutes, which holds only because these files are league fixtures and
 * league football has no extra time.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseFile, parseDate, seasonCode } from '../api/_lib/footballdatauk.js';
import { settle } from '../src/js/settlement.js';

const from = new Date('2026-08-01T00:00:00Z');
const to = new Date('2026-08-31T23:59:59Z');

/* The main European format, with half-time columns. */
const MAIN = [
  'Div,Date,Time,HomeTeam,AwayTeam,FTHG,FTAG,FTR,HTHG,HTAG,HTR,Referee',
  'E0,09/08/2026,15:00,Arsenal,Chelsea,2,1,H,1,0,H,A Taylor',
  'E0,10/08/2026,17:30,Brighton,Everton,1,2,A,0,1,A,M Oliver'
].join('\n');

/* The new format: one file per country, no half-time columns. */
const NEW = [
  'Country,League,Season,Date,Time,Home,Away,HG,AG,Res',
  'Sweden,Allsvenskan,2026,10/08/2026,18:00,Sirius,Brommapojkarna,2,2,D',
  'Sweden,Allsvenskan,2026,10/08/2026,18:00,Vasteras SK,Djurgarden,1,0,H'
].join('\n');

test('dates are read day-first, as the site writes them', () => {
  /* 03/04/2026 is 3 April. Month-first would move it to 4 March and settle
     the bet against a different day's game. */
  assert.equal(parseDate('03/04/2026').toISOString().slice(0, 10), '2026-04-03');
  assert.equal(parseDate('3/4/26').toISOString().slice(0, 10), '2026-04-03');
  assert.equal(parseDate('31/12/2026').toISOString().slice(0, 10), '2026-12-31');
  assert.equal(parseDate(''), null);
  assert.equal(parseDate('not a date'), null);
});

test('the season code follows the August-to-May year', () => {
  assert.equal(seasonCode(new Date('2026-08-11T00:00:00Z')), '2627');
  assert.equal(seasonCode(new Date('2026-05-24T00:00:00Z')), '2526', 'May is still last season');
  assert.equal(seasonCode(new Date('2026-01-02T00:00:00Z')), '2526');
});

test('the main format yields full time and half time', () => {
  const fx = parseFile(MAIN, from, to, 'E0');
  assert.equal(fx.length, 2);
  assert.equal(fx[0].home, 'Arsenal');
  assert.equal(fx[0].hg, 2); assert.equal(fx[0].ag, 1);
  assert.equal(fx[0].hth, 1); assert.equal(fx[0].hta, 0);
  assert.equal(fx[0].status, 'FT');
});

test('full time IS the 90-minute score, because leagues have no extra time', () => {
  const fx = parseFile(MAIN, from, to, 'E0')[0];
  assert.equal(fx.ft90h, 2);
  assert.equal(fx.ft90a, 1);
  const out = settle({ selection: 'Over 2.5', stakePence: 10000, odds: 1.9, book: 'bet365' }, fx);
  assert.equal(out.status, 'settled', 'a league result must grade without asking');
  assert.equal(out.outcome, 'won');
});

test('the new format parses despite different column names and no half time', () => {
  const fx = parseFile(NEW, from, to, 'SWE');
  assert.equal(fx.length, 2);
  assert.equal(fx[0].home, 'Sirius');
  assert.equal(fx[0].away, 'Brommapojkarna');
  assert.equal(fx[0].hg, 2); assert.equal(fx[0].ag, 2);
  assert.equal(fx[0].hth, undefined, 'no half-time columns in this format');
  assert.equal(fx[0].ft90h, 2, 'but the 90-minute score is still known');
});

test('rows outside the window are ignored', () => {
  const fx = parseFile(MAIN, new Date('2026-08-10T00:00:00Z'), to, 'E0');
  assert.equal(fx.length, 1);
  assert.equal(fx[0].home, 'Brighton');
});

test('an unplayed fixture is skipped rather than settled 0-0', () => {
  const csv = [
    'Div,Date,Time,HomeTeam,AwayTeam,FTHG,FTAG,FTR,HTHG,HTAG,HTR',
    'E0,09/08/2026,15:00,Arsenal,Chelsea,,,,,,',
    'E0,09/08/2026,15:00,Spurs,Fulham,1,1,D,0,0,D'
  ].join('\n');
  const fx = parseFile(csv, from, to, 'E0');
  assert.equal(fx.length, 1, 'the blank row must not become a 0-0');
  assert.equal(fx[0].home, 'Spurs');
});

test('junk in gives nothing out rather than throwing', () => {
  assert.deepEqual(parseFile('', from, to, 'E0'), []);
  assert.deepEqual(parseFile('nothing useful here', from, to, 'E0'), []);
  assert.deepEqual(parseFile('A,B,C\n1,2,3', from, to, 'E0'), [],
    'a file without the columns we need yields nothing');
});

test('each fixture carries a stable, distinct id', () => {
  const fx = parseFile(MAIN, from, to, 'E0');
  assert.notEqual(fx[0].id, fx[1].id);
  assert.equal(fx[0].id, parseFile(MAIN, from, to, 'E0')[0].id, 'ids must not shift between reads');
});

test('a Nordic fixture matches an ASCII slip end to end', async () => {
  /* The site writes Vasteras and Djurgarden without their diacritics while
     a slip may carry either. Both must reach the same fixture. */
  const { matchFixture } = await import('../api/_lib/fixtures.js');
  const fx = parseFile(NEW, from, to, 'SWE');
  assert.equal(matchFixture('Vasteras SK v Djurgarden', fx).home, 'Vasteras SK');
  assert.equal(matchFixture('Västerås SK v Djurgården', fx).home, 'Vasteras SK');
});
