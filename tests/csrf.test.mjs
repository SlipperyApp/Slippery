/* Cross-origin writes.
 *
 * SameSite=Lax was the only thing standing between a session cookie and a
 * cross-site write. Lax is real, but it is one layer, it varies by browser,
 * and it says nothing about a request that arrives with no Origin at all.
 *
 * The awkward case, and the reason this is a check rather than a blanket
 * refusal: Apple posts the OAuth callback from appleid.apple.com, so that
 * one route is cross-site by design and has to stay reachable.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crossOrigin } from '../api/_lib/http.js';

const req = (method, headers = {}) => ({ method, headers: Object.assign({ host: 'slippery.app' }, headers) });

test('reads are never blocked', () => {
  for (const m of ['GET', 'HEAD', 'OPTIONS']) {
    assert.equal(crossOrigin(req(m, { origin: 'https://evil.example' })), false,
      m + ' must not be blocked: this guard is about writes');
  }
});

test('a write from our own origin passes', () => {
  assert.equal(crossOrigin(req('POST', { origin: 'https://slippery.app' })), false);
  assert.equal(crossOrigin(req('POST', { origin: 'https://slippery.app', 'sec-fetch-site': 'same-origin' })), false);
});

test('a write from another origin is blocked', () => {
  assert.equal(crossOrigin(req('POST', { origin: 'https://evil.example' })), true);
  assert.equal(crossOrigin(req('DELETE', { origin: 'https://evil.example' })), true);
  assert.equal(crossOrigin(req('PATCH', { origin: 'https://evil.example' })), true);
});

test('a lookalike host does not pass', () => {
  /* Prefix and suffix matching is how this check is usually got wrong. */
  for (const o of ['https://slippery.app.evil.example', 'https://notslippery.app', 'https://slippery.appx']) {
    assert.equal(crossOrigin(req('POST', { origin: o })), true, o + ' must not pass');
  }
});

test('a garbled Origin is treated as hostile, not ignored', () => {
  assert.equal(crossOrigin(req('POST', { origin: 'not a url' })), true);
});

test('a non-browser client with no Origin is allowed through', () => {
  /* curl, and the Telegram servers. Those routes prove themselves with a
     secret and cannot be reached by riding somebody's cookie. */
  assert.equal(crossOrigin(req('POST')), false);
});

test('a browser navigation with no Origin is allowed', () => {
  assert.equal(crossOrigin(req('POST', { 'sec-fetch-site': 'same-origin' })), false);
  assert.equal(crossOrigin(req('POST', { 'sec-fetch-site': 'none' })), false);
});

test('a browser cross-site post with no Origin is still blocked', () => {
  assert.equal(crossOrigin(req('POST', { 'sec-fetch-site': 'cross-site' })), true);
});

test('the oauth callback is the one exempt route, and deliberately so', async () => {
  /* Apple posts it from appleid.apple.com. It carries no authority of its
     own: a single-use state row and a signed id_token are what prove it,
     so exempting it costs nothing and refusing it would break the only way
     it can ever arrive. If this exemption ever widens, that is a bug. */
  const src = await import('node:fs/promises')
    .then(fs => fs.readFile(new URL('../api/auth/[action].js', import.meta.url), 'utf8'));
  const m = /action !== '([a-z-]+)' && blockCrossOrigin/.exec(src);
  assert.ok(m, 'the auth router must guard writes');
  assert.equal(m[1], 'oauth-callback', 'exactly one action may be exempt, and it is the OAuth callback');
});

test('every session-authenticated route calls the guard', async () => {
  const fs = await import('node:fs/promises');
  for (const f of ['bets.js', 'groups.js', 'people.js', 'promo.js', 'settle.js', 'extract.js']) {
    const src = await fs.readFile(new URL('../api/' + f, import.meta.url), 'utf8');
    assert.ok(src.includes('blockCrossOrigin(req, res)'), f + ' must refuse cross-origin writes');
  }
});

test('the slip reader requires a session', async () => {
  /* It spends money at a model provider on every call. An IP bucket is not
     a gate when addresses are cheap. */
  const fs = await import('node:fs/promises');
  const src = await fs.readFile(new URL('../api/extract.js', import.meta.url), 'utf8');
  assert.ok(src.includes('sessionUser'), 'extract must look up the session');
  assert.ok(/Log in to read a slip/.test(src), 'and say so when there is not one');
});
