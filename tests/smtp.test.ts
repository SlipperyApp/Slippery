import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer as createTlsServer, TLSSocket } from 'node:tls';
import { createServer as createNetServer, type Socket } from 'node:net';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SMTP_DETAIL, probeSmtp, sendSmtp, tlsModeForPort, type SmtpFailure } from '@/lib/server/smtp';
import { sendEmail } from '@/lib/server/mail';

/*  The client is tested against a real SMTP conversation, over real TLS, on
 *  localhost. Nothing here reaches Gmail, and nothing needs a credential:
 *  what has to be proved is that the client says the right verbs in the right
 *  order, never says the password on a socket that is not encrypted, encodes
 *  the body so a middle dot survives, and reports the exact step a server
 *  refused at rather than one generic failure covering four causes.
 *
 *  The certificate is generated in-process for each run. A self-signed
 *  certificate is only ever accepted through insecureTls, which is a test-only
 *  option and is never set by lib/server/mail.ts, which is itself asserted
 *  below rather than assumed.
 *
 *  NO REAL ADDRESS, PASSWORD OR CODE APPEARS IN THIS FILE. Everything is at
 *  example.com, which RFC 2606 reserves, and the passwords are the literal
 *  word "placeholder" in various shapes. The repository is public. */

/** A throwaway self-signed certificate for localhost.
 *
 *  Written with the openssl binary rather than by hand: a hand-rolled X.509
 *  is a second protocol implementation to get right, and this one is scaffold
 *  rather than product. Where openssl is absent every socket test skips and
 *  says so; the ones that do not need a socket still run. */
let CERT: { key: string; cert: string } | null | undefined;
function certs(): { key: string; cert: string } | null {
  if (CERT !== undefined) return CERT;
  try {
    const dir = mkdtempSync(join(tmpdir(), 'slip-smtp-'));
    const key = join(dir, 'k.pem');
    const cert = join(dir, 'c.pem');
    execFileSync('openssl', [
      'req', '-x509', '-newkey', 'rsa:2048',
      '-keyout', key, '-out', cert,
      '-days', '1', '-nodes', '-subj', '/CN=localhost',
    ], { stdio: 'ignore' });
    CERT = { key: readFileSync(key, 'utf8'), cert: readFileSync(cert, 'utf8') };
  } catch {
    CERT = null;
  }
  return CERT;
}

/** One line the server was sent, and whether the socket carrying it was
 *  encrypted at the time. The second half is the whole point of the STARTTLS
 *  tests: a transcript alone cannot tell you the password went out in clear. */
type Entry = { line: string; secure: boolean };
type Script = { entries: Entry[]; body: string };

type Refusals = Partial<Record<
  'greeting' | 'ehlo' | 'starttls' | 'auth' | 'user' | 'pass' | 'mail' | 'rcpt' | 'data' | 'body',
  string
>>;

type Opts = {
  /*  implicit  TLS from the first byte, which is what port 465 is.
      starttls  a plain socket that advertises STARTTLS and upgrades.
      plain     a plain socket that never offers STARTTLS. */
  mode?: 'implicit' | 'starttls' | 'plain';
  refuse?: Refusals;
  /** The mechanisms after AUTH in the EHLO reply. null omits the line. */
  auth?: string | null;
  /** Accept the socket and never greet, so the read guard has to fire. */
  silent?: boolean;
};

type Fake = { port: number; done: Promise<Script>; close(): void };

