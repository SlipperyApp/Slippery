/* Account linking.
 *
 * The rule that matters most here is the one that was wrong before: a chat
 * already linked to an account must REFUSE a code for a different account
 * rather than moving itself. The old handler caught the unique-index
 * violation, cleared the existing link and retried, so a correct code
 * silently moved somebody's chat onto another ledger with nothing anywhere
 * saying it had happened.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  BOT, LINK_ALPHABET, LINK_LENGTH, LINK_PREFIX, LINK_TTL_MS,
  formatCode, looksLikeCode, normaliseCode
} from '../api/_lib/bot-strings.js';

test('the alphabet has no character anybody has to guess at', () => {
  for (const bad of ['O', '0', 'I', 'L', '1', 'U']) {
    assert.ok(!LINK_ALPHABET.includes(bad),
      bad + ' is in the alphabet, and it is one of the pairs people mistype');
  }
  assert.equal(new Set(LINK_ALPHABET).size, LINK_ALPHABET.length, 'no duplicates');
  assert.ok(LINK_ALPHABET.length >= 26, 'enough characters to be worth four of them');
});

test('a code is SLIP and four characters, and lasts ten minutes', () => {
  /* The prefix is the point. A bare six characters in a chat window is a
     string somebody might or might not have been sent; a code that says
     what it is is a code people paste correctly. */
  assert.equal(LINK_PREFIX, 'SLIP');
  assert.equal(LINK_LENGTH, 4);
  assert.equal(LINK_TTL_MS, 10 * 60 * 1000);
  assert.equal(formatCode('4F2K'), 'SLIP-4F2K');
});

test('case and punctuation are forgiven', () => {
  assert.equal(normaliseCode(' slip-4f2k '), 'SLIP4F2K');
  assert.equal(normaliseCode('SLIP 4F2K'), 'SLIP4F2K');
  assert.equal(normaliseCode('slip4f2k'), 'SLIP4F2K');
});

test('the prefix is help, not a trap', () => {
  /* Somebody reading the code off a screen often sends only the four
     characters. That is the code, and refusing it would be pedantry. */
  assert.equal(normaliseCode('4F2K'), 'SLIP4F2K');
  assert.equal(looksLikeCode('4F2K'), true);
});

test('a confusable character is rejected rather than silently stripped', () => {
  /* Stripping the O would turn a six character code into a five character
     one and fail for a reason nobody could work out. */
  assert.equal(normaliseCode('SLIP-2C3O'), 'SLIP2C3O', 'nothing is removed');
  assert.equal(looksLikeCode('SLIP-2C3O'), false, 'and it is refused');
  assert.match(BOT.linkBadShape('AB2C3O'), /no O, I, or zero/);
});

test('the wrong length is not a code', () => {
  assert.equal(looksLikeCode('AB2C3'), false);
  assert.equal(looksLikeCode('AB2C3DE'), false);
  assert.equal(looksLikeCode(''), false);
});

test('a real code passes', () => {
  const code = 'SLIP-' + LINK_ALPHABET.slice(0, 4);
  assert.equal(looksLikeCode(code), true);
  assert.equal(looksLikeCode(code.toLowerCase()), true, 'typed in lower case is still the code');
});

test('a code that is not one of ours is refused', () => {
  assert.equal(looksLikeCode('ZZZZ-4F2K'), false, 'wrong prefix');
  assert.equal(looksLikeCode('SLIP-4F2'), false, 'too short');
  assert.equal(looksLikeCode('SLIP-4F2KK'), false, 'too long');
  assert.equal(looksLikeCode(''), false);
});

/* ---------------- the messages ----------------
   These are assertions about wording because the wording is the product
   here: a link flow is almost entirely what it says when something is
   wrong. */

test('refusing to move a linked chat names the account it is on', () => {
  const m = BOT.linkTakenByOther('DariusOdds');
  assert.match(m, /DariusOdds/);
  assert.match(m, /unlink/i, 'it has to say how to actually move it');
  assert.ok(!/moved|switched/i.test(m.split('\n')[0]),
    'the first line must not imply it did move it');
});

test('an expired code is told apart from a wrong one', () => {
  assert.notEqual(BOT.linkExpired, BOT.linkNoMatch);
  assert.match(BOT.linkExpired, /expired/i);
  assert.match(BOT.linkExpired, /ten minutes/i, 'say how long they last');
});

test('an unlinked chat is told nothing is being saved', () => {
  assert.match(BOT.notLinked, /not linked/i);
  assert.match(BOT.notLinked, /nothing/i,
    'the whole point is that it does not look like it worked');
  /* The instructions are a separate string so they can be sent once. */
  assert.ok(!/\/link/.test(BOT.notLinked), 'the how-to is not in the every-time line');
  assert.match(BOT.notLinkedHow, /\/link/);
});

test('unlinking promises nothing is deleted', () => {
  const m = BOT.unlinked('DariusOdds');
  assert.match(m, /DariusOdds/);
  assert.match(m, /nothing has been deleted/i);
});

test('no bot message shouts, and none carries an emoji', () => {
  /* House style, and the emoji rule is a real constraint: they rasterise
     from the system font, cannot take the profit and loss colours, and
     differ per platform. */
  const emoji = /[\u{1F300}-\u{1FAFF}\u{2190}-\u{21FF}\u{2600}-\u{27BF}]/u;
  const seen = [];
  const walk = v => {
    if (typeof v === 'string') seen.push(v);
    else if (typeof v === 'function') {
      /* Call it with placeholder arguments so the template is checked too. */
      try { seen.push(String(v('X', 'Y', 'Z', 'W'))); } catch { /* needs different args */ }
    }
  };
  Object.values(BOT).forEach(walk);
  assert.ok(seen.length > 30, 'the inventory should be most of the bot');
  for (const s of seen) {
    assert.ok(!emoji.test(s), 'emoji in: ' + s.slice(0, 50));
    assert.ok(!s.includes('!'), 'exclamation mark in: ' + s.slice(0, 50));
  }
});

test('every message is a string or a function returning one', () => {
  for (const [k, v] of Object.entries(BOT)) {
    assert.ok(typeof v === 'string' || typeof v === 'function',
      k + ' is neither a message nor a way of making one');
  }
});
