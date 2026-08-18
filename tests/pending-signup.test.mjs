/* An unverified signup must cost nothing.
 *
 * Before this, api/_lib/routes/signup.js INSERTed the users row before the
 * code was even sent. The partial unique indexes key on `deleted_at IS
 * NULL`, not on verification, so an abandoned signup held the address and
 * the display name for ever, started the trial clock, and consumed a promo
 * code that is UNIQUE per user and therefore unrecoverable. The second
 * attempt on the same address got a flat 409 and there was no expiry sweep
 * anywhere.
 *
 * The account now comes into existence in verify.js instead. These are
 * source-level checks because there is no database in the suite: what they
 * protect is the *placement* of four writes, and placement is exactly what
 * a mocked db would stop proving.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const signup = read('api/_lib/routes/signup.js');
const verify = read('api/_lib/routes/verify.js');
const resend = read('api/_lib/routes/resend.js');
const login = read('api/_lib/routes/login.js');
const db = read('api/_lib/db.js');
const auth = read('api/_lib/auth.js');

/* The one deliberate exception: a deployment with no mail provider cannot
   send a code, so it signs people up directly rather than stranding them.
   That branch is the tail of the handler, after the `if (mail.configured())`
   block has returned, so everything before its comment is the path that
   does send a code. */
const MAILLESS = signup.indexOf('No mail provider on this deployment');
/* Skip the import block: a name mentioned there is not a write. */
const afterImports = src => src.indexOf('export default');

test('the schema has somewhere to hold an unverified signup', () => {
  assert.match(db, /CREATE TABLE IF NOT EXISTS pending_signups/);
  for (const col of ['email_lower', 'display_name', 'name_lower',
                     'password_hash', 'promo_code', 'code_hash', 'expires_at', 'attempts']) {
    assert.match(db, new RegExp('\\b' + col + '\\b'), 'pending_signups needs ' + col);
  }
});

test('the pending name index is not unique, deliberately', () => {
  /* A unique index here would hold a display name hostage to a signup that
     never completes, which is the whole fault being fixed. Two people may
     wait on the same name; whoever verifies first gets it, and verify.js
     asks the loser for another one. */
  const idx = db.match(/CREATE[^;]*pending_signups_name_idx[^;]*/);
  assert.ok(idx, 'expected a pending_signups_name_idx');
  assert.doesNotMatch(idx[0], /UNIQUE/i);
});

test('signup stores the password hashed, never in the clear', () => {
  assert.doesNotMatch(signup, /password:\s*password/);
  assert.match(signup, /passwordHash/);
});

test('signup creates no users row on the path that sends a code', () => {
  /* Only the mail-less exception may INSERT INTO users, and it has to say
     so. Any other users INSERT in this file is the bug coming back. */
  assert.ok(MAILLESS > 0, 'the no-mail-provider branch should still be labelled');
  for (const m of signup.matchAll(/INSERT INTO users/g)) {
    assert.ok(m.index > MAILLESS,
      'signup.js INSERTs a users row outside the no-mail-provider branch');
  }
  assert.match(signup, /issuePendingSignup/);
});

test('signup does not stamp the trial clock or redeem the promo', () => {
  for (const m of signup.matchAll(/trial_ends_at|promo_redemptions/g)) {
    assert.ok(m.index > MAILLESS,
      'signup.js writes ' + m[0] + ' before the address is proved');
  }
});

test('verify is where the account, the trial and the promo happen', () => {
  assert.match(verify, /INSERT INTO users/);
  assert.match(verify, /trialEnd\(\)/);
  assert.match(verify, /INSERT INTO promo_redemptions/);
  assert.match(verify, /clearPendingSignup/);
});

test('verify starts the trial now, not when the form was submitted', () => {
  /* Somebody who never received the first mail and comes back a fortnight
     later used to find the trial already over. */
  assert.match(verify, /const trialEndsAt = trialEnd\(\);/);
  assert.doesNotMatch(verify, /pending\.(created_at|trial)/);
});

test('verify clears the pending row only after the account exists', () => {
  const body = verify.slice(afterImports(verify));
  assert.ok(body.indexOf('INSERT INTO users') < body.indexOf('clearPendingSignup'),
    'clearing first would lose the password hash if the INSERT failed');
});

test('a name taken during verification is recoverable, not fatal', () => {
  assert.match(verify, /needsName: true/);
  /* And the pending row survives it, so they can try another name without
     re-entering a password. */
  const collision = verify.slice(verify.indexOf('needsName'));
  assert.doesNotMatch(collision.slice(0, 200), /clearPendingSignup/);
});

test('verify answers the same way for an unknown address and a wrong code', () => {
  assert.match(verify, /const generic =/);
});

test('resend can find a pending signup, not just a users row', () => {
  assert.match(resend, /refreshPendingCode/);
});

test('resending does not rewrite the name, password or promo it holds', () => {
  const fn = auth.slice(auth.indexOf('export async function refreshPendingCode'));
  const body = fn.slice(0, fn.indexOf('\n}'));
  assert.match(body, /SET code_hash/);
  for (const col of ['display_name', 'password_hash', 'promo_code']) {
    assert.doesNotMatch(body, new RegExp(col), 'resend must not touch ' + col);
  }
  assert.match(body, /attempts = 0/);
});

test('login sends an unverified signup back to the code, not to a wrong-password dead end', () => {
  assert.match(login, /findPendingByIdentifier/);
  const body = login.slice(afterImports(login));
  const branch = body.slice(body.indexOf('findPendingByIdentifier'));
  assert.match(branch.slice(0, 400), /needsVerification: true/);
  /* The reply names an email address, so it is only given to somebody who
     proved the password. */
  assert.match(branch.slice(0, 400), /verifyPassword\(password, pending\.password_hash\)/);
});

test('a wrong code cannot be retried for ever', () => {
  const fn = auth.slice(auth.indexOf('export async function checkPendingCode'));
  assert.match(fn.slice(0, 1400), /attempts >= MAX_CODE_ATTEMPTS/);
  assert.match(fn.slice(0, 1400), /expires_at < now\(\)/);
  assert.match(fn.slice(0, 1400), /timingSafeEqual/);
});