function fakeSmtp(o: Opts = {}): Promise<Fake | null> {
  const pair = certs();
  if (!pair) return Promise.resolve(null);
  const mode = o.mode ?? 'implicit';

  const entries: Entry[] = [];
  let body = '';
  let settle: (s: Script) => void = () => {};
  const done = new Promise<Script>((r) => { settle = r; });
  let settled = false;
  /*  Resolved by whichever comes first: QUIT, the socket ending, or a three
   *  second stop. A test that hangs tells you nothing; a test that fails
   *  tells you where. */
  const finish = () => { if (!settled) { settled = true; settle({ entries, body }); } };
  setTimeout(finish, 3000).unref();

  const live = new Set<Socket | TLSSocket>();

  const onConnection = (raw: Socket | TLSSocket) => {
    live.add(raw);
    let current: Socket | TLSSocket = raw;
    let secure = mode === 'implicit';
    let inData = false;
    let expecting: 'none' | 'user' | 'pass' = 'none';
    let buf = '';

    const say = (s: string) => { try { current.write(s); } catch { /* gone */ } };

    const ehloReply = (): string => {
      const ext = ['localhost', 'SIZE 35882577'];
      // Gmail advertises STARTTLS before the upgrade and AUTH only after it.
      if (mode === 'starttls' && !secure) ext.push('STARTTLS');
      const mechanisms = o.auth === undefined ? 'LOGIN PLAIN' : o.auth;
      if (mechanisms !== null && (mode === 'implicit' || secure)) ext.push(`AUTH ${mechanisms}`);
      return ext.map((e, i) => `250${i === ext.length - 1 ? ' ' : '-'}${e}\r\n`).join('');
    };

    const upgrade = () => {
      raw.removeAllListeners();
      const tls = new TLSSocket(raw as Socket, { isServer: true, key: pair.key, cert: pair.cert });
      live.add(tls);
      current = tls;
      secure = true;
      buf = '';
      bind(tls);
    };

    const handle = (line: string) => {
      if (inData) {
        if (line === '.') { inData = false; say(o.refuse?.body ?? '250 2.0.0 Ok: queued\r\n'); return; }
        body += `${line}\r\n`;
        return;
      }
      entries.push({ line, secure });

      /*  Checked before the verb table, because a base64 credential line is
       *  arbitrary text and could begin with any four letters. */
      if (expecting === 'user') { expecting = 'pass'; say(o.refuse?.user ?? '334 UGFzc3dvcmQ6\r\n'); return; }
      if (expecting === 'pass') { expecting = 'none'; say(o.refuse?.pass ?? '235 2.7.0 Accepted\r\n'); return; }

      const verb = line.split(' ')[0].toUpperCase();
      if (verb === 'EHLO') { say(o.refuse?.ehlo ?? ehloReply()); return; }
      if (verb === 'STARTTLS') {
        if (o.refuse?.starttls) { say(o.refuse.starttls); return; }
        // Flushed before the handle changes hands, or the client never sees it.
        current.write('220 2.0.0 Ready to start TLS\r\n', () => upgrade());
        return;
      }
      if (verb === 'AUTH') {
        if (o.refuse?.auth) { say(o.refuse.auth); return; }
        expecting = 'user';
        say('334 VXNlcm5hbWU6\r\n');
        return;
      }
      if (verb === 'MAIL') { say(o.refuse?.mail ?? '250 2.1.0 Ok\r\n'); return; }
      if (verb === 'RCPT') { say(o.refuse?.rcpt ?? '250 2.1.5 Ok\r\n'); return; }
      if (verb === 'DATA') {
        if (o.refuse?.data) { say(o.refuse.data); return; }
        inData = true;
        say('354 End data with <CR><LF>.<CR><LF>\r\n');
        return;
      }
      if (verb === 'QUIT') { say('221 Bye\r\n'); current.end(); finish(); return; }
      say('502 5.5.2 Not implemented\r\n');
    };

    function bind(s: Socket | TLSSocket) {
      s.on('data', (chunk: Buffer | string) => {
        buf += chunk.toString();
        let i = buf.indexOf('\r\n');
        while (i !== -1) {
          const line = buf.slice(0, i);
          buf = buf.slice(i + 2);
          handle(line);
          i = buf.indexOf('\r\n');
        }
      });
      s.on('error', finish);
      s.on('close', finish);
      s.on('end', finish);
    }

    bind(raw);
    if (o.silent) return;
    say(o.refuse?.greeting ?? '220 localhost ESMTP fake\r\n');
  };

  const server = mode === 'implicit'
    ? createTlsServer({ key: pair.key, cert: pair.cert }, onConnection)
    : createNetServer(onConnection);

  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      resolve({
        port: (server.address() as { port: number }).port,
        done,
        close() {
          for (const s of live) s.destroy();
          server.close();
          finish();
        },
      });
    });
  });
}

/** The message every test sends unless it needs a different one. */
const MESSAGE = {
  user: 'account@example.com',
  pass: 'placeholderplaceholder',
  from: 'account@example.com',
  to: 'punter@example.com',
  subject: 'Your Slippery code',
  // The middle dot is the reason the body is base64: it is not ASCII, and it
  // is in every verification email this product sends.
  text: 'Your code is 481920.\n\n18+ · BeGambleAware.org',
} as const;

/*  Matched against the verb list rather than "looks like capitals": STARTTLS
 *  is eight letters and slipped past a /^[A-Z]{4}\b/ filter, so the first
 *  version of this asserted a STARTTLS conversation that had no STARTTLS in
 *  the sequence it checked. */
