/* Every serverless function loads, and answers safely when unconfigured.
 *
 * A broken import in api/ is invisible until Vercel builds it, and a handler
 * that throws on a missing environment variable is invisible until someone
 * hits it in production. Both are cheap to catch here: import each handler,
 * call it with no DATABASE_URL set, and assert it answers with a 503 that
 * names what is missing rather than a 500 or an unhandled rejection.
 *
 * This is also the guard on method handling: a GET to a POST-only endpoint
 * must be a 405 with an Allow header, not a crash.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdir } from 'node:fs/promises';
import path from 'node:path';

const API = new URL('../api/', import.meta.url);

/** A minimal (req, res) pair shaped like the Node runtime's. */
function fakeRes() {
  const res = {
    statusCode: 200,
    headers: {},
    body: null,
    ended: false,
    setHeader(k, v) { this.headers[k.toLowerCase()] = v; },
    end(b) { this.body = b; this.ended = true; }
  };
  return res;
}
const fakeReq = (over = {}) => Object.assign({
  method: 'GET', headers: {}, url: '/', body: {},
  socket: { remoteAddress: '127.0.0.1' }
}, over);

/* Every module Vercel would turn into a function, plus the handlers behind
   the auth router. The router lives at api/auth/[action].js and the eight
   handlers it dispatches to live under api/_lib/routes/, where Vercel does
   not route them, because the Hobby plan allows twelve functions and eight
   auth files plus everything else is sixteen. */
const AUTH_ROUTES = ['forgot', 'login', 'logout', 'me', 'resend', 'reset', 'signup', 'verify'];
const authRoute = name => new URL('_lib/routes/' + name + '.js', API).href;

async function handlers() {
  const out = [];
  for (const entry of await readdir(API, { withFileTypes: true })) {
    if (entry.name.startsWith('_')) continue;
    if (entry.isDirectory()) {
      for (const f of await readdir(new URL(entry.name + '/', API))) {
        if (f.endsWith('.js')) out.push(entry.name + '/' + f);
      }
    } else if (entry.name.endsWith('.js')) out.push(entry.name);
  }
  for (const name of AUTH_ROUTES) out.push('_lib/routes/' + name + '.js');
  return out.sort();
}

test('the function count stays under what Vercel will actually deploy', async () => {
  /* Going over twelve does not warn: the build fails, the previous
     deployment keeps serving, and every push still reports success while
     the live site quietly stops changing. */
  const routed = [];
  const walk = async (dir, prefix) => {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      if (entry.name.startsWith('_')) continue;
      if (entry.isDirectory()) await walk(new URL(entry.name + '/', dir), prefix + entry.name + '/');
      else if (entry.name.endsWith('.js')) routed.push(prefix + entry.name);
    }
  };
  await walk(API, '');
  assert.ok(routed.length <= 12,
    'Vercel Hobby allows 12 serverless functions and api/ has ' + routed.length + ': ' + routed.join(', '));
});

test('every api handler imports cleanly and exports a default function', async () => {
  const files = await handlers();
  assert.ok(files.length >= 8, 'expected the api surface, found ' + files.length);
  for (const f of files) {
    const mod = await import(new URL(f, API).href);
    assert.equal(typeof mod.default, 'function', f + ' has no default export');
  }
});

test('an unsupported method is a 405 with an Allow header, never a crash', async () => {
  /* DELETE is not allowed anywhere except /api/bets. */
  for (const f of ['extract.js', 'settle.js', '_lib/routes/login.js', '_lib/routes/signup.js']) {
    const mod = await import(new URL(f, API).href);
    const res = fakeRes();
    await mod.default(fakeReq({ method: 'TRACE' }), res);
    assert.equal(res.statusCode, 405, f + ' answered ' + res.statusCode + ' to TRACE');
    assert.ok(res.headers.allow, f + ' returned 405 without an Allow header');
  }
});

