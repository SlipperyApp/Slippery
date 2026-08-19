import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeLinkCode, normaliseLinkCode, looksLikeLinkCode, LINK_PREFIX } from '../lib/server/crypto.ts';

/* THE DEFECT THIS TEST EXISTS FOR.
   The old app generated link codes in one format and validated them in
   another, so every account was seeded with a code the bot refused. One
   generator, one validator, and a test that a generated code passes it. */
test('a generated code passes the validator that the bot uses', () => {
  for (let i = 0; i < 500; i++) {
    const code = makeLinkCode();
    assert.ok(looksLikeLinkCode(code), code + ' was generated and then rejected');
    assert.equal(normaliseLinkCode(code), code);
    assert.ok(code.startsWith(LINK_PREFIX));
    assert.equal(code.length, 9);
  }
});

test('the ways somebody types a code into Telegram all reach the same code', () => {
  const code = 'SLIP-4F2K';
  for (const typed of ['SLIP-4F2K', 'slip-4f2k', 'slip 4f2k', 'slip4f2k', ' SLIP4F2K ', '4F2K', '4f2k']) {
    assert.equal(normaliseLinkCode(typed), code, typed + ' did not normalise');
  }
});

test('the alphabet leaves out the characters people misread', () => {
  const chars = new Set<string>();
  for (let i = 0; i < 2000; i++) for (const c of makeLinkCode().slice(5)) chars.add(c);
  for (const bad of ['0', 'O', '1', 'I', 'L', 'U']) {
    assert.equal(chars.has(bad), false, bad + ' is too easily misread to be in a code');
  }
});

test('nonsense is rejected rather than coerced into something', () => {
  for (const bad of ['', 'SLIP', 'SLIP-12', 'SLIP-4F2KX', 'hello there', 'SLIP-0OIL']) {
    assert.equal(normaliseLinkCode(bad), null, bad + ' should not be a code');
  }
});