const VERB = /^(EHLO|HELO|STARTTLS|AUTH|MAIL|RCPT|DATA|QUIT|RSET)\b/;
const verbsOf = (s: Script) => s.entries.map((e) => e.line).filter((l) => VERB.test(l)).map((l) => l.split(' ')[0]);
const base64Of = (s: Script) => s.entries.map((e) => e.line).filter((l) => /^[A-Za-z0-9+/]+={0,2}$/.test(l) && l.length > 8);
const split = (s: Script) => {
  const at = s.body.indexOf('\r\n\r\n');
  return { headers: s.body.slice(0, at), payload: s.body.slice(at + 4) };
};

// ------------------------------------------------------- the happy path

test('a message goes out as a correct SMTP conversation, entirely over TLS', async (t) => {
  const fake = await fakeSmtp();
  if (!fake) return t.skip('no openssl in this environment');
  const res = await sendSmtp({ host: '127.0.0.1', port: fake.port, insecureTls: true, timeoutMs: 5000, ...MESSAGE });
  const script = await fake.done;
  fake.close();

  assert.equal(res.sent, true, JSON.stringify(res));
  assert.deepEqual(verbsOf(script), ['EHLO', 'AUTH', 'MAIL', 'RCPT', 'DATA', 'QUIT']);
  assert.ok(script.entries.every((e) => e.secure), 'every line must arrive over TLS on an implicit TLS port');

  assert.ok(script.entries.some((e) => e.line === 'MAIL FROM:<account@example.com>'));
  assert.ok(script.entries.some((e) => e.line === 'RCPT TO:<punter@example.com>'));

  /*  AUTH LOGIN, then the username, then the password, each after its own 334
   *  and each base64. Asserted as a sequence rather than as a set: sending
   *  both halves before the prompt is a conversation Gmail drops. */
  const authAt = script.entries.findIndex((e) => e.line.startsWith('AUTH'));
  assert.equal(script.entries[authAt].line, 'AUTH LOGIN');
  assert.equal(Buffer.from(script.entries[authAt + 1].line, 'base64').toString('utf8'), MESSAGE.user);
  assert.equal(Buffer.from(script.entries[authAt + 2].line, 'base64').toString('utf8'), MESSAGE.pass);
  assert.equal(base64Of(script).length, 2, 'exactly two base64 lines: the username and the password');

  const { headers, payload } = split(script);
  const header = (name: string) => headers.split('\r\n').filter((l) => l.startsWith(`${name}: `));
  for (const name of ['From', 'To', 'Subject', 'Date', 'Message-ID', 'MIME-Version', 'Content-Type', 'Content-Transfer-Encoding']) {
    assert.equal(header(name).length, 1, `${name} must appear exactly once`);
  }
  assert.equal(header('From')[0], 'From: account@example.com');
  assert.equal(header('To')[0], 'To: punter@example.com');
  assert.equal(header('Subject')[0], 'Subject: Your Slippery code');
  assert.equal(header('Content-Transfer-Encoding')[0], 'Content-Transfer-Encoding: base64');
  assert.match(header('Content-Type')[0], /charset=utf-8/);
  // A Date that Date.parse cannot read is a Date some filters score against.
  assert.ok(Number.isFinite(Date.parse(header('Date')[0].slice(6))), 'the Date header must parse');

  /*  The right hand side of a Message-ID has to be a domain. This was
   *  `<uuid@slippery>` for a while, a bare label with no dot in it, which
   *  several filters score as forged. */
  const id = /^Message-ID: <([^>]+)>$/.exec(header('Message-ID')[0]);
  assert.ok(id, 'Message-ID must be angle bracketed');
  assert.match(id![1].split('@')[1] ?? '', /\./, 'the Message-ID domain must be a domain, not a label');

  // Base64 in lines a mail server will not fold for us, and back out again.
  for (const line of payload.trim().split('\r\n')) {
    assert.ok(line.length <= 76, `a body line is ${line.length} characters, over the 76 limit`);
    assert.match(line, /^[A-Za-z0-9+/]+={0,2}$/);
  }
  assert.equal(
    Buffer.from(payload.replace(/\r\n/g, ''), 'base64').toString('utf8'),
    'Your code is 481920.\r\n\r\n18+ · BeGambleAware.org',
  );
});

