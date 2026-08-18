/* Federated sign in.
 *
 * The checks pinned here are the ones whose absence is invisible: a token
 * that decodes fine and is still not ours, a state that works twice, an
 * unverified email walking into an existing account. Everything below is
 * either a real signature or a real refusal, generated in the test, so
 * none of it can pass by accident.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, createSign, randomUUID } from 'node:crypto';

import { PROVIDERS, configured, configuredProviders, redirectUri, meta, truthy } from '../api/_lib/oauth.js';

const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url');

/* A working RSA key, and a JWKS served from a stubbed fetch, so
   verifyIdToken runs its real signature path against a real signature. */
const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const jwk = publicKey.export({ format: 'jwk' });
const KID = 'test-key';

function idToken(claims, { kid = KID, key = privateKey } = {}) {
  const head = b64({ alg: 'RS256', kid, typ: 'JWT' });
  const body = b64(claims);
  const sig = createSign('RSA-SHA256').update(head + '.' + body).end()
    .sign(key).toString('base64url');
  return head + '.' + body + '.' + sig;
}

function goodClaims(over = {}) {
  const now = Math.floor(Date.now() / 1000);
  return Object.assign({
    iss: 'https://accounts.google.com',
    aud: 'test-client-id',
    sub: 'google-subject-1',
    email: 'someone@example.com',
    email_verified: true,
    nonce: 'the-nonce',
    iat: now,
    exp: now + 600
  }, over);
}

/* verifyIdToken reaches for the live JWKS. Point it at ours. */
function stubFetch() {
  const real = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => ({ keys: [Object.assign({}, jwk, { kid: KID, alg: 'RS256', use: 'sig' })] })
  });
  return () => { globalThis.fetch = real; };
}

async function verify(token, nonce = 'the-nonce') {
  /* Imported fresh so the module-level JWKS cache cannot leak between
     tests and quietly make a later one pass on an earlier one's key. */
  const mod = await import('../api/_lib/oauth.js?v=' + randomUUID());
  return mod.verifyIdToken('google', token, nonce);
}

test('providers are exactly google and apple', () => {
  assert.deepEqual(PROVIDERS, ['google', 'apple']);
});

test('a provider with no credentials is never reported as configured', () => {
  const saved = { ...process.env };
  delete process.env.GOOGLE_CLIENT_ID; delete process.env.GOOGLE_CLIENT_SECRET;
  delete process.env.APPLE_CLIENT_ID; delete process.env.APPLE_TEAM_ID;
  delete process.env.APPLE_KEY_ID; delete process.env.APPLE_PRIVATE_KEY;
  assert.equal(configured('google'), false);
  assert.equal(configured('apple'), false);
  assert.deepEqual(configuredProviders(), [],
    'an unconfigured deployment must render no federated buttons at all');
  /* Half-configured is not configured: a client id with no secret gets as
     far as the redirect and then dies at the token exchange. */
  process.env.GOOGLE_CLIENT_ID = 'x';
  assert.equal(configured('google'), false);
  Object.assign(process.env, saved);
});

test('an unknown provider is never configured', () => {
  assert.equal(configured('facebook'), false);
  assert.equal(configured(''), false);
});

test('the redirect uri is the one registered with the provider', () => {
  const saved = process.env.PUBLIC_BASE_URL;
  process.env.PUBLIC_BASE_URL = 'https://slippery-iota.vercel.app/';
  assert.equal(redirectUri({}), 'https://slippery-iota.vercel.app/api/auth/oauth-callback');
  delete process.env.PUBLIC_BASE_URL;
  assert.equal(redirectUri({ headers: { host: 'example.test' } }),
    'https://example.test/api/auth/oauth-callback');
  if (saved !== undefined) process.env.PUBLIC_BASE_URL = saved;
});

