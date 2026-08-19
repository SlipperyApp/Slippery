/* CSV import tests.
 *
 * Everyone arriving with a history arrives with a spreadsheet, and no two
 * exports agree on anything: the delimiter, the column names, where the
 * minus sign goes, or which way round the date is. Each test here is a file
 * shape that exists in the wild, and the invariant across all of them is
 * the settlement rule applied to imports: a wrong figure is worse than no
 * figure, so a row that cannot be read is reported with its line number
 * rather than imported as a zero.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseBetsCsv, parseDelimited, sniffDelimiter, toPence, toOdds, toDate, toOutcome, mapHeaders
} from '../lib/settlement/csv.js';

/* ---------------- money ---------------- */
test('money becomes integer pence, in every format a spreadsheet emits', () => {
  assert.equal(toPence('12.50'), 1250);
  assert.equal(toPence('£1,234.56'), 123456);
  assert.equal(toPence('  £10 '), 1000);
  assert.equal(toPence('-25.00'), -2500);
  assert.equal(toPence('−25.00'), -2500, 'a real minus sign, which Excel and Numbers both write');
  assert.equal(toPence('(25.00)'), -2500, 'accountancy negatives');
  assert.equal(toPence('1.234,56'), 123456, 'European decimal comma');
  assert.equal(toPence('1,50'), 150, 'a bare comma is a decimal point, not thousands');
  assert.equal(toPence('2,500'), 250000, 'but a thousands group is not');
  assert.equal(toPence('0'), 0);
});

test('unreadable money is null, never zero', () => {
  /* Zero is a real stake-less bet and a real break-even profit. Coercing
     junk to zero would make both indistinguishable from a parse failure. */
  for (const bad of ['', '   ', '-', '—', 'n/a', 'pending', 'abc', null, undefined, '..']) {
    assert.equal(toPence(bad), null, JSON.stringify(bad) + ' should not parse');
  }
});

/* ---------------- odds ---------------- */
test('odds accept decimal, fractional and evens', () => {
  assert.equal(toOdds('3.50'), 3.5);
  assert.equal(toOdds('5/2'), 3.5);
  assert.equal(toOdds('1/2'), 1.5);
  assert.equal(toOdds('evens'), 2);
  assert.equal(toOdds('EVS'), 2);
});

test('odds that cannot win money are refused', () => {
  assert.equal(toOdds('1.00'), null, 'decimal odds of 1 return the stake and nothing else');
  assert.equal(toOdds('0.4'), null);
  assert.equal(toOdds(''), null);
  assert.equal(toOdds('n/a'), null);
  assert.equal(toOdds('5/0'), null, 'division by zero must not become Infinity');
});

/* ---------------- dates ---------------- */
test('ambiguous dates are read day-first, because this is a UK product', () => {
  /* 03/04/2026 is 3 April here and 4 March in an American export. Guessing
     American would silently move a third of every import by months. */
  assert.equal(toDate('03/04/2026').slice(0, 10), '2026-04-03');
  assert.equal(toDate('3-4-26').slice(0, 10), '2026-04-03');
  assert.equal(toDate('2026-04-03').slice(0, 10), '2026-04-03');
  assert.equal(toDate('2026-04-03T19:45:00Z').slice(0, 10), '2026-04-03');
});

test('an unreadable date is null, so the bet keeps the time it was logged', () => {
  assert.equal(toDate(''), null);
  assert.equal(toDate('last Tuesday'), null);
  assert.equal(toDate(null), null);
});

/* ---------------- outcomes ---------------- */
test('an explicit result column is read, and anything unclear stays null', () => {
  assert.equal(toOutcome('Won'), 'won');
  assert.equal(toOutcome('W'), 'won');
  assert.equal(toOutcome('LOST'), 'lost');
  assert.equal(toOutcome('Void'), 'void');
  assert.equal(toOutcome('Push'), 'void');
  assert.equal(toOutcome('Cashed out'), 'cash');
  assert.equal(toOutcome('Pending'), null, 'an unsettled bet must not be graded on import');
  assert.equal(toOutcome('half won'), null, 'a quarter-line split has no single treatment');
});

/* ---------------- the parser itself ---------------- */
test('quoted fields, embedded commas and doubled quotes survive', () => {
  const rows = parseDelimited('a,b\n"Arsenal, London","He said ""go"""\n', ',');
  assert.deepEqual(rows[1], ['Arsenal, London', 'He said "go"']);
});

test('CRLF and a UTF-8 BOM survive, because Excel writes both', () => {
  const rows = parseDelimited('﻿a,b\r\n1,2\r\n', ',');
  assert.deepEqual(rows[0], ['a', 'b']);
  assert.deepEqual(rows[1], ['1', '2']);
});

