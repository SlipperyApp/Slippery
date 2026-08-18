/* The first run tour.
 *
 * Three properties matter and all three are easy to lose in a later edit:
 * it must not depend on browser storage, it must be escapable, and it must
 * not end by suggesting a bet.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';

const read = p => readFile(new URL('../' + p, import.meta.url), 'utf8');

test('the tour never uses browser storage', async () => {
  /* iOS Safari gives this app none, so a client-side "seen it" flag would
     replay the tour on every visit on the primary platform, and would not
     survive a second device. The state is a column on the users row. */
  const main = await read('src/js/main.js');
  const tour = main.slice(main.indexOf('const TOUR = ['), main.indexOf('function renderFederated'));
  assert.ok(tour.length > 200, 'expected to find the tour block');
  assert.equal(/localStorage|sessionStorage/.test(tour), false,
    'the tour must not reach for storage iOS does not give it');
  assert.ok(tour.includes("post('/api/auth/profile', { onboarded: true })"),
    'finishing must be written to the server');
});

test('the server is the only thing that decides the tour has been seen', async () => {
  const main = await read('src/js/main.js');
  assert.ok(main.includes('r.body.user.onboarded === false'),
    'strictly false: an absent field must not open the tour, or every ' +
    'deployment that has not shipped the column yet shows it to everybody');
});

test('skipping is recorded, so it is not asked again', async () => {
  const main = await read('src/js/main.js');
  assert.ok(main.includes("if (c('#tourSkip')) { closeTour(false); return; }"));
  /* closeTour writes regardless of which button got here. Somebody who
     skipped has made a decision. */
  const close = main.slice(main.indexOf('async function closeTour'));
  assert.ok(close.indexOf('onboarded: true') < close.indexOf('if (goImport)'),
    'the write must happen for a skip as well as a finish');
});

test('skip is available on every step', async () => {
  const html = await read('src/app.html');
  const card = html.slice(html.indexOf('<div class="tour"'), html.indexOf('themeintro'));
  assert.ok(card.includes('id="tourSkip"'), 'a tour that cannot be escaped is a trap');
  /* Rendered once outside the step content, so no step can omit it. */
  assert.equal((card.match(/id="tourSkip"/g) || []).length, 1);
});

test('there are six steps and the last one imports rather than bets', async () => {
  const main = await read('src/js/main.js');
  const block = main.slice(main.indexOf('const TOUR = ['), main.indexOf('let tourAt'));
  const steps = block.match(/\n  \['/g) || [];
  assert.equal(steps.length, 6, 'Step N of 6 is what the copy promises');

  const last = block.slice(block.lastIndexOf("  ['"));
  assert.match(last, /history|import|Screenshots/i);
  /* The brief forbids nudging toward volume. Finishing on "now place a
     bet" would be exactly that. */
  assert.equal(/place a bet|put a bet|have a bet/i.test(last), false,
    'the tour must not end by suggesting a bet');
});

test('the tour states that all three capture stages are equal', async () => {
  /* The product accepts a bet before kick off, in play, or after the
     result. Saying otherwise here would teach the wrong thing on the one
     screen everybody reads. */
  const main = await read('src/js/main.js');
  const block = main.slice(main.indexOf('const TOUR = ['), main.indexOf('let tourAt'));
  assert.match(block, /Before kick off, in play, or after the result/i);
  assert.match(block, /All three are logged the same way/i);
});

test('no em dash in the tour copy', async () => {
  const main = await read('src/js/main.js');
  const block = main.slice(main.indexOf('const TOUR = ['), main.indexOf('let tourAt'));
  assert.equal(block.includes('—'), false);
});

test('the server only ever sets the flag, never clears it', async () => {
  const profile = await read('api/_lib/routes/profile.js');
  assert.ok(profile.includes('COALESCE(onboarded_at, now())'),
    'once finished it stays finished, so a stale client cannot make ' +
    'somebody sit through the tour twice');
  assert.ok(profile.includes('body.onboarded === true'),
    'strictly true, so a truthy accident does not mark it done');
});

test('the session query selects the column it reports', async () => {
  /* The exact bug that hid the Telegram link code: the value was stored
     correctly and the session query still listed the columns from before
     the feature existed, so the field was undefined forever and nothing
     errored. */
  const auth = await read('api/_lib/auth.js');
  const me = await read('api/_lib/routes/me.js');
  assert.ok(auth.includes('u.onboarded_at'), 'sessionUser must select onboarded_at');
  assert.ok(me.includes('onboarded: Boolean(user.onboarded_at)'), 'and me must report it');
});

/* The tour and the setup wizard are one sequence, not two overlapping ones.
 *
 * Verifying an email signs you in, which re-reads the session, which used
 * to pop the six-step tour on top of step 2 of a wizard the person was
 * halfway through. Finishing the tour then navigated to Import, abandoning
 * the rest of setup: the unit, the target, the privacy choice and the theme
 * were all silently skipped. */
test('the tour waits for setup to finish rather than covering it', () => {
  const src = readFileSync(new URL('../src/js/main.js', import.meta.url), 'utf8');
  const open = src.slice(src.indexOf("onboarded === false"));
  const decision = open.slice(0, 500);
  assert.match(decision, /S\.view === 'setup'/,
    'the tour must not open over the setup wizard');
  assert.match(decision, /tourPending = true/);
  /* And the deferral has to be spent, or the tour would never be shown to
     the accounts that most need it. */
  assert.match(src, /tourPending = false;\s*\n\s*go\('dash'\);\s*\n\s*openTour\(\);/);
});