test('without a database, endpoints answer 503 and name what is missing', async () => {
  const had = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;
  try {
    for (const [f, method] of [['bets.js', 'GET'], ['settle.js', 'POST'], ['_lib/routes/signup.js', 'POST']]) {
      const mod = await import(new URL(f, API).href);
      const res = fakeRes();
      await mod.default(fakeReq({ method }), res);
      assert.equal(res.statusCode, 503, f + ' answered ' + res.statusCode + ' with no database');
      const body = JSON.parse(res.body);
      assert.ok(body.error, f + ' gave no error message');
      assert.ok(Array.isArray(body.needs) && body.needs.length,
        f + ' did not say which variable is missing');
    }
  } finally {
    if (had !== undefined) process.env.DATABASE_URL = had;
  }
});

test('/api/auth/me reports "not configured" rather than failing', async () => {
  /* The client calls this on every load. It must answer even on a bare
     deployment, or the app cannot decide whether anyone is signed in. */
  const had = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;
  try {
    const mod = await import(authRoute('me'));
    const res = fakeRes();
    await mod.default(fakeReq({ method: 'GET' }), res);
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.equal(body.user, null);
    assert.equal(body.configured, false);
  } finally {
    if (had !== undefined) process.env.DATABASE_URL = had;
  }
});

test('the results sweep refuses an unauthorised caller before touching anything', async () => {
  /* It reads every pending bet in the database, so an open endpoint would
     be both a data leak and a way to burn the feed's rate limit. */
  const mod = await import(new URL('results.js', API).href);
  const res = fakeRes();
  await mod.default(fakeReq({ method: 'GET' }), res);
  assert.equal(res.statusCode, 401, 'the sweep answered ' + res.statusCode + ' without a secret');
});

test('every function path in vercel.json matches a file that exists', async () => {
  const { readFile } = await import('node:fs/promises');
  const cfg = JSON.parse(await readFile(new URL('../vercel.json', import.meta.url), 'utf8'));
  const files = await handlers();
  for (const pattern of Object.keys(cfg.functions || {})) {
    if (pattern.includes('*')) continue;
    const rel = pattern.replace(/^api\//, '');
    assert.ok(files.includes(rel), 'vercel.json configures ' + pattern + ', which does not exist');
  }
  for (const cron of cfg.crons || []) {
    const rel = cron.path.replace(/^\/api\//, '') + '.js';
    assert.ok(files.includes(rel), 'cron points at ' + cron.path + ', which does not exist');
  }
});

/* The auth router.
 *
 * The URLs did not change when eight files became one, so the thing worth
 * testing is that every one of them still resolves and that nothing else
 * does. `constructor` is in there on purpose: a plain property lookup on the
 * table would find Object.prototype.constructor and call it with (req, res).
 */
test('the auth router dispatches every action and refuses anything else', async () => {
  const mod = await import(new URL('auth/[action].js', API).href);
  for (const action of AUTH_ROUTES) {
    const res = fakeRes();
    /* TRACE is allowed nowhere, so a 405 proves the handler ran and a 404
       proves the router did not find it. Either way it is not a crash. */
    await mod.default(fakeReq({ method: 'TRACE', query: { action } }), res);
    assert.notEqual(res.statusCode, 404, action + ' did not reach its handler');
  }
  for (const action of ['constructor', 'toString', '__proto__', 'nope', '']) {
    const res = fakeRes();
    await mod.default(fakeReq({ method: 'GET', query: { action } }), res);
    assert.equal(res.statusCode, 404, JSON.stringify(action) + ' should not resolve to a handler');
  }
});

test('the auth router falls back to the path when there is no query', async () => {
  const mod = await import(new URL('auth/[action].js', API).href);
  const res = fakeRes();
  await mod.default(fakeReq({ method: 'TRACE', url: '/api/auth/login' }), res);
  assert.equal(res.statusCode, 405, 'the path segment should have selected login');
});
