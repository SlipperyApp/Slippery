/* The two halves of a federated sign in.
 *
 *   GET /api/auth/oauth-start?provider=google   redirect out
 *   GET|POST /api/auth/oauth-callback           come back, sign in
 *
 * Apple posts the callback as form_post rather than a query string, and
 * sends the person's name exactly once, on the very first authorisation,
 * in a JSON field that never appears again. Both are handled below.
 *
 * ACCOUNT MATCHING, in order, and the order is the security property:
 *   1. an existing identity row for (provider, subject)  -> that account
 *   2. a VERIFIED email that matches an existing account -> link to it
 *   3. otherwise                                         -> a new account
 *
 * Step 2 only ever runs on an email the provider states it has verified.
 * Without that check, anyone who can get a provider to mint a token for
 * an address they do not own could walk into the matching account here.
 */
import { json, fail, clientIp } from '../http.js';
import { db, ensureSchema, configured as dbConfigured, uniqueViolation } from '../db.js';
import { createSession, setSessionCookie, nameProblem } from '../auth.js';
import { guard } from '../rate.js';
import { TRIAL_DAYS } from '../promo.js';
import {
  PROVIDERS, configured, redirectUri, meta, beginFlow, consumeState,
  exchangeCode, verifyIdToken, truthy
} from '../oauth.js';

/* Errors come back to a browser, not to fetch(), so they are a redirect
   carrying a short reason rather than a JSON body nobody would see. The
   reason is a fixed word from this file: provider text can name the client
   id and never reaches the URL. */
function bounce(res, reason) {
  res.statusCode = 302;
  res.setHeader('location', '/?signin=' + encodeURIComponent(reason));
  res.end();
}

async function readForm(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  return new URLSearchParams(Buffer.concat(chunks).toString('utf8'));
}

/* A display name has to satisfy the same rules the signup form enforces,
   or a federated account would exist that the ordinary rules would have
   refused. Derived from the address, stripped to the allowed alphabet, and
   given a numeric suffix until the unique index accepts it. */
async function freeName(seed) {
  const sql = db();
  let base = String(seed || '').split('@')[0].replace(/[^A-Za-z0-9_]/g, '').slice(0, 16);
  if (base.length < 3) base = 'slipper';
  for (let i = 0; i < 40; i++) {
    const candidate = i === 0 ? base : (base.slice(0, 16) + i);
    if (nameProblem(candidate)) continue;
    const taken = await sql`
      SELECT 1 FROM users WHERE name_lower = ${candidate.toLowerCase()} AND deleted_at IS NULL LIMIT 1`;
    if (!taken.length) return candidate;
  }
  return base.slice(0, 12) + Date.now().toString(36).slice(-4);
}

export async function start(req, res) {
  try {
    const provider = String((req.query && req.query.provider) || '').toLowerCase();
    if (!PROVIDERS.includes(provider)) return bounce(res, 'unknown-provider');
    if (!configured(provider)) return bounce(res, 'not-configured');
    if (!dbConfigured()) return bounce(res, 'unavailable');
    await ensureSchema();
    if (!(await guard(res, 'oauth:' + clientIp(req), 30, 900))) return;

    const { state, nonce, challenge } = await beginFlow(provider);
    const m = meta(provider);
    const params = new URLSearchParams({
      client_id: m.clientId(),
      redirect_uri: redirectUri(req),
      response_type: 'code',
      scope: m.scope,
      state,
      nonce,
      code_challenge: challenge,
      code_challenge_method: 'S256'
    });
    /* Apple will only send the scoped fields back if the response is a
       form post, and refuses the request outright otherwise. */
    if (provider === 'apple') params.set('response_mode', 'form_post');

    res.statusCode = 302;
    res.setHeader('location', m.auth + '?' + params.toString());
    res.end();
  } catch (err) {
    return fail(res, err, 'That sign in could not be started.');
  }
}

export async function callback(req, res) {
  try {
    if (!dbConfigured()) return bounce(res, 'unavailable');
    await ensureSchema();

    const form = req.method === 'POST' ? await readForm(req) : new URLSearchParams();
    const q = req.query || {};
    const get = k => form.get(k) || (Array.isArray(q[k]) ? q[k][0] : q[k]) || '';

    if (get('error')) return bounce(res, 'cancelled');
    const code = get('code');
    const state = get('state');
    if (!code || !state) return bounce(res, 'incomplete');

    /* The state row names its own provider, so the provider is not taken
       from the query string where anyone could set it. */
    let provider = null, row = null;
    for (const p of PROVIDERS) {
      row = await consumeState(state, p);
      if (row) { provider = p; break; }
    }
    if (!row) return bounce(res, 'expired');
    if (!configured(provider)) return bounce(res, 'not-configured');

    const tokens = await exchangeCode(provider, code, row.verifier, redirectUri(req));
    const claims = await verifyIdToken(provider, tokens.id_token, row.nonce);

    const subject = String(claims.sub || '');
    if (!subject) return bounce(res, 'incomplete');
    const email = String(claims.email || '').trim();
    const emailVerified = truthy(claims.email_verified);

    const sql = db();

    /* 1. Known identity. */
    let found = await sql`
      SELECT u.id FROM oauth_identities i JOIN users u ON u.id = i.user_id
      WHERE i.provider = ${provider} AND i.subject = ${subject} AND u.deleted_at IS NULL`;
    let userId = found[0] && found[0].id;

    /* 2. A verified address that already has an account here. Only ever a
       verified one: an unverified address must not be able to claim one. */
    if (!userId && email && emailVerified) {
      const byEmail = await sql`
        SELECT id FROM users WHERE email_lower = ${email.toLowerCase()} AND deleted_at IS NULL`;
      if (byEmail.length) {
        userId = byEmail[0].id;
        try {
          await sql`INSERT INTO oauth_identities (user_id, provider, subject, email)
                    VALUES (${userId}, ${provider}, ${subject}, ${email || null})`;
        } catch (err) { if (!uniqueViolation(err)) throw err; }
      }
    }

    /* 3. A new account. Verified here because the provider verified it;
       there is nothing for us to email a code to that they have not
       already proved. An unverified provider email creates an account that
       still has to verify, exactly like a password signup. */
    if (!userId) {
      if (!email) return bounce(res, 'no-email');
      const name = await freeName(email);
      const trialEnds = new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000);
      const made = await sql`
        INSERT INTO users (email, email_lower, display_name, name_lower, password_hash,
                           email_verified, age_confirmed, plan, trial_ends_at)
        VALUES (${email}, ${email.toLowerCase()}, ${name}, ${name.toLowerCase()}, '',
                ${emailVerified}, true, 'free', ${trialEnds})
        RETURNING id`;
      userId = made[0].id;
      await sql`INSERT INTO oauth_identities (user_id, provider, subject, email)
                VALUES (${userId}, ${provider}, ${subject}, ${email || null})`;
    }

    setSessionCookie(res, await createSession(userId));
    res.statusCode = 302;
    res.setHeader('location', '/?signin=ok');
    res.end();
  } catch (err) {
    /* Anything unexpected still lands the person back on a page rather
       than on a JSON error they cannot act on. */
    if (res.headersSent) return;
    return bounce(res, 'failed');
  }
}

/* The router dispatches on one path segment, so these arrive as two
   separate actions rather than one handler branching on the method. */
export default { start, callback };