test('the From header and the envelope sender are allowed to differ', async (t) => {
  /*  Gmail only accepts the authenticated account as the envelope sender, so
   *  a product sending from its own domain has to put one address in MAIL
   *  FROM and another in the From header. The first version used one string
   *  for both, so a MAIL_FROM of `Slippery <post@example.com>` produced
   *  `MAIL FROM:<Slippery <post@example.com>>`, which is a syntax error. */
  const fake = await fakeSmtp();
  if (!fake) return t.skip('no openssl in this environment');
  const res = await sendSmtp({
    ...MESSAGE,
    host: '127.0.0.1',
    port: fake.port,
    insecureTls: true,
    timeoutMs: 5000,
    from: 'Slippery <post@slippery.example>',
    envelopeFrom: 'account@example.com',
  });
  const script = await fake.done;
  fake.close();

  assert.equal(res.sent, true, JSON.stringify(res));
  assert.ok(script.entries.some((e) => e.line === 'MAIL FROM:<account@example.com>'), 'the envelope takes the bare account address');
  const { headers } = split(script);
  assert.match(headers, /^From: Slippery <post@slippery\.example>$/m, 'the header keeps the display name');
  // Derived from the envelope, which is the domain that actually sent it.
  assert.match(headers, /^Message-ID: <[^>]+@example\.com>$/m);
});

test('a display name in the from address is stripped out of the envelope even without an explicit one', async (t) => {
  const fake = await fakeSmtp();
  if (!fake) return t.skip('no openssl in this environment');
  const res = await sendSmtp({
    ...MESSAGE,
    host: '127.0.0.1',
    port: fake.port,
    insecureTls: true,
    timeoutMs: 5000,
    from: 'Slippery <post@slippery.example>',
  });
  const script = await fake.done;
  fake.close();
  assert.equal(res.sent, true, JSON.stringify(res));
  assert.ok(script.entries.some((e) => e.line === 'MAIL FROM:<post@slippery.example>'));
});

// --------------------------------------------------- encoding and framing

test('a lone dot in the body does not end the message early', async (t) => {
  /*  A line of a single dot terminates DATA. Base64 is what protects this
   *  product from it, because base64 never produces a leading dot, and
   *  dotStuff() in the client is the belt for the day somebody switches the
   *  body to 7bit. Proved by outcome: the text goes in with a dot on its own
   *  line and comes back out with one, and the conversation still reaches
   *  QUIT rather than desynchronising. */
  const fake = await fakeSmtp();
  if (!fake) return t.skip('no openssl in this environment');
  const text = 'Your code is 481920.\n.\nThat dot is on a line of its own.\n..\nSo is that.';
  const res = await sendSmtp({ ...MESSAGE, host: '127.0.0.1', port: fake.port, insecureTls: true, timeoutMs: 5000, text });
  const script = await fake.done;
  fake.close();

  assert.equal(res.sent, true, JSON.stringify(res));
  assert.deepEqual(verbsOf(script), ['EHLO', 'AUTH', 'MAIL', 'RCPT', 'DATA', 'QUIT']);
  const { payload } = split(script);
  assert.ok(!payload.split('\r\n').includes('.'), 'no payload line may be a bare dot on the wire');
  assert.equal(
    Buffer.from(payload.replace(/\r\n/g, ''), 'base64').toString('utf8'),
    text.replace(/\n/g, '\r\n'),
  );
});

test('every line ending goes out as CRLF, and one already CRLF is not doubled', async (t) => {
  for (const text of ['one\ntwo\nthree', 'one\r\ntwo\r\nthree']) {
    const fake = await fakeSmtp();
    if (!fake) return t.skip('no openssl in this environment');
    const res = await sendSmtp({ ...MESSAGE, host: '127.0.0.1', port: fake.port, insecureTls: true, timeoutMs: 5000, text });
    const script = await fake.done;
    fake.close();
    assert.equal(res.sent, true, JSON.stringify(res));
    const decoded = Buffer.from(split(script).payload.replace(/\r\n/g, ''), 'base64').toString('utf8');
    assert.equal(decoded, 'one\r\ntwo\r\nthree', `${JSON.stringify(text)} did not normalise`);
  }
});

test('a non-ASCII subject is encoded, and an ASCII one is left readable', async (t) => {
  const fake = await fakeSmtp();
  if (!fake) return t.skip('no openssl in this environment');
  const res = await sendSmtp({
    ...MESSAGE, host: '127.0.0.1', port: fake.port, insecureTls: true, timeoutMs: 5000,
    subject: 'Your code · Slippery',
  });
  const script = await fake.done;
  fake.close();
  assert.equal(res.sent, true, JSON.stringify(res));
  const line = split(script).headers.split('\r\n').find((l) => l.startsWith('Subject: '))!;
  assert.match(line, /^Subject: =\?UTF-8\?B\?/);
  assert.equal(Buffer.from(/\?B\?([^?]+)\?=/.exec(line)![1], 'base64').toString('utf8'), 'Your code · Slippery');
});

// ------------------------------------------- the password and plain sockets

