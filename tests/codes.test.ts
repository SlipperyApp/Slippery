import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  generateLinkCode, generateInviteCode, isLinkCode, isInviteCode,
  normaliseLinkCode, isEmail, passwordOk, isHandle, PASSWORD_RULES,
} from '@/lib/server/codes';

test('a generated link code passes the only validator there is', () => {
  // The previous build seeded codes in a format its own bot rejected. This
  // test is the reason that cannot happen again.
  for (let i = 0; i < 500; i++) {
    const c = generateLinkCode();
    assert.ok(isLinkCode(c), `generated ${c} but the validator rejected it`);
  }
});

test('a generated invite code passes its validator', () => {
  for (let i = 0; i < 300; i++) assert.ok(isInviteCode(generateInviteCode()));
});

test('the alphabet has no character that can be misread', () => {
  const codes = Array.from({ length: 300 }, () => generateLinkCode()).join('');
  assert.ok(!/[01OIL]/.test(codes.replace(/SLIP-/g, '')));
});

test('a code typed without the prefix still resolves', () => {
  assert.ok(isLinkCode(normaliseLinkCode('7qk4')));
  assert.equal(normaliseLinkCode('slip-7qk4'), 'SLIP-7QK4');
});

test('the validator rejects near misses', () => {
  for (const bad of ['SLIP-', 'SLIP-123', 'SLIP-ABCDE', 'ABCD', 'SLIP_ABCD', 'SLIP-AB0D']) {
    assert.ok(!isLinkCode(bad), `${bad} should be rejected`);
  }
});

test('email validation rejects a double dot, which the old one accepted', () => {
  assert.ok(!isEmail('a@b..com'));
  assert.ok(!isEmail('a@b'));
  assert.ok(!isEmail('a@b.c'));
  assert.ok(!isEmail('@b.com'));
  assert.ok(!isEmail('a b@c.com'));
  assert.ok(isEmail('rowan@example.com'));
  assert.ok(isEmail('rowan.ellis+bets@sub.example.co.uk'));
});

test('the password rules the ticks show are the rules the server applies', () => {
  assert.equal(PASSWORD_RULES.length, 3);
  assert.ok(!passwordOk('short1A'));
  assert.ok(!passwordOk('alllowercase1'));
  assert.ok(!passwordOk('NoDigitsHere'));
  assert.ok(passwordOk('Slippery12'));
});

test('handles are lowercase and bounded', () => {
  assert.ok(isHandle('tester123'));
  assert.ok(!isHandle('ab'));
  assert.ok(!isHandle('Has Spaces'));
});
