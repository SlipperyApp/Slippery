/* Auth primitives. No database needed — these are the pure parts, and they
 * are the parts where a mistake is a security bug rather than a bug. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  hashPassword, verifyPassword, newCode, newToken, linkCode, sha256,
  emailProblem, passwordProblem, nameProblem
} from '../api/_lib/auth.js';

test('a password verifies against its own hash', async () => {
  const hash = await hashPassword('correct horse battery staple!');
  assert.equal(await verifyPassword('correct horse battery staple!', hash), true);
});

test('a wrong password does not verify', async () => {
  const hash = await hashPassword('correct horse battery staple!');
  assert.equal(await verifyPassword('correct horse battery stapl!', hash), false);
  assert.equal(await verifyPassword('', hash), false);
});

test('the hash is salted: the same password hashes differently every time', async () => {
  const a = await hashPassword('Hunter2!hunter2!');
  const b = await hashPassword('Hunter2!hunter2!');
  assert.notEqual(a, b, 'identical hashes would mean no salt, and a rainbow table works');
  assert.equal(await verifyPassword('Hunter2!hunter2!', a), true);
  assert.equal(await verifyPassword('Hunter2!hunter2!', b), true);
});

test('the stored hash never contains the password', async () => {
  const hash = await hashPassword('SuperSecret123!');
  assert.equal(hash.includes('SuperSecret123!'), false);
  assert.match(hash, /^scrypt\$16384\$8\$1\$/, 'parameters are recorded so they can be raised later');
});

test('a malformed or empty stored hash fails closed', async () => {
  for (const bad of ['', 'nonsense', 'bcrypt$x$y', null, undefined, 'scrypt$$$$']) {
    assert.equal(await verifyPassword('anything', bad), false);
  }
});

test('verification codes are six digits and well spread', () => {
  const seen = new Set();
  const digitCounts = new Array(10).fill(0);
  for (let i = 0; i < 3000; i++) {
    const code = newCode();
    assert.match(code, /^\d{6}$/);
    seen.add(code);
    for (const ch of code) digitCounts[+ch]++;
  }
  assert.ok(seen.size > 2900, 'codes must not repeat: ' + seen.size + ' unique in 3000');
  /* A naive `% 10` over raw bytes biases toward 0-5, because 256 is not a
     multiple of 10. Every digit should land near 10%. */
  const total = digitCounts.reduce((a, b) => a + b, 0);
  for (let d = 0; d < 10; d++) {
    const share = digitCounts[d] / total;
    assert.ok(share > 0.08 && share < 0.12,
      'digit ' + d + ' appears ' + (share * 100).toFixed(1) + '% of the time, expected ~10%');
  }
});

test('session tokens are long, unique and URL-safe', () => {
  const seen = new Set();
  for (let i = 0; i < 500; i++) {
    const t = newToken();
    assert.ok(t.length >= 42, 'token too short: ' + t.length);
    assert.match(t, /^[A-Za-z0-9_-]+$/, 'must survive a cookie without encoding');
    seen.add(t);
  }
  assert.equal(seen.size, 500);
});

test('link codes avoid the characters people misread', () => {
  for (let i = 0; i < 300; i++) {
    const code = linkCode();
    assert.match(code, /^SLIP-[A-HJ-NP-Z2-9]{4}$/,
      'no I, O, 0 or 1 — these get read aloud and typed wrong');
  }
});

test('sha256 is stable and does not leak its input', () => {
  assert.equal(sha256('abc'), sha256('abc'));
  assert.notEqual(sha256('abc'), sha256('abd'));
  assert.match(sha256('abc'), /^[0-9a-f]{64}$/);
});

/* ---- validation. The client runs the same rules; these are the ones that
   actually decide, so they are the ones under test. ---- */
test('email validation rejects what it should', () => {
  assert.equal(emailProblem('you@example.com'), '');
  assert.equal(emailProblem('a.b+tag@sub.example.co.uk'), '');
  for (const bad of ['', 'nope', 'a@b', 'a@@b.com', 'a b@c.com', 'a@b..com', 'x'.repeat(250) + '@y.com']) {
    assert.notEqual(emailProblem(bad), '', 'should reject: ' + bad);
  }
});

/* Eight characters, on the owner's instruction. Composition still applies:
   length alone at 8 is weak, and a capital plus a symbol is what keeps the
   floor above a dictionary word. The upper bound is not cosmetic — scrypt is
   memory-hard by design, so an unbounded password is a way to make the
   server do arbitrary work per request. */
test('password policy is 8 characters, with a capital and a symbol', () => {
  assert.equal(passwordProblem('Abcdef1!'), '');
  assert.equal(passwordProblem('Abcdefghij1!'), '');
  assert.notEqual(passwordProblem('Abc1!'), '', 'under 8 characters');
  assert.notEqual(passwordProblem('abcdefghijkl!'), '', 'no capital');
  assert.notEqual(passwordProblem('Abcdefghijkl'), '', 'no symbol');
  assert.notEqual(passwordProblem('A1!' + 'x'.repeat(300)), '', 'unbounded length is a DoS on scrypt');
});

test('display name policy', () => {
  assert.equal(nameProblem('DariusOdds'), '');
  assert.equal(nameProblem('a_1'), '');
  for (const bad of ['', 'ab', 'x'.repeat(21), 'has space', 'emoji😀', 'semi;colon']) {
    assert.notEqual(nameProblem(bad), '', 'should reject: ' + bad);
  }
});

/* Log in with either.
   The rule is exact rather than heuristic: nameProblem allows letters,
   numbers and underscores only, so a string containing @ can only ever have
   been meant as an email — including a malformed one, which should be told
   it is a bad email rather than treated as a username that does not exist. */
test('an identifier is a username or an email, decided by the @', async () => {
  const { identifierProblem, looksLikeEmail } = await import('../api/_lib/auth.js');
  assert.equal(identifierProblem('DariusOdds'), '');
  assert.equal(identifierProblem('you@example.com'), '');
  assert.equal(identifierProblem(''), 'Enter your username or email.');
  assert.notEqual(identifierProblem('broken@'), '', 'an @ means it is judged as an email');
  assert.equal(looksLikeEmail('a@b.com'), true);
  assert.equal(looksLikeEmail('DariusOdds'), false);
});
