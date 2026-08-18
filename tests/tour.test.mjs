/* The first run tutorial.
 *
 * It walks the real product now: each step navigates, opens whatever has
 * to be open, scrolls the target into view and cuts a hole in the scrim
 * around it. It was six paragraphs in a centred modal, every word true and
 * none of it attached to anything.
 *
 * Properties that are easy to lose in a later edit: it must not depend on
 * browser storage, it must be escapable, every step must point at
 * something that exists, and it must not end by suggesting a bet.
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
  const tour = await read('src/js/tour.js');
  const main = await read('src/js/main.js');
  assert.equal(/localStorage|sessionStorage/.test(tour), false,
    'the tour must not reach for storage iOS does not give it');
  assert.ok(main.includes("post('/api/auth/profile', { onboarded: true })"),
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
  const tour = await read('src/js/tour.js');
  assert.ok(main.includes("if (c('#tourSkip')) { Tour.endTour(false); return; }"));
  /* endTour calls onFinish either way, and the write does not look at
     which button got there. Somebody who skipped has made a decision. */
  assert.match(tour, /onFinish\(finished\)/);
  const fn = main.slice(main.indexOf('async function tourFinished'));
  const body = fn.slice(0, fn.indexOf('\n}\n'));
  assert.match(body, /onboarded: true/);
  assert.ok(body.indexOf('onboarded: true') < body.indexOf('if (finished)'),
    'the write must happen for a skip as well as a finish');
});

test('skip is available on every step', async () => {
  const html = await read('src/app.html');
  const card = html.slice(html.indexOf('<div class="tour"'), html.indexOf('themeintro'));
  assert.ok(card.includes('id="tourSkip"'), 'a tour that cannot be escaped is a trap');
  /* Rendered once outside the step content, so no step can omit it. */
  assert.equal((card.match(/id="tourSkip"/g) || []).length, 1);
});

test('there are six steps and the last one is the bot rather than a bet', async () => {
  const { TOUR } = await import('../src/js/tour.js');
  assert.equal(TOUR.length, 6, 'Step N of 6 is what the copy promises');

  const last = JSON.stringify(TOUR[TOUR.length - 1]);
  assert.match(last, /bot|forward/i);
  /* The brief forbids nudging toward volume. Finishing on "now place a
     bet" would be exactly that. */
  assert.equal(/place a bet|put a bet|have a bet/i.test(last), false,
    'the tour must not end by suggesting a bet');
});

test('the tour states that all three capture stages are equal', async () => {
  /* The product accepts a bet before kick off, in play, or after the
     result. Saying otherwise here would teach the wrong thing on the one
     screen everybody reads. */
  const { TOUR } = await import('../src/js/tour.js');
  const copy = TOUR.map(t => t.body).join(' ');
  assert.match(copy, /Before kick off, in play or after the result/i);
  assert.match(copy, /all three are logged the same way/i);
});

test('every step points at something that exists', async () => {
  /* A step whose target is not in the markup silently becomes a modal
     again, which is exactly what this replaced. */
  const { TOUR } = await import('../src/js/tour.js');
  const html = await read('src/app.html');
  for (const step of TOUR) {
    for (const sel of step.target.split(',').map(x => x.trim())) {
      const id = /^#([\w-]+)/.exec(sel);
      const attr = /^\[([^\]=]+)="([^"]+)"\]/.exec(sel);
      const cls = /^\.([\w-]+)/.exec(sel);
      const found = id ? html.includes('id="' + id[1] + '"')
        : attr ? html.includes(attr[1] + '="' + attr[2] + '"')
        : cls ? html.includes(cls[1])
        : false;
      assert.ok(found, step.id + ' points at ' + sel + ', which is not in the markup');
    }
  }
});

test('every step names a view the router knows', async () => {
  const { TOUR } = await import('../src/js/tour.js');
  const html = await read('src/app.html');
  for (const step of TOUR) {
    assert.ok(html.includes('id="' + step.view + '"'), step.id + ' goes to a view that does not exist');
  }
});

test('the tutorial can be replayed later', async () => {
  const html = await read('src/app.html');
  const main = await read('src/js/main.js');
  assert.match(html, /id="tourReplay"/, 'Settings needs a way to run it again');
  assert.match(main, /c\('#tourReplay'\)/);
});

test('the highlight does not swallow the tap it is asking for', async () => {
  /* A tutorial that says "tap Show more" and then eats the tap teaches
     nothing. */
  const css = await read('src/styles/08-flows.css');
  const tour = css.slice(css.indexOf('.tour{'), css.indexOf('@keyframes tourin'));
  assert.match(tour, /pointer-events:none/);
  assert.match(tour, /box-shadow:0 0 0 9999px/, 'the scrim is the hole, so there is one thing to move');
});

test('no em dash in the tour copy', async () => {
  const { TOUR } = await import('../src/js/tour.js');
  assert.equal(JSON.stringify(TOUR).includes('—'), false);
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
  assert.match(src, /tourPending = false;[\s\S]{0,80}openTour\(\);/);
});
