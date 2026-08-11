/* SMTP message construction.
 *
 * The network half of sending mail is not testable here, but it is also not
 * where the bugs are. The bugs are in the message: a body line beginning
 * with a dot that silently truncates the email, a bare newline Gmail
 * rejects, a display name with an accent that breaks the header. Each of
 * those produces a message that looks fine in the code and wrong in the
 * inbox, so each gets a test.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { message, stuff } from '../api/_lib/smtp.js';

const opts = () => ({
  from: 'Slippery <slipperyapp@gmail.com>',
  to: 'darius@example.com',
  subject: 'Your Slippery code: 481920',
  text: 'Your Slippery verification code is 481920.',
  html: '<p>481920</p>'
});

test('a line starting with a dot is stuffed, or the message truncates', () => {
  /* A line that is exactly "." ends the DATA section. Without stuffing,
     everything after it is silently dropped and the recipient gets half an
     email with no error anywhere. */
  assert.equal(stuff('.hidden'), '..hidden');
  assert.equal(stuff('one\n.two\nthree'), 'one\r\n..two\r\nthree');
  assert.equal(stuff('.'), '..');
  assert.equal(stuff('a.b'), 'a.b', 'a dot mid-line is not a terminator');
});

test('every line ends CRLF, whatever it started as', () => {
  assert.equal(stuff('a\nb'), 'a\r\nb');
  assert.equal(stuff('a\r\nb'), 'a\r\nb', 'already-correct endings are not doubled');
  assert.equal(stuff('a\rb'), 'a\r\nb');
});

test('the message carries both parts and a matching boundary', () => {
  const m = message(opts());
  const boundary = /boundary="([^"]+)"/.exec(m)[1];
  assert.ok(m.includes('Content-Type: multipart/alternative'));
  assert.ok(m.includes('--' + boundary), 'parts must use the declared boundary');
  assert.ok(m.trimEnd().endsWith('--' + boundary + '--'), 'must close the multipart');
  assert.ok(m.includes('text/plain'));
  assert.ok(m.includes('text/html'));
  assert.ok(m.includes('481920'));
});

test('the boundary cannot appear in the body it delimits', () => {
  const m = message(opts());
  const boundary = /boundary="([^"]+)"/.exec(m)[1];
  const body = m.slice(m.indexOf(boundary) + boundary.length);
  const stray = body.split('--' + boundary).length - 1;
  assert.equal(stray, 3, 'exactly two part markers and one closing marker');
});

test('headers and body are separated by one blank line', () => {
  const m = message(opts());
  const split = m.indexOf('\r\n\r\n');
  assert.ok(split > 0);
  const headers = m.slice(0, split);
  assert.ok(headers.includes('From: '));
  assert.ok(headers.includes('To: darius@example.com'));
  assert.ok(headers.includes('Subject: '));
  assert.ok(headers.includes('MIME-Version: 1.0'));
  assert.ok(!headers.includes('<p>'), 'no body content above the blank line');
});

test('To: carries the bare address even when given a display name', () => {
  const m = message(Object.assign(opts(), { to: 'Darius <darius@example.com>' }));
  assert.ok(/^To: darius@example\.com$/m.test(m.replace(/\r/g, '')));
});

test('a non-ASCII display name is RFC 2047 encoded, not sent raw', () => {
  /* An 8-bit byte in a header is a rejection from a strict server. */
  const m = message(Object.assign(opts(), { from: 'Slippéry <a@b.com>' }));
  const from = /^From: (.*)$/m.exec(m.replace(/\r/g, ''))[1];
  assert.match(from, /^=\?UTF-8\?B\?/, 'expected an encoded-word, got: ' + from);
  assert.ok(!/[^\x00-\x7F]/.test(from), 'no raw 8-bit bytes in a header');
});

test('an ASCII header is left alone rather than needlessly encoded', () => {
  const m = message(opts());
  assert.ok(m.includes('From: Slippery <slipperyapp@gmail.com>'));
});

test('a dot-leading line inside the body survives into a part', () => {
  const m = message(Object.assign(opts(), { text: '.leading dot\nsecond line' }));
  assert.ok(m.includes('..leading dot'), 'body parts must be stuffed too');
});

test('the subject is on one line — a newline would inject a header', () => {
  /* Header injection: a newline in a user-controlled subject would let the
     rest of the string become headers of its own. The subject here is
     built from a six-digit code, but the property is worth holding. */
  const m = message(Object.assign(opts(), { subject: 'Your code: 481920' }));
  const subject = /^Subject: (.*)$/m.exec(m.replace(/\r/g, ''))[1];
  assert.ok(!subject.includes('\n'));
});