test('STARTTLS upgrades, and nothing secret crosses the socket before it does', async (t) => {
  const fake = await fakeSmtp({ mode: 'starttls' });
  if (!fake) return t.skip('no openssl in this environment');
  const res = await sendSmtp({
    ...MESSAGE, host: '127.0.0.1', port: fake.port, tls: 'starttls', insecureTls: true, timeoutMs: 5000,
  });
  const script = await fake.done;
  fake.close();

  assert.equal(res.sent, true, JSON.stringify(res));
  assert.deepEqual(verbsOf(script), ['EHLO', 'STARTTLS', 'EHLO', 'AUTH', 'MAIL', 'RCPT', 'DATA', 'QUIT']);

  const clear = script.entries.filter((e) => !e.secure).map((e) => e.line);
  assert.deepEqual(clear, ['EHLO slippery', 'STARTTLS'], 'only the upgrade handshake may happen in clear');
  assert.equal(base64Of(script).length, 2);
  assert.ok(base64Of(script).every((l) => script.entries.find((e) => e.line === l)!.secure));
});

test('a host that does not offer STARTTLS gets no password at all', async (t) => {
  /*  The failure this prevents is silent. Sending AUTH anyway would hand a
   *  Google App Password to a plain socket and, if the host happened to
   *  accept it, the send would look like it worked. */
  const fake = await fakeSmtp({ mode: 'plain' });
  if (!fake) return t.skip('no openssl in this environment');
  const res = await sendSmtp({
    ...MESSAGE, host: '127.0.0.1', port: fake.port, tls: 'starttls', insecureTls: true, timeoutMs: 5000,
  });
  const script = await fake.done;
  fake.close();

  assert.equal(res.sent, false);
  assert.equal(res.reason, 'starttls_unsupported');
  assert.deepEqual(script.entries.map((e) => e.line), ['EHLO slippery'], 'the conversation stops at EHLO');
  assert.equal(base64Of(script).length, 0, 'no credential may leave this process');
});

test('a host that advertises STARTTLS and then refuses it gets no password either', async (t) => {
  const fake = await fakeSmtp({ mode: 'starttls', refuse: { starttls: '454 4.7.0 TLS not available\r\n' } });
  if (!fake) return t.skip('no openssl in this environment');
  const res = await sendSmtp({
    ...MESSAGE, host: '127.0.0.1', port: fake.port, tls: 'starttls', insecureTls: true, timeoutMs: 5000,
  });
  const script = await fake.done;
  fake.close();

  assert.equal(res.sent, false);
  assert.equal(res.reason, 'starttls_refused');
  assert.equal(res.status, 454);
  assert.equal(base64Of(script).length, 0, 'no credential may leave this process');
});

test('the client waits for each 334 before it says the next thing', async (t) => {
  /*  A refusal in place of the second prompt must stop the client dead. If it
   *  wrote both halves without waiting, the password would already be on the
   *  wire by the time the username was rejected. */
  const fake = await fakeSmtp({ refuse: { user: '535 5.7.8 Username and Password not accepted\r\n' } });
  if (!fake) return t.skip('no openssl in this environment');
  const res = await sendSmtp({ ...MESSAGE, host: '127.0.0.1', port: fake.port, insecureTls: true, timeoutMs: 5000 });
  const script = await fake.done;
  fake.close();

  assert.equal(res.sent, false);
  assert.equal(res.reason, 'auth_rejected');
  assert.equal(base64Of(script).length, 1, 'the password must not follow a refused username');
});

// -------------------------------------------------------- header injection

test('a newline in any header is refused before anything connects', async () => {
  const attacks = [
    ['to', { to: 'them@example.com\r\nRCPT TO:<victim@example.com>' }, 'header_injection_to'],
    ['subject', { subject: 'hello\r\nBcc: victim@example.com' }, 'header_injection_subject'],
    ['from', { from: 'a@example.com\nFrom: spoof@example.com' }, 'header_injection_from'],
    ['user', { user: 'a@example.com\r\nAUTH PLAIN xx' }, 'header_injection_user'],
    ['envelope', { envelopeFrom: 'a@example.com\r\nMAIL FROM:<x@example.com>' }, 'header_injection_from'],
  ] as const;

  for (const [name, override, reason] of attacks) {
    // Port 1 is never reached: the refusal happens before any socket opens.
    const res = await sendSmtp({ ...MESSAGE, host: '127.0.0.1', port: 1, ...override });
    assert.equal(res.sent, false, name);
    assert.equal(res.reason, reason, name);
    assert.equal(res.detail, SMTP_DETAIL[reason], name);
    assert.equal(res.status, undefined, `${name}: nothing connected, so there is no status`);
  }
});

