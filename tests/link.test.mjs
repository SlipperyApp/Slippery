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
  BOT, LINK_ALPHABET, LINK_LENGTH, LINK_TTL_MS, looksLikeCode, normaliseCode
} from '../api/_lib/bot-strings.js';

test('the alphabet has no character anybody has to guess at', () => {
  for (const bad of ['O', '0', 'I', 'L', '1', 'U']) {
    assert.ok(!LINK_ALPHABET.includes(bad),
      bad + ' is in the alphabet, and it is one of the pairs people mistype');
  }
  assert.equal(new Set(LINK_ALPHABET).size, LINK_ALPHABET.length, 'no duplicates');
  assert.ok(LINK_ALPHABET.length >= 26, 'enough characters to be worth six of them');
});

test('a code is six characters and lasts ten minutes', () => {
  assert.equal(LINK_LENGTH, 6);
  assert.equal(LINK_TTL_MS, 10 * 60 * 1000);
});

test('case and punctuation are forgiven', () => {
  assert.equal(normaliseCode(' ab2-c3d '), 'AB2C3D');
  assert.equal(normaliseCode('AB2 C3D'), 'AB2C3D');
});

test('a confusable character is rejected rather than silently stripped', () => {
  /* Stripping the O would turn a six character code into a five character
     one and fail for a reason nobody could work out. */
  assert.equal(normaliseCode('AB2C3O').length, 6, 'nothing is removed');
  assert.equal(looksLikeCode('AB2C3O'), false, 'and it is refused');
  assert.match(BOT.linkBadShape('AB2C3O'), /no O, I, or zero/);
});

test('the wrong length is not a code', () => {
  assert.equal(looksLikeCode('AB2C3'), false);
  assert.equal(looksLikeCode('AB2C3DE'), false);
  assert.equal(looksLikeCode(''), false);
});

test('a real code passes', () => {
  const code = LINK_ALPHABET.slice(0, 6);
  assert.equal(looksLikeCode(code), true);
  assert.equal(looksLikeCode(code.toLowerCase()), true, 'typed in lower case is still the code');
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
