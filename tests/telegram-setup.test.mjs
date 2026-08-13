/* Webhook registration.
 *
 * The point of these is the two properties that make self-registration
 * safe to run on a cron: it never writes when the webhook is already
 * right, and it never returns the token or the secret. Both are easy to
 * break with a one-line change and neither shows up in normal use.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ensureWebhook, webhookUrl, webhookStatus } from '../api/_lib/telegram-setup.js';

const TOKEN = 'test-token-not-a-real-one';

function stubFetch(handler) {
  const real = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), body: init && init.body ? JSON.parse(init.body) : null });
    return { json: async () => handler(String(url), calls[calls.length - 1].body) };
  };
  return { calls, restore: () => { globalThis.fetch = real; } };
}

function withEnv(vars, fn) {
  const saved = {};
  for (const k of Object.keys(vars)) { saved[k] = process.env[k];
    if (vars[k] == null) delete process.env[k]; else process.env[k] = vars[k]; }
  return (async () => {
    try { return await fn(); }
    finally {
      for (const k of Object.keys(saved)) {
        if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k];
      }
    }
  })();
}

test('with no token it does nothing at all', async () => {
  await withEnv({ TELEGRAM_BOT_TOKEN: null }, async () => {
    const f = stubFetch(() => ({ ok: true }));
    try {
      assert.deepEqual(await ensureWebhook(), { state: 'no-token' });
      assert.equal(f.calls.length, 0, 'it must not call Telegram without a token');
    } finally { f.restore(); }
  });
});

test('the stable production host wins over the per-deployment one', async () => {
  await withEnv({
    PUBLIC_URL: null,
    VERCEL_ENV: 'production',
    VERCEL_PROJECT_PRODUCTION_URL: 'slippery-iota.vercel.app',
    VERCEL_URL: 'slippery-abc123-preview.vercel.app'
  }, async () => {
    /* Pointing the bot at a preview deployment would move it off the
       stable domain the moment anybody pushed a branch. */
    assert.equal(webhookUrl(), 'https://slippery-iota.vercel.app/api/telegram');
  });
});

test('an explicit PUBLIC_URL beats everything', async () => {
  await withEnv({ PUBLIC_URL: 'https://slippery.app/', VERCEL_URL: 'x.vercel.app' }, async () => {
    assert.equal(webhookUrl(), 'https://slippery.app/api/telegram');
  });
});

test('an already correct webhook is left alone', async () => {
  await withEnv({
    TELEGRAM_BOT_TOKEN: TOKEN, PUBLIC_URL: 'https://slippery-iota.vercel.app',
    VERCEL_ENV: null, VERCEL_PROJECT_PRODUCTION_URL: null, VERCEL_URL: null
  }, async () => {
    const f = stubFetch(url => url.includes('getWebhookInfo')
      ? { ok: true, result: { url: 'https://slippery-iota.vercel.app/api/telegram', pending_update_count: 3 } }
      : { ok: true });
    try {
      const r = await ensureWebhook();
      assert.equal(r.state, 'ok');
      assert.equal(r.pending, 3);
      assert.equal(f.calls.length, 1, 'getWebhookInfo only, no write');
      assert.ok(!f.calls.some(c => c.url.includes('setWebhook')),
        'writing every tick would reset the pending queue and lose messages');
    } finally { f.restore(); }
  });
});

test('a wrong webhook is corrected, keeping the pending queue', async () => {
  await withEnv({
    TELEGRAM_BOT_TOKEN: TOKEN, TELEGRAM_WEBHOOK_SECRET: 'shh',
    PUBLIC_URL: 'https://slippery-iota.vercel.app',
    VERCEL_ENV: null, VERCEL_PROJECT_PRODUCTION_URL: null, VERCEL_URL: null
  }, async () => {
    const f = stubFetch(url => url.includes('getWebhookInfo')
      ? { ok: true, result: { url: 'https://old-domain.example/api/telegram' } }
      : { ok: true, result: true });
    try {
      const r = await ensureWebhook();
      assert.equal(r.state, 'registered');
      assert.equal(r.was, 'https://old-domain.example/api/telegram');
      const set = f.calls.find(c => c.url.includes('setWebhook'));
      assert.ok(set, 'a mismatch must be corrected');
      assert.equal(set.body.url, 'https://slippery-iota.vercel.app/api/telegram');
      assert.equal(set.body.secret_token, 'shh');
      assert.equal(set.body.drop_pending_updates, false,
        'a redeploy must not throw away slips forwarded while it was going out');
    } finally { f.restore(); }
  });
});

test('a bad token is reported, never thrown', async () => {
  /* The cron that calls this has other people's bets to settle. A broken
     bot must not stop that. */
  await withEnv({ TELEGRAM_BOT_TOKEN: TOKEN, PUBLIC_URL: 'https://x.example' }, async () => {
    const f = stubFetch(() => ({ ok: false, description: 'Unauthorized' }));
    try {
      const r = await ensureWebhook();
      assert.equal(r.state, 'rejected');
      assert.match(r.why, /Unauthorized/);
    } finally { f.restore(); }
  });
});

test('a network failure is reported, never thrown', async () => {
  await withEnv({ TELEGRAM_BOT_TOKEN: TOKEN, PUBLIC_URL: 'https://x.example' }, async () => {
    const real = globalThis.fetch;
    globalThis.fetch = async () => { throw new Error('socket hang up'); };
    try {
      const r = await ensureWebhook();
      assert.equal(r.state, 'unreachable');
    } finally { globalThis.fetch = real; }
  });
});

test('the status object never carries the token or the secret', async () => {
  await withEnv({
    TELEGRAM_BOT_TOKEN: TOKEN, TELEGRAM_WEBHOOK_SECRET: 'super-secret-value',
    PUBLIC_URL: 'https://slippery-iota.vercel.app'
  }, async () => {
    const f = stubFetch(url => url.includes('getMe')
      ? { ok: true, result: { username: 'SlipperyAppBot' } }
      : { ok: true, result: { url: 'https://slippery-iota.vercel.app/api/telegram' } });
    try {
      const s = await webhookStatus();
      const dumped = JSON.stringify(s);
      assert.ok(!dumped.includes(TOKEN), 'the bot token must never be echoed');
      assert.ok(!dumped.includes('super-secret-value'), 'the webhook secret must never be echoed');
      assert.equal(s.secretSet, true, 'presence is reportable, the value is not');
      assert.equal(s.bot, '@SlipperyAppBot');
      assert.equal(s.state, 'ok');
    } finally { f.restore(); }
  });
});

test('reading the status never registers anything', async () => {
  await withEnv({ TELEGRAM_BOT_TOKEN: TOKEN, PUBLIC_URL: 'https://slippery-iota.vercel.app' }, async () => {
    const f = stubFetch(url => url.includes('getMe')
      ? { ok: true, result: { username: 'SlipperyAppBot' } }
      : { ok: true, result: { url: 'https://somewhere-else.example/api/telegram' } });
    try {
      const s = await webhookStatus();
      assert.equal(s.state, 'elsewhere', 'it reports the mismatch');
      assert.ok(!f.calls.some(c => c.url.includes('setWebhook')),
        'loading a diagnostics page must not move the bot');
    } finally { f.restore(); }
  });
});