// -------------------------------------------------- one reason per failure

test('every class of refusal is reported as itself, with a status and a sentence', async (t) => {
  const cases: Array<[string, Opts, SmtpFailure, number | undefined]> = [
    ['a greeting that refuses', { refuse: { greeting: '421 4.7.0 Try again later\r\n' } }, 'greeting_refused', 421],
    ['EHLO refused', { refuse: { ehlo: '502 5.5.1 Unrecognised\r\n' } }, 'ehlo_refused', 502],
    ['no AUTH advertised', { auth: null }, 'auth_unsupported', undefined],
    ['AUTH without LOGIN', { auth: 'XOAUTH2 PLAIN' }, 'auth_unsupported', undefined],
    ['AUTH refused outright', { refuse: { auth: '504 5.5.4 Unrecognised\r\n' } }, 'auth_refused', 504],
    ['an account password on a 2FA account', { refuse: { auth: '534 5.7.9 Application-specific password required\r\n' } }, 'auth_app_password_required', 534],
    ['STARTTLS demanded first', { refuse: { auth: '530 5.7.0 Must issue a STARTTLS command first\r\n' } }, 'starttls_required', 530],
    ['a wrong app password', { refuse: { pass: '535 5.7.8 Username and Password not accepted\r\n' } }, 'auth_rejected', 535],
    ['throttled authentication', { refuse: { pass: '454 4.7.0 Too many login attempts\r\n' } }, 'auth_temporary', 454],
    ['an envelope sender the account does not own', { refuse: { mail: '553 5.7.1 Sender address rejected\r\n' } }, 'sender_rejected', 553],
    ['a recipient that does not exist', { refuse: { rcpt: '550 5.1.1 No such user\r\n' } }, 'recipient_rejected', 550],
    ['DATA refused', { refuse: { data: '552 5.3.4 Message too big\r\n' } }, 'data_refused', 552],
    ['the message refused after the envelope', { refuse: { body: '552 5.2.3 Message exceeds size limit\r\n' } }, 'message_rejected', 552],
  ];

  for (const [name, opts, reason, status] of cases) {
    const fake = await fakeSmtp(opts);
    if (!fake) return t.skip('no openssl in this environment');
    const res = await sendSmtp({ ...MESSAGE, host: '127.0.0.1', port: fake.port, insecureTls: true, timeoutMs: 5000 });
    fake.close();

    assert.equal(res.sent, false, name);
    assert.equal(res.reason, reason, `${name}: ${JSON.stringify(res)}`);
    assert.equal(res.status, status, name);
    assert.equal(res.detail, SMTP_DETAIL[reason], name);
    assert.ok((res.detail ?? '').length > 30, `${name}: the sentence has to be worth reading`);
  }
});

test('a socket failure is named for what it is, not lumped in as unreachable', async () => {
  /*  These were one word, "unreachable", for all four. A self-signed
   *  certificate on a host answering perfectly then read as a network
   *  outage, which is an hour spent on the wrong thing. */
  const refused = await sendSmtp({ ...MESSAGE, host: '127.0.0.1', port: 1, timeoutMs: 2000 });
  assert.equal(refused.reason, 'connection_refused', JSON.stringify(refused));

  const noSuchHost = await sendSmtp({ ...MESSAGE, host: 'smtp.invalid.example', port: 465, timeoutMs: 4000 });
  assert.equal(noSuchHost.reason, 'dns_failure', JSON.stringify(noSuchHost));
});

test('a certificate that does not verify is a TLS failure, and insecureTls is the only way past it', async (t) => {
  const fake = await fakeSmtp();
  if (!fake) return t.skip('no openssl in this environment');
  // Same server, same port, the one difference being that the client checks.
  const strict = await sendSmtp({ ...MESSAGE, host: 'localhost', port: fake.port, timeoutMs: 4000 });
  fake.close();
  assert.equal(strict.sent, false);
  assert.equal(strict.reason, 'tls_failed', JSON.stringify(strict));
});

test('implicit TLS pointed at a plain SMTP port is a TLS failure, not a refusal', async (t) => {
  /*  This is the shape of setting EMAIL_SMTP_PORT to 587 and leaving the mode
   *  implicit, and the message has to send somebody to the port rather than
   *  to the network. */
  const fake = await fakeSmtp({ mode: 'plain' });
  if (!fake) return t.skip('no openssl in this environment');
  const res = await sendSmtp({ ...MESSAGE, host: '127.0.0.1', port: fake.port, tls: 'implicit', insecureTls: true, timeoutMs: 4000 });
  fake.close();
  assert.equal(res.sent, false);
  assert.equal(res.reason, 'tls_failed', JSON.stringify(res));
});

