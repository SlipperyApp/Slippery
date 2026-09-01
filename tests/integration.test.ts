import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verifyStripeSignature, planStateAfterFailure } from '@/lib/server/stripe';
import { verifySecret, callbackData, PREFIX } from '@/lib/server/telegram';
import { authoriseCron } from '@/lib/server/cron';
import { createHmac } from 'node:crypto';
import { ENV_NAMES, capabilities } from '@/lib/server/env';

// ------------------------------------------------------------- telegram

test('the webhook secret is required and a mismatch is refused', () => {
  delete process.env.TELEGRAM_WEBHOOK_SECRET;
  assert.equal(verifySecret('anything'), false, 'no secret configured must not accept anything');

  process.env.TELEGRAM_WEBHOOK_SECRET = 'a-real-secret-value';
  assert.equal(verifySecret('a-real-secret-value'), true);
  assert.equal(verifySecret('a-real-secret-valuX'), false);
  assert.equal(verifySecret(null), false);
  assert.equal(verifySecret(''), false);
  assert.equal(verifySecret('a-real-secret-value-longer'), false, 'a prefix must not pass');
  delete process.env.TELEGRAM_WEBHOOK_SECRET;
});

test('callback_data stays inside the 64 byte limit', () => {
  const long = 'x'.repeat(200);
  assert.ok(Buffer.byteLength(callbackData('confirm', long), 'utf8') <= 64);
  assert.equal(callbackData('confirm', 'abc'), 'confirm:abc');
});

test('the reply prefixes are fixed and scannable', () => {
  assert.deepEqual(Object.values(PREFIX), ['READ', 'TRACKING', 'FT', 'UNREADABLE', 'DUPLICATE', 'PAUSED', 'LINKED']);
  for (const p of Object.values(PREFIX)) assert.equal(p, p.toUpperCase());
});

// --------------------------------------------------------------- stripe

test('an unsigned or wrongly signed Stripe webhook is refused', () => {
  delete process.env.STRIPE_WEBHOOK_SECRET;
  assert.equal(verifyStripeSignature('{}', 't=1,v1=abc'), false, 'no secret must refuse');

  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test';
  const payload = '{"type":"invoice.payment_failed"}';
  const t = Math.floor(Date.now() / 1000);
  const good = createHmac('sha256', 'whsec_test').update(`${t}.${payload}`).digest('hex');

  assert.equal(verifyStripeSignature(payload, `t=${t},v1=${good}`), true);
  assert.equal(verifyStripeSignature(payload, `t=${t},v1=${'0'.repeat(64)}`), false);
  assert.equal(verifyStripeSignature('{"type":"other"}', `t=${t},v1=${good}`), false, 'a changed body must fail');
  assert.equal(verifyStripeSignature(payload, null), false);

  const old = t - 4000;
  const oldSig = createHmac('sha256', 'whsec_test').update(`${old}.${payload}`).digest('hex');
  assert.equal(verifyStripeSignature(payload, `t=${old},v1=${oldSig}`), false, 'a replay outside tolerance must fail');
  delete process.env.STRIPE_WEBHOOK_SECRET;
});

test('two failed payments means read only, and one does not', () => {
  assert.equal(planStateAfterFailure(1), 'past_due');
  assert.equal(planStateAfterFailure(2), 'read_only');
  assert.equal(planStateAfterFailure(7), 'read_only');
});

// ----------------------------------------------------------------- cron

test('the sweep refuses an unsigned call, and refuses everything without a secret', () => {
  delete process.env.CRON_SECRET;
  assert.equal(authoriseCron(new Request('https://x/api/cron/results')).ok, false);

  process.env.CRON_SECRET = 'cron-secret';
  assert.equal(authoriseCron(new Request('https://x/api/cron/results')).ok, false);
  assert.equal(authoriseCron(new Request('https://x/api/cron/results', {
    headers: { authorization: 'Bearer cron-secret' },
  })).ok, true);
  assert.equal(authoriseCron(new Request('https://x/api/cron/results', {
    headers: { authorization: 'Bearer wrong' },
  })).ok, false);
  assert.equal(authoriseCron(new Request('https://x/api/cron/results', {
    headers: { 'x-vercel-cron': '1' },
  })).ok, true);
  delete process.env.CRON_SECRET;
});

// ------------------------------------------------------------------ env

test('every capability names variables that exist in the table', () => {
  const known = new Set<string>(ENV_NAMES);
  for (const c of capabilities()) {
    assert.ok(c.needs.length > 0, `${c.id} names no variable`);
    for (const n of c.needs) assert.ok(known.has(n), `${c.id} needs unknown variable ${n}`);
    assert.ok(c.without.length > 10, `${c.id} does not say what happens without it`);
  }
});

test('a capability is not ready when its variables are absent', () => {
  const saved = { ...process.env };
  for (const n of ENV_NAMES) delete process.env[n];
  for (const c of capabilities()) assert.equal(c.ready, false, `${c.id} claims to be ready with nothing set`);
  Object.assign(process.env, saved);
});

// ---------------------------------------------------------------- admin

test('an admin lever refuses without the secret, and refuses a wrong one', async () => {
  const { authoriseAdmin } = await import('@/lib/server/admin');
  delete process.env.ADMIN_SECRET;
  assert.equal(authoriseAdmin(new Request('https://x', { headers: { 'x-admin-secret': 'anything' } })), false);

  process.env.ADMIN_SECRET = 'admin-secret-value';
  assert.equal(authoriseAdmin(new Request('https://x', { headers: { 'x-admin-secret': 'admin-secret-value' } })), true);
  assert.equal(authoriseAdmin(new Request('https://x', { headers: { 'x-admin-secret': 'admin-secret-valuX' } })), false);
  assert.equal(authoriseAdmin(new Request('https://x')), false);
  assert.equal(authoriseAdmin(new Request('https://x', { headers: { 'x-admin-secret': 'admin-secret-value-more' } })), false);
  delete process.env.ADMIN_SECRET;
});