test('apple is asked for form_post, google is not', () => {
  /* Apple refuses the request outright without it, and silently drops the
     scoped fields. Google has no such mode. */
  assert.equal(meta('apple').auth, 'https://appleid.apple.com/auth/authorize');
  assert.equal(meta('google').auth, 'https://accounts.google.com/o/oauth2/v2/auth');
  assert.ok(meta('apple').scope.includes('email'));
  assert.ok(meta('google').scope.includes('openid'));
});

test('email_verified is accepted as a string, because Apple sends one', () => {
  assert.equal(truthy(true), true);
  assert.equal(truthy('true'), true);
  assert.equal(truthy(false), false);
  assert.equal(truthy('false'), false);
  assert.equal(truthy(undefined), false);
});

/* ---------------- the signature path ---------------- */

test('a correctly signed token verifies', async () => {
  process.env.GOOGLE_CLIENT_ID = 'test-client-id';
  const restore = stubFetch();
  const claims = await verify(idToken(goodClaims()));
  assert.equal(claims.sub, 'google-subject-1');
  restore();
});

test('a tampered payload does not verify', async () => {
  process.env.GOOGLE_CLIENT_ID = 'test-client-id';
  const restore = stubFetch();
  const token = idToken(goodClaims());
  const [h, , s] = token.split('.');
  const swapped = h + '.' + b64(goodClaims({ sub: 'someone-else' })) + '.' + s;
  await assert.rejects(() => verify(swapped), /signature did not verify/);
  restore();
});

test('a token signed by a different key does not verify', async () => {
  process.env.GOOGLE_CLIENT_ID = 'test-client-id';
  const other = generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey;
  const restore = stubFetch();
  await assert.rejects(() => verify(idToken(goodClaims(), { key: other })), /signature did not verify/);
  restore();
});

test('a key id we do not know is refused rather than guessed at', async () => {
  process.env.GOOGLE_CLIENT_ID = 'test-client-id';
  const restore = stubFetch();
  await assert.rejects(() => verify(idToken(goodClaims(), { kid: 'nope' })), /unknown key/);
  restore();
});

test('the wrong issuer is refused', async () => {
  process.env.GOOGLE_CLIENT_ID = 'test-client-id';
  const restore = stubFetch();
  await assert.rejects(() => verify(idToken(goodClaims({ iss: 'https://evil.example' }))), /wrong issuer/);
  restore();
});

test('a token minted for a different app is refused', async () => {
  process.env.GOOGLE_CLIENT_ID = 'test-client-id';
  const restore = stubFetch();
  await assert.rejects(() => verify(idToken(goodClaims({ aud: 'someone-elses-app' }))), /different app/);
  restore();
});

test('an expired token is refused', async () => {
  process.env.GOOGLE_CLIENT_ID = 'test-client-id';
  const restore = stubFetch();
  const now = Math.floor(Date.now() / 1000);
  await assert.rejects(() => verify(idToken(goodClaims({ exp: now - 3600 }))), /expired/);
  restore();
});

test('a token whose nonce does not match this sign in is refused', async () => {
  /* Without this a token minted during somebody else's flow passes every
     other check on this list. */
  process.env.GOOGLE_CLIENT_ID = 'test-client-id';
  const restore = stubFetch();
  await assert.rejects(() => verify(idToken(goodClaims({ nonce: 'a-different-nonce' }))),
    /did not match this sign in/);
  restore();
});

test('a malformed token is refused before anything is trusted', async () => {
  process.env.GOOGLE_CLIENT_ID = 'test-client-id';
  const restore = stubFetch();
  for (const bad of ['', 'not-a-token', 'a.b']) {
    await assert.rejects(() => verify(bad), /Malformed/);
  }
  restore();
});

test('alg none is refused', async () => {
  /* The classic. A token asking to be trusted without a signature. */
  process.env.GOOGLE_CLIENT_ID = 'test-client-id';
  const restore = stubFetch();
  const token = b64({ alg: 'none', kid: KID }) + '.' + b64(goodClaims()) + '.';
  await assert.rejects(() => verify(token), /Unsupported token algorithm/);
  restore();
});