test('the delimiter is sniffed, not assumed', () => {
  assert.equal(sniffDelimiter('a,b,c\n1,2,3'), ',');
  assert.equal(sniffDelimiter('a;b;c\n1;2;3'), ';');
  assert.equal(sniffDelimiter('a\tb\tc'), '\t');
  assert.equal(sniffDelimiter('"Arsenal, London";10'), ';',
    'a comma inside a quoted field is not a delimiter');
});

/* ---------------- header mapping ---------------- */
test('headers map from the names real exports use', () => {
  const m = mapHeaders(['Date Placed', 'Match', 'Your Bet', 'Bookmaker', 'Price', 'Stake', 'P/L']);
  assert.equal(m.date, 0);
  assert.equal(m.event, 1);
  assert.equal(m.selection, 2);
  assert.equal(m.book, 3);
  assert.equal(m.odds, 4);
  assert.equal(m.stake, 5);
  assert.equal(m.profit, 6);
});

/* ---------------- end to end ---------------- */
test('a normal export imports cleanly, with profit in pence', () => {
  const csv = [
    'Date,Event,Selection,Bookmaker,Odds,Stake,Profit',
    '09/08/2026,Arsenal v Chelsea,Over 2.5 Goals,bet365,1.85,20.00,17.00',
    '08/08/2026,Molde v Bodø/Glimt,Molde -1,Paddy Power,2.10,12.00,-12.00'
  ].join('\n');
  const { bets, errors } = parseBetsCsv(csv);
  assert.equal(errors.length, 0);
  assert.equal(bets.length, 2);
  assert.equal(bets[0].stakePence, 2000);
  assert.equal(bets[0].profitPence, 1700);
  assert.equal(bets[0].odds, 1.85);
  assert.equal(bets[0].outcome, 'won');
  assert.equal(bets[1].outcome, 'lost');
  assert.equal(bets[1].event, 'Molde v Bodø/Glimt', 'non-ASCII names survive intact');
});

test('profit is derived from returns when there is no profit column', () => {
  const csv = 'Event,Selection,Stake,Returns\nA v B,Over 2.5,10.00,18.50';
  const { bets } = parseBetsCsv(csv);
  assert.equal(bets[0].profitPence, 850, 'returns minus stake, which is the definition');
});

test('a row without a usable stake is reported by line, not imported as zero', () => {
  const csv = [
    'Date,Event,Selection,Stake,Profit',
    '09/08/2026,A v B,Over 2.5,20.00,17.00',
    '09/08/2026,C v D,Under 1.5,,'
  ].join('\n');
  const { bets, errors } = parseBetsCsv(csv);
  assert.equal(bets.length, 1);
  assert.equal(errors.length, 1);
  assert.equal(errors[0].line, 3, 'the line number is what makes it fixable');
});

test('a file with no stake column imports nothing and says why', () => {
  const csv = 'Date,Event,Notes\n09/08/2026,A v B,went well';
  const { bets, errors } = parseBetsCsv(csv);
  assert.equal(bets.length, 0);
  assert.match(errors[0].why, /stake/i);
  assert.match(errors[0].why, /Date, Event, Notes/, 'shows what it did see, so it can be fixed');
});

test('an unsettled row imports as unsettled rather than as a zero-profit win', () => {
  const csv = 'Event,Selection,Stake,Odds,Status,Profit\nA v B,Over 2.5,10.00,1.90,Pending,';
  const { bets } = parseBetsCsv(csv);
  assert.equal(bets[0].profitPence, null);
  assert.equal(bets[0].outcome, null);
});

test('a semicolon export with European decimals imports correctly', () => {
  const csv = 'Datum;Event;Selection;Stake;Profit\n09.08.2026;A v B;Over 2,5;10,00;7,50';
  const { bets, errors } = parseBetsCsv(csv);
  assert.equal(errors.length, 0);
  assert.equal(bets[0].stakePence, 1000);
  assert.equal(bets[0].profitPence, 750);
});

test('an empty file is refused rather than silently importing nothing', () => {
  for (const junk of ['', '   ', 'Date,Event,Stake']) {
    const { bets, errors } = parseBetsCsv(junk);
    assert.equal(bets.length, 0);
    assert.ok(errors.length > 0, JSON.stringify(junk) + ' should report a problem');
  }
});

test('every imported figure is whole pence, so nothing rounds later', () => {
  const csv = 'Event,Selection,Stake,Profit\nA v B,X,33.33,11.11\nC v D,Y,306.18,76.55';
  const { bets } = parseBetsCsv(csv);
  for (const b of bets) {
    assert.equal(Number.isInteger(b.stakePence), true);
    assert.equal(Number.isInteger(b.profitPence), true);
  }
  assert.equal(bets[1].stakePence, 30618);
  assert.equal(bets[1].profitPence, 7655);
});
