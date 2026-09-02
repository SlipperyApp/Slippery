import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verifyStripeSignature, planStateAfterFailure, accountRoutes } from '@/lib/server/stripe';
import { verifySecret, callbackData, PREFIX } from '@/lib/server/telegram';
import { authoriseCron } from '@/lib/server/cron';
import { createHmac } from 'node:crypto';
import { ENV_NAMES, appPasswordShaped, capabilities, emailCredentials, read } from '@/lib/server/env';
import { emailHealth, smtpSettings } from '@/lib/server/mail';
import { bareAddress } from '@/lib/server/codes';

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


// ------------------------------------------- the webhook's route to an account

/*  The shapes Stripe actually sends, trimmed to the fields that matter.
 *  These are the four events the webhook handles, and the point of the test
 *  is the asymmetry between them: two state the account and two do not. */

const SESSION = {
  object: 'checkout.session',
  client_reference_id: 'acc-1',
  customer: 'cus_1',
  subscription: 'sub_1',
};

const SUBSCRIPTION = {
  object: 'subscription',
  id: 'sub_1',
  customer: 'cus_1',
  metadata: { account_id: 'acc-1' },
};

/*  An invoice. No client_reference_id, and its metadata is its OWN: Stripe
 *  does not copy subscription metadata down onto invoices. This is the shape
 *  that made two branches of the webhook dead code. */
const INVOICE = {
  object: 'invoice',
  id: 'in_1',
  customer: 'cus_1',
  subscription: 'sub_1',
  metadata: {},
};

test('a session and a subscription say which account they are for', () => {
  assert.equal(accountRoutes(SESSION).stated, 'acc-1');
  assert.equal(accountRoutes(SUBSCRIPTION).stated, 'acc-1');
});

test('an invoice does NOT, and this is why it must be looked up', () => {
  const r = accountRoutes(INVOICE);
  assert.equal(r.stated, '', 'if this ever has a value, Stripe changed and the lookup can be simplified');
  // Which leaves these two, both stored on the account at checkout.
  assert.equal(r.customer, 'cus_1');
  assert.equal(r.subscription, 'sub_1');
});

test('every event the webhook handles offers at least one route back', () => {
  for (const [name, object] of [['session', SESSION], ['subscription', SUBSCRIPTION], ['invoice', INVOICE]] as const) {
    const r = accountRoutes(object);
    assert.ok(
      r.stated || r.subscription || r.customer,
      `${name} gives the webhook no way to find the account, so its branch is dead`,
    );
  }
});

test('either set of email variable names works, and the explicit one wins', () => {
  /*  The deployment carries GMAIL_USER, GMAIL_APP_PASSWORD and MAIL_FROM,
   *  set by hand before this code existed. The code reads EMAIL_API_KEY and
   *  EMAIL_FROM. While those disagree NOBODY CAN COMPLETE A SIGNUP: a code is
   *  generated, hashed, stored and never sent.
   *
   *  Reading both is the fix nobody has to deploy. This pins the precedence,
   *  because getting it backwards would silently authenticate as the wrong
   *  account. */
  const keys = ['EMAIL_API_KEY', 'EMAIL_FROM', 'GMAIL_USER', 'GMAIL_APP_PASSWORD', 'MAIL_FROM'] as const;
  const saved = Object.fromEntries(keys.map((k) => [k, process.env[k]]));
  const set = (v: Partial<Record<typeof keys[number], string | undefined>>) => {
    for (const k of keys) {
      if (v[k] === undefined) delete process.env[k];
      else process.env[k] = v[k];
    }
  };

  try {
    set({});
    assert.equal(emailCredentials(), null, 'neither set: nothing is sent');

    set({ GMAIL_USER: 'a@gmail.com', GMAIL_APP_PASSWORD: 'app pass', MAIL_FROM: 'a@gmail.com' });
    assert.deepEqual(emailCredentials(), { key: 'app pass', from: 'a@gmail.com', user: 'a@gmail.com' });

    set({ EMAIL_API_KEY: 're_x', EMAIL_FROM: 'b@slippery.app', GMAIL_APP_PASSWORD: 'app pass', MAIL_FROM: 'a@gmail.com' });
    const both = emailCredentials()!;
    assert.equal(both.key, 're_x', 'EMAIL_API_KEY must win over GMAIL_APP_PASSWORD');
    assert.equal(both.from, 'b@slippery.app', 'EMAIL_FROM must win over MAIL_FROM');

    // Half a pair is not a pair: a password without an address sends nothing.
    set({ GMAIL_APP_PASSWORD: 'app pass' });
    assert.equal(emailCredentials(), null);
    set({ MAIL_FROM: 'a@gmail.com' });
    assert.equal(emailCredentials(), null);

    // The SMTP username is the account the app password belongs to.
    set({ GMAIL_USER: 'account@gmail.com', GMAIL_APP_PASSWORD: 'p', EMAIL_FROM: 'noreply@slippery.app' });
    assert.equal(emailCredentials()!.user, 'account@gmail.com');
    assert.equal(emailCredentials()!.from, 'noreply@slippery.app');
  } finally {
    set(saved as Record<typeof keys[number], string | undefined>);
  }
});