test('a host that accepts the socket and then says nothing times out rather than hanging', async (t) => {
  /*  The first version resolved a dead read as an empty string, which parses
   *  as status 0, which came back as "the server refused AUTH". A silent host
   *  and a wrong password are not the same problem. */
  const fake = await fakeSmtp({ silent: true });
  if (!fake) return t.skip('no openssl in this environment');
  const res = await sendSmtp({ ...MESSAGE, host: '127.0.0.1', port: fake.port, insecureTls: true, timeoutMs: 1200 });
  fake.close();
  assert.equal(res.sent, false);
  assert.equal(res.reason, 'timeout', JSON.stringify(res));
});

// --------------------------------------------------------------- the probe

test('the health probe reaches the host, proves TLS and reads back AUTH, with no credential', async (t) => {
  const fake = await fakeSmtp();
  if (!fake) return t.skip('no openssl in this environment');
  const probe = await probeSmtp({ host: '127.0.0.1', port: fake.port, insecureTls: true, timeoutMs: 4000 });
  const script = await fake.done;
  fake.close();

  assert.deepEqual(probe, { reachable: true, encrypted: true, authOffered: true });
  assert.deepEqual(script.entries.map((e) => e.line), ['EHLO slippery', 'QUIT']);
  assert.equal(base64Of(script).length, 0, 'the probe must never authenticate');
});

test('the probe upgrades on a STARTTLS host and reports a host offering no AUTH LOGIN', async (t) => {
  const starttls = await fakeSmtp({ mode: 'starttls' });
  if (!starttls) return t.skip('no openssl in this environment');
  const up = await probeSmtp({ host: '127.0.0.1', port: starttls.port, tls: 'starttls', insecureTls: true, timeoutMs: 4000 });
  starttls.close();
  assert.deepEqual(up, { reachable: true, encrypted: true, authOffered: true });

  const noAuth = await fakeSmtp({ auth: null });
  if (!noAuth) return t.skip('no openssl in this environment');
  const flat = await probeSmtp({ host: '127.0.0.1', port: noAuth.port, insecureTls: true, timeoutMs: 4000 });
  noAuth.close();
  assert.equal(flat.reachable, true);
  assert.equal(flat.authOffered, false);
});

test('the probe separates a host that is not there from a host that refuses', async () => {
  const refused = await probeSmtp({ host: '127.0.0.1', port: 1, timeoutMs: 2000 });
  assert.equal(refused.reachable, false);
  assert.equal(refused.encrypted, false);
  assert.equal(refused.reason, 'connection_refused');
  assert.equal(refused.detail, SMTP_DETAIL.connection_refused);
});

// ----------------------------------------------------------- what is said

test('the client writes no log line at all, on success or on failure', async (t) => {
  /*  The one module that sees the recipient, the subject, the body and the
   *  password prints nothing anywhere. Asserted rather than reviewed: a
   *  console.log added while debugging a send is the exact way a verification
   *  code reaches a log, and it would never fail a test that only reads the
   *  return value. */
  const fake = await fakeSmtp();
  if (!fake) return t.skip('no openssl in this environment');
  const said = captureConsole();
  try {
    await sendSmtp({ ...MESSAGE, host: '127.0.0.1', port: fake.port, insecureTls: true, timeoutMs: 5000 });
    await sendSmtp({ ...MESSAGE, host: '127.0.0.1', port: 1, timeoutMs: 2000 });
  } finally {
    said.stop();
    fake.close();
  }
  assert.deepEqual(said.lines, [], said.lines.join('\n'));
});

test('a failed send logs the reason and nothing that was in the message', async () => {
  /*  lib/server/mail.ts does log, because an operator needs to know a send
   *  failed and why. What it may never carry is the address it was going to,
   *  the code inside it, or the password it used. */
  const saved = { ...process.env };
  const secrets = {
    GMAIL_USER: 'account@example.com',
    GMAIL_APP_PASSWORD: 'placeholderpassword',
    MAIL_FROM: 'account@example.com',
    EMAIL_SMTP_HOST: '127.0.0.1',
    EMAIL_SMTP_PORT: '1',
  };
  for (const k of ['EMAIL_API_KEY', 'EMAIL_FROM']) delete process.env[k];
  Object.assign(process.env, secrets);

  const said = captureConsole();
  let result;
  try {
    result = await sendEmail('punter@example.com', 'Your Slippery code', 'Your code is 481920.');
  } finally {
    said.stop();
    for (const k of Object.keys(secrets)) delete process.env[k];
    Object.assign(process.env, saved);
  }

  assert.equal(result.sent, false);
  assert.equal(result.reason, 'connection_refused', JSON.stringify(result));
  const text = said.lines.join('\n');
  assert.ok(text.includes('connection_refused'), `the reason has to be in the log: ${text}`);
  for (const forbidden of ['punter@example.com', 'account@example.com', 'placeholderpassword', '481920', 'Your code is']) {
    assert.ok(!text.includes(forbidden), `"${forbidden}" reached a log line: ${text}`);
  }
});

