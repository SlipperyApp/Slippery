import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validEmail, passwordProblems } from '../lib/server/email.ts';

test('the address the old validator let through is rejected', () => {
  assert.equal(validEmail('a@b..com'), false);
});

test('ordinary addresses are accepted', () => {
  for (const ok of ['a@b.com', 'first.last@sub.example.co.uk', "o'brien+tag@mail.ie"]) {
    assert.equal(validEmail(ok), true, ok + ' should be valid');
  }
});

test('addresses that would bounce are rejected', () => {
  for (const bad of [
    '', 'no-at-sign', '@example.com', 'a@', 'a@b', 'a b@example.com',
    '.leading@example.com', 'trailing.@example.com', 'double..dot@example.com',
    'a@-example.com', 'a@example-.com', 'a@example.1', 'a@example.c',
  ]) {
    assert.equal(validEmail(bad), false, bad + ' should be invalid');
  }
});

test('the password rules the signup screen ticks are the rules the server applies', () => {
  assert.deepEqual(passwordProblems('Str0ng!pass'), []);
  assert.deepEqual(passwordProblems('short!A'), ['8 characters']);
  assert.deepEqual(passwordProblems('alllowercase!'), ['one capital']);
  assert.deepEqual(passwordProblems('NoSpecials123'), ['one special']);
});
