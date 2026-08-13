/* The bot's copy, as a thing with rules.
 *
 * Wording is the product in a chat interface: there is no layout, no
 * colour and no hierarchy, only sentences. These enforce the house style
 * written at the top of bot-strings.js, because a style nobody checks is a
 * style that lasts until the next hurried edit.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BOT, LONG_ALLOWED, MAX_LEN, MAX_LEN_LONG } from '../api/_lib/bot-strings.js';

/* Every message, rendered. A template is called with placeholders long
   enough to be realistic, so a message that only overflows once a display
   name is in it is caught here rather than in somebody's chat. */
const ARGS = ['AVeryLongDisplayName', '12 August 2026', 'stake and odds', '£1,234.56'];
function everyMessage() {
  const out = [];
  for (const [key, value] of Object.entries(BOT)) {
    if (typeof value === 'string') out.push([key, value]);
    else if (typeof value === 'function') {
      try { out.push([key, String(value(...ARGS))]); } catch { /* different arity */ }
    }
  }
  return out;
}

test('there are messages to check', () => {
  assert.ok(everyMessage().length > 40, 'the inventory should be most of the bot');
});

test('no message runs past 280 characters', () => {
  for (const [key, text] of everyMessage()) {
    const cap = LONG_ALLOWED.includes(key) ? MAX_LEN_LONG : MAX_LEN;
    assert.ok(text.length <= cap,
      key + ' is ' + text.length + ' characters, over its ' + cap + ' limit:\n' + text);
  }
});

test('only the two documented messages are allowed to be long', () => {
  /* Named here as well as in the source, so a third exemption cannot be
     added without somebody deciding to add it twice. */
  assert.deepEqual(LONG_ALLOWED, ['welcome', 'help']);
  for (const [key, text] of everyMessage()) {
    if (LONG_ALLOWED.includes(key)) continue;
    assert.ok(text.length <= MAX_LEN, key + ' would need an exemption');
  }
});

test('no emoji anywhere', () => {
  /* They rasterise from the system font, cannot take the product's profit
     and loss colours, and differ per platform. */
  const emoji = /[\u{1F300}-\u{1FAFF}\u{2190}-\u{21FF}\u{2600}-\u{27BF}\u{FE0F}]/u;
  for (const [key, text] of everyMessage()) {
    assert.ok(!emoji.test(text), 'emoji in ' + key + ': ' + text.slice(0, 60));
  }
});

test('nothing shouts', () => {
  for (const [key, text] of everyMessage()) {
    assert.ok(!text.includes('!'), 'exclamation mark in ' + key + ': ' + text.slice(0, 60));
  }
});

test('markdown is balanced, or Telegram rejects the whole message', () => {
  /* An odd number of asterisks makes Telegram refuse to send at all, with
     a 400 that surfaces as the bot going silent. */
  for (const [key, text] of everyMessage()) {
    const stars = (text.match(/\*/g) || []).length;
    assert.equal(stars % 2, 0, 'unbalanced bold in ' + key + ': ' + text.slice(0, 80));
    const ticks = (text.match(/`/g) || []).length;
    assert.equal(ticks % 2, 0, 'unbalanced code span in ' + key);
  }
});

test('every refusal says what to do next', () => {
  /* A refusal that only says no leaves somebody stuck. Each of these is a
     dead end if it does not point somewhere. */
  const mustGuide = ['linkNoCode', 'linkNoMatch', 'linkExpired', 'linkUsed',
    'linkAccountElsewhere', 'notLinkedHow', 'unreadable', 'trialUsedUp'];
  const map = Object.fromEntries(everyMessage());
  for (const key of mustGuide) {
    const text = map[key];
    assert.ok(text, key + ' is missing from the strings file');
    assert.match(text, /\/\w+|Settings|Upgrade|crop|clearer|generate/i,
      key + ' refuses without saying what to do: ' + text);
  }
});
