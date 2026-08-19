import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { BOT, PREFIXES, fieldTable, settledLine } from '../lib/server/bot-voice.ts';

/* Every string the bot can say, including the ones behind a function, probed
   with arguments of the shape each actually takes. */
const every = (): string[] => [
  ...Object.values(BOT).filter((v): v is string => typeof v === 'string'),
  BOT.linked('@tester123'),
  BOT.alreadyLinked('@tester123'),
  BOT.unreadable(['stake', 'odds']),
  BOT.trialOver('days'),
  BOT.trialOver('slips'),
  BOT.rateLimited(45),
];

test('the bot never exclaims and never greets', () => {
  for (const s of every()) {
    assert.doesNotMatch(s, /!/, 'exclamation mark in: ' + s);
    assert.doesNotMatch(s, /^(hi|hey|hello|welcome|great|awesome)/i, 'greeting in: ' + s);
  }
});

test('no em dashes anywhere in what it says', () => {
  const source = readFileSync(new URL('../lib/server/bot-voice.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /—/);
});

test('the scannable prefixes are the ones specified', () => {
  assert.deepEqual([...PREFIXES], ['READ', 'TRACKING', 'FT', 'UNREADABLE', 'DUPLICATE', 'PAUSED', 'LINKED']);
});

test('the trial message says which half ran out', () => {
  assert.match(BOT.trialOver('slips'), /slips/i);
  assert.match(BOT.trialOver('days'), /ended/i);
  assert.notEqual(BOT.trialOver('slips'), BOT.trialOver('days'));
});

test('an unreadable slip names the field rather than saying it failed', () => {
  const msg = BOT.unreadable(['stake', 'odds']);
  assert.match(msg, /stake/);
  assert.match(msg, /odds/);
  assert.match(msg, /^UNREADABLE/);
});

test('an invalid code never reveals whether it exists', () => {
  assert.equal(BOT.notACode, 'Not a code I recognise.');
  assert.doesNotMatch(BOT.notACode, /expired|used|taken|already/i);
});

test('the rate limit says when, with a number', () => {
  assert.match(BOT.rateLimited(45), /45 seconds/);
});

test('the field table shows what was read and dashes what was not', () => {
  const t = fieldTable({ stake_pence: 10000, odds: 1.8, selection: 'Juventus', event_name: 'Juventus v Cremonese', bookmaker: 'bet365', legs: [1, 2, 3, 4] });
  assert.match(t, /^READ · 4 legs · bet365/);
  assert.match(t, /£100\.00 → £180\.00/);
  const gaps = fieldTable({ stake_pence: null, odds: null, selection: null, event_name: null, bookmaker: null, legs: [] });
  assert.match(gaps, /not read/, 'a gap says so in words rather than showing a dash');
});

test('a settled bet reports its own result and the day', () => {
  assert.equal(settledLine('Arsenal', 900, 11200), 'FT Arsenal +£9.00 · today +£112.00');
  assert.match(settledLine('Inter', -2500, -400), /−£25\.00 · today −£4\.00/);
});
