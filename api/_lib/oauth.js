/* Sign in with Google and Sign in with Apple.
 *
 * NO NEW SERVERLESS FUNCTION. Vercel Hobby allows twelve and eleven exist,
 * so both providers ride api/auth/[action].js as oauth-start and
 * oauth-callback. Over the limit the build fails silently and the previous
 * deployment keeps serving, which has already cost this project five
 * commits of confusion.
 *
 * NO DEPENDENCIES. The id_token signature is verified with node:crypto
 * against the provider's published JWKS. Adding a JOSE library to verify
 * two well-known issuers is not worth the supply-chain surface on a public
 * repo whose secrets get auto-revoked.
 *
 * WHAT IS ACTUALLY CHECKED, because "we decoded the JWT" is not the same
 * as "we verified it":
 *   · the signature, against the key the kid names in the live JWKS
 *   · iss, exactly
 *   · aud, exactly our client id
 *   · exp, and iat is not in the future
 *   · nonce, matched to the one minted at the start of this flow
 *   · email_verified, because an unverified address must never be allowed
 *     to claim an existing account by collision
 *
 * STATE LIVES IN THE DATABASE, NOT IN A SIGNED COOKIE. It has to be single
 * use, and a row that is deleted when it is read is single use by
 * construction. It also means no new signing secret has to be invented and
 * kept in step with anything.
 */
import { createHash, randomBytes, createPublicKey, createVerify, createSign } from 'node:crypto';
import { db } from './db.js';

export const PROVIDERS = ['google', 'apple'];

const b64url = buf => Buffer.from(buf).toString('base64url');

/** Which providers this deployment can actually complete a sign-in with. */
export function configured(provider) {
  if (provider === 'google') {
    return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
  }
  if (provider === 'apple') {
    return Boolean(process.env.APPLE_CLIENT_ID && process.env.APPLE_TEAM_ID &&
      process.env.APPLE_KEY_ID && process.env.APPLE_PRIVATE_KEY);
  }
  return false;
}
export function configuredProviders() {
  return PROVIDERS.filter(configured);
}

/* The redirect URI has to match what is registered with the provider
   exactly, character for character, so it is derived from one place. */
export function redirectUri(req) {
  const base = process.env.PUBLIC_BASE_URL ||
    (req && req.headers && req.headers.host ? 'https://' + req.headers.host : '');
  return base.replace(/\/+$/, '') + '/api/auth/oauth-callback';
}

const META = {
  google: {
    auth: 'https://accounts.google.com/o/oauth2/v2/auth',
    token: 'https://oauth2.googleapis.com/token',
    jwks: 'https://www.googleapis.com/oauth2/v3/certs',
    issuers: ['https://accounts.google.com', 'accounts.google.com'],
    scope: 'openid email profile',
    clientId: () => process.env.GOOGLE_CLIENT_ID
  },
  apple: {
    auth: 'https://appleid.apple.com/auth/authorize',
    token: 'https://appleid.apple.com/auth/token',
    jwks: 'https://appleid.apple.com/auth/keys',
    issuers: ['https://appleid.apple.com'],
    scope: 'name email',
    clientId: () => process.env.APPLE_CLIENT_ID
  }
};
export const meta = p => META[p];

/* ---------------- PKCE and the state row ---------------- */

export async function beginFlow(provider) {
  const state = b64url(randomBytes(24));
  const verifier = b64url(randomBytes(32));
  const nonce = b64url(randomBytes(16));
  const challenge = b64url(createHash('sha256').update(verifier).digest());
  await db()`
    INSERT INTO oauth_states (state, provider, verifier, nonce)
    VALUES (${state}, ${provider}, ${verifier}, ${nonce})`;
  return { state, verifier, nonce, challenge };
}

/** Read a state row and delete it in the same statement, so a replayed
    callback finds nothing. Ten minutes, same as every other code here. */
export async function consumeState(state, provider) {
  if (!state) return null;
  const rows = await db()`
    DELETE FROM oauth_states
    WHERE state = ${state} AND provider = ${provider}
      AND created_at > now() - interval '10 minutes'
    RETURNING verifier, nonce`;
  return rows[0] || null;
}

/* ---------------- Apple's client secret is a signed JWT ---------------- */

