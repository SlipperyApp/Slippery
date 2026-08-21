import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const read = (p: string) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

/* THE HARD SECURITY CONSTRAINTS, CHECKED RATHER THAN PROMISED. */

test('the secret key is never sent to a browser', () => {
  /* Any file that runs on the client: the view layer, the components, and
     anything they import. A route handler reading process.env is fine; a
     component doing it is a leak. */
  const client = [
    'lib/proto/runtime.js', 'lib/proto/actions.js', 'lib/proto/store.js',
    'components/AppShell.tsx', 'components/IconSprite.tsx',
  ];
  for (const f of client) {
    const src = read(f);
    assert.doesNotMatch(src, /STRIPE_SECRET_KEY/, f + ' names the secret key');
    assert.doesNotMatch(src, /sk_(test|live)_/, f + ' contains a secret key');
    assert.doesNotMatch(src, /STRIPE_WEBHOOK_SECRET/, f + ' names the webhook secret');
  }
});

test('no committed file contains a live or test secret key', () => {
  const skip = new Set(['node_modules', '.next', '.git', 'test-results', 'public']);
  const hits: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      if (skip.has(name)) continue;
      const p = join(dir, name);
      if (statSync(p).isDirectory()) { walk(p); continue; }
      if (!/\.(ts|tsx|js|mjs|json|md|css)$/.test(name)) continue;
      const src = readFileSync(p, 'utf8');
      /* The pattern, not a literal, so this test cannot itself be the hit. */
      if (new RegExp('sk_' + '(test|live)_[A-Za-z0-9]{10,}').test(src)) hits.push(p);
      if (new RegExp('whsec_' + '[A-Za-z0-9]{10,}').test(src)) hits.push(p);
    }
  };
  walk(process.cwd());
  assert.deepEqual(hits, []);
});

test('env files are ignored before any of them can be committed', () => {
  const gi = read('.gitignore');
  for (const pattern of ['.env', '.env.local', '.env*.local']) {
    assert.ok(gi.split('\n').includes(pattern), pattern + ' is not in .gitignore');
  }
});

/* A CLIENT-SET PRICE IS TRIVIALLY TAMPERED WITH. */
test('the client sends a plan name and never an amount', () => {
  const route = read('app/api/stripe/checkout/route.ts');
  assert.match(route, /STRIPE_PRICE_MONTHLY/);
  assert.match(route, /STRIPE_PRICE_YEARLY/);
  assert.doesNotMatch(route, /unit_amount/, 'an amount in the session is an amount the client could have set');
  assert.doesNotMatch(route, /price_data/, 'price_data builds a price at request time rather than using a fixed id');

  const client = read('lib/proto/runtime.js');
  assert.doesNotMatch(client, /unit_amount|amount:\s*\d/, 'the client is sending a number that looks like money');
});

test('the webhook verifies its signature and has no development bypass', () => {
  const hook = read('app/api/stripe/webhook/route.ts');
  assert.match(hook, /constructEvent/);
  assert.match(hook, /STRIPE_WEBHOOK_SECRET|stripeWebhookSecret/);
  assert.doesNotMatch(hook, /NODE_ENV.*!==.*production/, 'a development bypass is a production bypass');
});

test('the webhook handles the four events that change what somebody can do', () => {
  const hook = read('app/api/stripe/webhook/route.ts');
  for (const e of [
    'checkout.session.completed',
    'customer.subscription.updated',
    'customer.subscription.deleted',
    'invoice.payment_failed',
  ]) assert.match(hook, new RegExp(e.replace(/\./g, '\\.')), e + ' is not handled');
});

test('there is no trial-end reminder, deliberately', () => {
  const hook = read('app/api/stripe/webhook/route.ts');
  assert.match(hook, /trial_will_end/, 'the event should be handled explicitly');
  const branch = hook.slice(hook.indexOf('trial_will_end'), hook.indexOf('trial_will_end') + 400);
  assert.doesNotMatch(branch, /sendMail|fetch\(/, 'handling it must do nothing, or the reminder is back');
});

test('checkout uses hosted pages rather than card fields on this origin', () => {
  const route = read('app/api/stripe/checkout/route.ts');
  assert.match(route, /checkout\.sessions\.create/);
  assert.doesNotMatch(route, /paymentIntents\.create/, 'Elements would put this origin inside PCI scope');
});

/* THE FAKE CARD FORM. */
test('the card sheet collects nothing and links to the portal', () => {
  const client = read('lib/proto/runtime.js');
  assert.doesNotMatch(client, /4242/, 'the test card number is still in the markup');
  assert.doesNotMatch(client, /flabel">Card number/, 'the fake card field is still there');
  assert.match(client, /data-portal/);
});

test('success and cancel return to routes that exist', () => {
  const route = read('app/api/stripe/checkout/route.ts');
  const routes = read('lib/proto/routes.ts');
  for (const m of route.matchAll(/(success_url|cancel_url): env\.appUrl\(\) \+ '([^']+)'/g)) {
    assert.ok(routes.includes(`'${m[2]}'`), m[1] + ' points at ' + m[2] + ', which is not in the route table');
  }
});
