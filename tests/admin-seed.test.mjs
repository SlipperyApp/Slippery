/* The seeded test account.
 *
 * Nothing else in the suite imports api/admin/reset.js, so a broken import
 * there would first be seen in production, on the one route whose job is to
 * be reachable exactly when something has gone wrong.
 *
 * The credentials this creates are deliberately known and live on a public
 * deployment. They are for beta testing and the account must be deleted
 * before launch. The test states the intent so it is not lost.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { emailProblem, passwordProblem, nameProblem } from '../api/_lib/auth.js';

const SEED_EMAIL = 'Tester1@Tester.com';
const SEED_PASSWORD = 'Tester1@Tester';
const SEED_NAME = 'Tester1';

test('the admin router still loads', async () => {
  const mod = await import('../api/admin/reset.js');
  assert.equal(typeof mod.default, 'function');
});

test('the seeded credentials pass the same rules a real signup does', () => {
  /* If these ever stop passing, the seed would create an account that the
     ordinary login path would refuse, and the failure would look like a
     login bug rather than a seeding one. */
  assert.equal(emailProblem(SEED_EMAIL), '');
  assert.equal(passwordProblem(SEED_PASSWORD), '');
  assert.equal(nameProblem(SEED_NAME), '');
});

test('the seed password would not be accepted if it were weak', () => {
  /* Proving the check above is doing work rather than returning '' always. */
  assert.notEqual(passwordProblem('tester1'), '');
  assert.notEqual(nameProblem('Tester 1'), '');
  assert.notEqual(emailProblem('Tester1@'), '');
});