// ----------------------------------------------------- the Gmail credential

/*  Placeholders throughout. "abcd efgh ijkl mnop" is the SHAPE of a Google
 *  App Password and is not one: sixteen lowercase letters in four groups. The
 *  repository is public and GitHub's scanner revokes what it finds. */
const EMAIL_KEYS = ['EMAIL_API_KEY', 'EMAIL_FROM', 'EMAIL_SMTP_HOST', 'EMAIL_SMTP_PORT', 'GMAIL_USER', 'GMAIL_APP_PASSWORD', 'MAIL_FROM'] as const;

function withEmailEnv<T>(vars: Partial<Record<typeof EMAIL_KEYS[number], string>>, fn: () => T): T {
  const saved = Object.fromEntries(EMAIL_KEYS.map((k) => [k, process.env[k]]));
  for (const k of EMAIL_KEYS) delete process.env[k];
  Object.assign(process.env, vars);
  try {
    return fn();
  } finally {
    for (const k of EMAIL_KEYS) delete process.env[k];
    for (const [k, v] of Object.entries(saved)) if (v !== undefined) process.env[k] = v;
  }
}

test('the spaces Google prints an app password with are stripped, and nothing else is', () => {
  /*  Google's dialog shows the password in four groups of four and copying
   *  what is on the screen is the obvious thing to do. Gmail then answers
   *  535 5.7.8 to it, because the spaces are presentation. An evening lost to
   *  a refusal that names no cause.
   *
   *  Narrow on purpose: only a value that is exactly sixteen lowercase
   *  letters in four groups is touched, so a real passphrase for some other
   *  SMTP host keeps every character it was given. */
  withEmailEnv({ GMAIL_USER: 'account@example.com', GMAIL_APP_PASSWORD: 'abcd efgh ijkl mnop' }, () => {
    assert.equal(emailCredentials()!.key, 'abcdefghijklmnop');
    assert.equal(appPasswordShaped(), true);
  });
  withEmailEnv({ GMAIL_USER: 'account@example.com', GMAIL_APP_PASSWORD: 'abcdefghijklmnop' }, () => {
    assert.equal(emailCredentials()!.key, 'abcdefghijklmnop');
  });
  // Not app password shaped: five groups, digits, a real passphrase.
  for (const kept of ['abcd efgh ijkl mnop qrst', 'ab cd ef gh', 'correct horse battery staple', 'a b']) {
    withEmailEnv({ GMAIL_USER: 'account@example.com', GMAIL_APP_PASSWORD: kept }, () => {
      assert.equal(emailCredentials()!.key, kept, `${kept} must survive untouched`);
      assert.equal(appPasswordShaped(), false);
    });
  }
});

