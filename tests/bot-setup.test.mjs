/* Connecting the bot is a flow now, and the code says what it is.
 *
 * Everything this needed already existed: the server issues a code, the
 * bot accepts one, the client can poll. What did not exist was a path
 * through it. There was a Settings card with a code and a button, and a
 * setup step with the same code and the same button, and neither said what
 * was about to happen, what to do in the other app, or what had gone wrong
 * when nothing did.
 *
 * There was also a latent break nobody had hit: linkCode() seeded every
 * new account with SLIP-XXXX and looksLikeCode() wanted six bare
 * characters, so every account was created holding a code the bot would
 * refuse.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  LINK_PREFIX, LINK_LENGTH, LINK_ALPHABET, LINK_TTL_MS,
  formatCode, looksLikeCode, normaliseCode
} from '../api/_lib/bot-strings.js';
import { linkCode } from '../api/_lib/auth.js';

const read = f => readFile(new URL('../' + f, import.meta.url), 'utf8');

test('the seeded code is one the bot will accept', async () => {
  /* THE BUG. Not a hypothetical: every account ever created carried a code
     in a format the checker rejected, and the only working path was
     pressing New code in Settings. */
  for (let i = 0; i < 200; i++) {
    const code = linkCode();
    assert.equal(looksLikeCode(code), true, code + ' would be refused by the bot');
  }
});

test('the seed and the issuer produce the same shape', async () => {
  const link = await read('api/_lib/routes/link.js');
  const auth = await read('api/_lib/auth.js');
  /* One alphabet, one length, one prefix, imported from one place rather
     than each file having its own idea. */
  assert.match(link, /from '\.\.\/bot-strings\.js'/);
  assert.match(auth, /from '\.\/bot-strings\.js'/);
  assert.match(auth, /LINK_PREFIX/);
  assert.match(auth, /LINK_ALPHABET/);
});

test('a code is stored folded and shown with its dash', () => {
  const stored = LINK_PREFIX + LINK_ALPHABET.slice(0, LINK_LENGTH);
  assert.equal(normaliseCode(formatCode(LINK_ALPHABET.slice(0, LINK_LENGTH))), stored,
    'what somebody types must fold to what was stored');
});

test('a new account gets a code with a life on it', async () => {
  /* The seed had no expiry, so /api/auth/me reported it as absent and the
     Settings card showed dashes on a brand new account. */
  for (const f of ['api/_lib/routes/signup.js', 'api/_lib/routes/verify.js']) {
    const src = await read(f);
    assert.match(src, /link_code_expires_at/, f + ' seeds a code with no expiry');
  }
});

test('the flow has all four states and a way out of each', async () => {
  const html = await read('src/app.html');
  const sheet = html.slice(html.indexOf('id="botSheet"'), html.indexOf('id="daySheet"'));
  for (const state of ['explain', 'code', 'waiting', 'done']) {
    assert.ok(sheet.includes('data-botstate="' + state + '"'), 'no ' + state + ' state');
  }
  /* Skip is on every state but the last, because nobody is made to do
     this: forwarding slips is the fast path, not the only one. */
  assert.match(sheet, /id="botSkip"/);
  assert.match(sheet, /id="botErr"/, 'errors need somewhere to render in place');
  assert.match(sheet, /aria-live="polite"/, 'the state change has to be announced');
});

test('the waiting state is a state, not a silence', async () => {
  const bot = await read('src/js/botsetup.js');
  assert.match(bot, /POLL_TRIES/);
  /* Giving up says so and says what to do, rather than the page simply
     going quiet after a minute. */
  const give = bot.slice(bot.indexOf('tries >= POLL_TRIES'));
  assert.match(give.slice(0, 400), /Nothing has come through yet/);
  assert.match(bot, /Check again/);
});

test('the browser never picks the code', async () => {
  const bot = await read('src/js/botsetup.js');
  assert.match(bot, /post\('\/api\/auth\/link', \{ action: 'new' \}\)/);
  assert.doesNotMatch(bot, /Math\.random/, 'a code the browser picks is one it can pick to be somebody else’s');
});

test('the deep link carries the code so nothing is typed', async () => {
  const bot = await read('src/js/botsetup.js');
  assert.match(bot, /https:\/\/t\.me\/' \+ BOT \+ '\?start=' \+ encodeURIComponent/);
  assert.match(bot, /'noopener'/, 'without it the opened tab gets a handle on this window');
});

test('the flow is reachable again after it is skipped', async () => {
  const html = await read('src/app.html');
  const main = await read('src/js/main.js');
  assert.match(html, /id="botSetupOpen"/, 'Settings needs a way back in');
  assert.match(main, /c\('#botSetupOpen'\) \|\| c\('#telegramLink'\)/);
  /* And Settings shows it only when there is nothing linked. */
  assert.match(html, /id="tgUnlinked"/);
});

test('the countdown is shown, because a code with no clock is a trap', async () => {
  const bot = await read('src/js/botsetup.js');
  assert.match(bot, /function paintCountdown/);
  assert.match(bot, /That code has expired/);
  assert.equal(LINK_TTL_MS, 600000);
});