function appleClientSecret() {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'ES256', kid: process.env.APPLE_KEY_ID, typ: 'JWT' };
  const claims = {
    iss: process.env.APPLE_TEAM_ID,
    iat: now,
    exp: now + 600,
    aud: 'https://appleid.apple.com',
    sub: process.env.APPLE_CLIENT_ID
  };
  const signing = b64url(JSON.stringify(header)) + '.' + b64url(JSON.stringify(claims));
  /* The .p8 arrives from an environment variable, where real newlines do
     not survive every dashboard, so \n is accepted as an escape too. */
  const pem = String(process.env.APPLE_PRIVATE_KEY || '').replace(/\\n/g, '\n');
  const sig = createSign('SHA256').update(signing).end()
    .sign({ key: pem, dsaEncoding: 'ieee-p1363' });
  return signing + '.' + b64url(sig);
}

/* ---------------- token exchange ---------------- */

export async function exchangeCode(provider, code, verifier, uri) {
  const m = META[provider];
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: uri,
    code_verifier: verifier,
    client_id: m.clientId(),
    client_secret: provider === 'apple' ? appleClientSecret() : process.env.GOOGLE_CLIENT_SECRET
  });
  const res = await fetch(m.token, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
    signal: AbortSignal.timeout(8000)
  });
  const text = await res.text();
  if (!res.ok) {
    /* The provider's own error text is not shown to the browser: it can
       name the client id. It goes no further than this throw. */
    throw Object.assign(new Error('Token exchange failed: ' + res.status), { statusCode: 502 });
  }
  try { return JSON.parse(text); }
  catch { throw Object.assign(new Error('Token endpoint returned nothing usable.'), { statusCode: 502 }); }
}

/* ---------------- id_token verification ---------------- */

const jwksCache = new Map();
async function jwks(provider) {
  const hit = jwksCache.get(provider);
  if (hit && hit.until > Date.now()) return hit.keys;
  const res = await fetch(META[provider].jwks, { signal: AbortSignal.timeout(6000) });
  if (!res.ok) throw Object.assign(new Error('Could not read the signing keys.'), { statusCode: 502 });
  const body = await res.json();
  const keys = body.keys || [];
  jwksCache.set(provider, { keys, until: Date.now() + 3600e3 });
  return keys;
}

const ALGS = { RS256: 'RSA-SHA256', ES256: 'sha256' };

/**
 * Verify an id_token and return its claims.
 * Throws on anything that does not check out. There is no partial pass.
 */
export async function verifyIdToken(provider, idToken, expectedNonce) {
  const parts = String(idToken || '').split('.');
  if (parts.length !== 3) throw Object.assign(new Error('Malformed identity token.'), { statusCode: 502 });

  const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
  const claims = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
  if (!ALGS[header.alg]) throw Object.assign(new Error('Unsupported token algorithm.'), { statusCode: 502 });

  const key = (await jwks(provider)).find(k => k.kid === header.kid);
  if (!key) throw Object.assign(new Error('Identity token was signed by an unknown key.'), { statusCode: 502 });

  const pub = createPublicKey({ key, format: 'jwk' });
  const signed = parts[0] + '.' + parts[1];
  const sig = Buffer.from(parts[2], 'base64url');
  const ok = header.alg === 'ES256'
    ? createVerify('sha256').update(signed).end()
      .verify({ key: pub, dsaEncoding: 'ieee-p1363' }, sig)
    : createVerify('RSA-SHA256').update(signed).end().verify(pub, sig);
  if (!ok) throw Object.assign(new Error('Identity token signature did not verify.'), { statusCode: 401 });

  const now = Math.floor(Date.now() / 1000);
  const m = META[provider];
  if (!m.issuers.includes(claims.iss)) throw Object.assign(new Error('Identity token came from the wrong issuer.'), { statusCode: 401 });
  const aud = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (!aud.includes(m.clientId())) throw Object.assign(new Error('Identity token was issued for a different app.'), { statusCode: 401 });
  if (!claims.exp || claims.exp < now - 60) throw Object.assign(new Error('Identity token has expired.'), { statusCode: 401 });
  if (claims.iat && claims.iat > now + 300) throw Object.assign(new Error('Identity token is not valid yet.'), { statusCode: 401 });
  /* The nonce is what ties this token to the redirect this browser
     started. Without it a token minted for another session would pass
     every other check here. */
  if (expectedNonce && claims.nonce !== expectedNonce) {
    throw Object.assign(new Error('Identity token did not match this sign in.'), { statusCode: 401 });
  }
  return claims;
}

/** Apple sends email_verified as the string "true" often enough that a
    strict === true would reject real sign-ins. */
export const truthy = v => v === true || v === 'true';