test('a variable pasted with a trailing newline still works', () => {
  /*  read() tested trim() for emptiness and then returned the untrimmed
   *  value. A newline on EMAIL_FROM is a header injection refusal on every
   *  send and a newline on EMAIL_SMTP_HOST is a name that never resolves,
   *  and neither error mentions whitespace. */
  withEmailEnv({ GMAIL_USER: ' account@example.com\n', GMAIL_APP_PASSWORD: 'abcdefghijklmnop\n', EMAIL_SMTP_HOST: 'smtp.example.com\n' }, () => {
    const c = emailCredentials()!;
    assert.equal(c.user, 'account@example.com');
    assert.equal(c.key, 'abcdefghijklmnop');
    assert.equal(read('EMAIL_SMTP_HOST'), 'smtp.example.com');
  });
});

test('a From carrying a display name gives a username that can authenticate', () => {
  /*  MAIL_FROM is exactly the variable somebody sets to `Slippery <post@...>`.
   *  That is a correct From header and a username that authenticates as
   *  nobody, and an envelope Gmail answers 555 to. */
  withEmailEnv({ MAIL_FROM: 'Slippery <post@example.com>', GMAIL_APP_PASSWORD: 'abcdefghijklmnop' }, () => {
    const c = emailCredentials()!;
    assert.equal(c.from, 'Slippery <post@example.com>', 'the header keeps the display name');
    assert.equal(c.user, 'post@example.com', 'the username does not');
  });
  assert.equal(bareAddress('Slippery <post@example.com>'), 'post@example.com');
  assert.equal(bareAddress('post@example.com'), 'post@example.com');
  assert.equal(bareAddress('  post@example.com  '), 'post@example.com');
});

test('the SMTP defaults are Gmail, and a nonsense port does not become NaN', () => {
  withEmailEnv({}, () => assert.deepEqual(smtpSettings(), { host: 'smtp.gmail.com', port: 465, tls: 'implicit' }));
  withEmailEnv({ EMAIL_SMTP_PORT: '587' }, () => assert.equal(smtpSettings().tls, 'starttls'));
  for (const junk of ['', 'yes', '0', '-1', '70000', '465.5']) {
    withEmailEnv({ EMAIL_SMTP_PORT: junk }, () => {
      assert.equal(smtpSettings().port, 465, `${JSON.stringify(junk)} must fall back rather than connect to NaN`);
    });
  }
});

test('the email health report is booleans and never a value', () => {
  /*  It is served by GET /api/sources on a public deployment. The rule there
   *  is absolute, so it is asserted against the actual values rather than
   *  read off the field names. */
  const values = {
    EMAIL_SMTP_HOST: 'smtp.private.example',
    EMAIL_SMTP_PORT: '2525',
    GMAIL_USER: 'account@example.com',
    GMAIL_APP_PASSWORD: 'abcdefghijklmnop',
    MAIL_FROM: 'Slippery <post@slippery.example>',
  };
  withEmailEnv(values, () => {
    const health = emailHealth();
    const json = JSON.stringify(health);
    for (const v of Object.values(values)) {
      assert.ok(!json.includes(v), `${v} reached the health report`);
    }
    for (const [k, v] of Object.entries(health)) {
      if (k === 'transport') { assert.ok(['smtp', 'resend', 'none'].includes(v as string)); continue; }
      assert.equal(typeof v, 'boolean', `${k} is not a boolean`);
    }
    assert.equal(health.configured, true);
    assert.equal(health.transport, 'smtp');
    assert.equal(health.gmailHost, false, 'EMAIL_SMTP_HOST is set, so this is not Gmail');
    assert.equal(health.knownPort, false, '2525 is not one of the three ports this client speaks on');
    assert.equal(health.fromIsAccount, false, 'the From is a different address to the account');
    assert.equal(health.appPasswordShaped, true);
  });

  withEmailEnv({}, () => {
    const health = emailHealth();
    assert.equal(health.configured, false);
    assert.equal(health.transport, 'none');
    assert.equal(health.gmailHost, true, 'unset means Gmail');
    assert.equal(health.implicitTls, true);
    assert.equal(health.appPasswordShaped, false);
  });

  withEmailEnv({ GMAIL_USER: 'account@example.com', GMAIL_APP_PASSWORD: 'abcdefghijklmnop' }, () => {
    assert.equal(emailHealth().fromIsAccount, true, 'no MAIL_FROM means the account is the sender');
  });
});