test('nothing configured is said without saying what is missing from where', async () => {
  const saved = { ...process.env };
  for (const k of ['EMAIL_API_KEY', 'EMAIL_FROM', 'GMAIL_USER', 'GMAIL_APP_PASSWORD', 'MAIL_FROM']) delete process.env[k];
  const said = captureConsole();
  let result;
  try {
    result = await sendEmail('punter@example.com', 'Your Slippery code', 'Your code is 481920.');
  } finally {
    said.stop();
    Object.assign(process.env, saved);
  }
  assert.deepEqual(result, { sent: false, reason: 'not_configured' });
  const text = said.lines.join('\n');
  for (const forbidden of ['punter@example.com', '481920', 'Your code is']) {
    assert.ok(!text.includes(forbidden), `"${forbidden}" reached a log line: ${text}`);
  }
});

test('no route that sends tells the caller why a send failed', () => {
  /*  "Google refused the app password" is an operator's problem. On a public
   *  endpoint it is also reconnaissance, and on the reset route it would turn
   *  a deliberately uniform answer into an account existence oracle. The
   *  routes answer emailSent and nothing else. */
  for (const route of ['signup', 'resend', 'reset']) {
    const src = readFileSync(`app/api/auth/${route}/route.ts`, 'utf8');
    assert.ok(!/\breason\b/.test(src), `app/api/auth/${route}/route.ts mentions a failure reason`);
    assert.ok(!/\bexplain\b/.test(src), `app/api/auth/${route}/route.ts reaches for the developer sentence`);
    assert.ok(!/\bres\.status\b|\bsmtp\b/i.test(src), `app/api/auth/${route}/route.ts leaks something from the transport`);
  }
});

test('the sending layer never turns off certificate checking', () => {
  /*  insecureTls exists for the fake server above and for nothing else. A
   *  production send that accepts any certificate is a production send that
   *  can be read by whoever is in the middle. */
  const src = readFileSync('lib/server/mail.ts', 'utf8');
  assert.ok(!/insecureTls/.test(src), 'lib/server/mail.ts must never set insecureTls');
  const route = readFileSync('app/api/sources/route.ts', 'utf8');
  assert.ok(!/insecureTls/.test(route), 'the health route must never set insecureTls');
});

// ------------------------------------------------------------ the TLS rule

test('the port decides how TLS starts, and an explicit mode overrides it', () => {
  /*  465 is TLS from the first byte; 587 and 25 are a plain socket upgraded
   *  after EHLO. The first version keyed this on "not 587", which is right
   *  for the two ports anybody uses and wrong for a host offering STARTTLS on
   *  a third. */
  assert.equal(tlsModeForPort(465), 'implicit');
  assert.equal(tlsModeForPort(587), 'starttls');
  assert.equal(tlsModeForPort(25), 'starttls');
  assert.equal(tlsModeForPort(2525), 'implicit');
  assert.equal(tlsModeForPort(587, 'implicit'), 'implicit');
  assert.equal(tlsModeForPort(465, 'starttls'), 'starttls');
});

test('every failure this client can return carries a sentence naming the fix', () => {
  for (const [reason, detail] of Object.entries(SMTP_DETAIL)) {
    assert.ok(detail.length > 30, `${reason} has no usable sentence`);
    assert.match(detail, /\.$/, `${reason} does not end in a full stop`);
    /*  Fixed text. A sentence assembled from a server reply would carry the
     *  recipient back with it, because that is what a 550 quotes at you. */
    assert.ok(!/\$\{|%s/.test(detail), `${reason} interpolates something`);
  }
});

/** Everything the process prints, from the moment this is called. */
function captureConsole() {
  const lines: string[] = [];
  const methods = ['log', 'info', 'warn', 'error', 'debug', 'trace'] as const;
  const originals = methods.map((m) => [m, console[m]] as const);
  for (const m of methods) {
    console[m] = (...args: unknown[]) => { lines.push(args.map((a) => String(a)).join(' ')); };
  }
  return {
    lines,
    stop() { for (const [m, fn] of originals) console[m] = fn; },
  };
}
