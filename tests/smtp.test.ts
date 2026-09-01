import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer, type Server } from 'node:tls';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { sendSmtp } from '@/lib/server/smtp';

/*  The client is tested against a real SMTP conversation, over real TLS, on
 *  localhost. Nothing here reaches Gmail, and nothing needs a credential:
 *  what has to be proved is that the client says the right verbs in the right
 *  order, encodes the body so a middle dot survives, and reports the exact
 *  step a server refuses at rather than a generic failure.
 *
 *  The certificate is generated in-process for each run. A self-signed
 *  certificate is only ever accepted through insecureTls, which is a test-only
 *  option and is never set by lib/server/mail.ts. */

/** A throwaway self-signed certificate for localhost.
 *
 *  Written with the openssl binary rather than by hand: a hand-rolled X.509
 *  is a second protocol implementation to get right, and this one is scaffold
 *  rather than product. Where openssl is absent the two TLS tests skip and
 *  say so; the two that do not need a socket still run. */
function selfSigned(): { key: string; cert: string } | null {
  try {
    const dir = mkdtempSync(join(tmpdir(), 'slip-smtp-'));
    const key = join(dir, 'k.pem');
    const cert = join(dir, 'c.pem');
    execFileSync('openssl', [
      'req', '-x509', '-newkey', 'rsa:2048',
      '-keyout', key, '-out', cert,
      '-days', '1', '-nodes', '-subj', '/CN=localhost',
    ], { stdio: 'ignore' });
    return { key: readFileSync(key, 'utf8'), cert: readFileSync(cert, 'utf8') };
  } catch {
    return null;
  }
}

type Script = { transcript: string[]; body: string };

/** An SMTP server that answers with a canned sequence and records what it was
 *  told. `refuseAt` makes it answer 535 to one verb, so the client's reported
 *  reason can be checked against the step that actually failed. */
async function fakeSmtp(opts: { refuseAt?: string } = {}): Promise<{
  port: number; server: Server; done: Promise<Script>;
} | null> {
  const pair = selfSigned();
  if (!pair) return null;
  const { key, cert } = pair;
  const got: string[] = [];
  let body = '';
  let resolveDone: (s: Script) => void;
  const done = new Promise<Script>((r) => { resolveDone = r; });
  /*  Resolved by whichever comes first: QUIT, the socket ending, or a two
   *  second stop. A test that hangs tells you nothing; a test that fails
   *  tells you where. */
  const finish = () => resolveDone({ transcript: got, body });

  const server = createServer({ key, cert }, (sock) => {
    let inData = false;
    let buf = '';
    sock.setEncoding('utf8');
    sock.write('220 localhost ESMTP fake\r\n');
    sock.on('data', (chunk: string) => {
      buf += chunk;
      let i = buf.indexOf('\r\n');
      while (i !== -1) {
        const line = buf.slice(0, i);
        buf = buf.slice(i + 2);

        if (inData) {
          if (line === '.') {
            inData = false;
            sock.write('250 2.0.0 Ok: queued\r\n');
          } else {
            body += `${line}\n`;
          }
        } else {
          got.push(line);
          const verb = line.split(' ')[0].toUpperCase();
          const refuse = (v: string) => opts.refuseAt === v;
          if (verb === 'EHLO') sock.write('250-localhost\r\n250-SIZE 35882577\r\n250 AUTH LOGIN PLAIN\r\n');
          else if (verb === 'AUTH') sock.write(refuse('AUTH') ? '504 unrecognised\r\n' : '334 VXNlcm5hbWU6\r\n');
          else if (verb === 'MAIL') sock.write(refuse('MAIL') ? '550 no\r\n' : '250 2.1.0 Ok\r\n');
          else if (verb === 'RCPT') sock.write(refuse('RCPT') ? '550 no such user\r\n' : '250 2.1.5 Ok\r\n');
          else if (verb === 'DATA') { inData = true; sock.write('354 End data with <CR><LF>.<CR><LF>\r\n'); }
          else if (verb === 'QUIT') { sock.write('221 Bye\r\n'); sock.end(); finish(); }
          else if (got.filter((l) => !/^(EHLO|AUTH|MAIL|RCPT|DATA|QUIT)/i.test(l)).length === 1) {
            // first base64 line: the username
            sock.write('334 UGFzc3dvcmQ6\r\n');
          } else {
            // second base64 line: the password
            sock.write(refuse('PASS') ? '535 5.7.8 Bad credentials\r\n' : '235 2.7.0 Accepted\r\n');
          }
        }
        i = buf.indexOf('\r\n');
      }
    });
    sock.on('close', finish);
    sock.on('end', finish);
    setTimeout(finish, 2000).unref();
  });

  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const port = (server.address() as { port: number }).port;
  return { port, server, done };
}

test('a message goes out as a correct SMTP conversation', async (t) => {
  const fake = await fakeSmtp();
  if (!fake) return t.skip('no openssl in this environment');
  const { port, server, done } = fake;
  const res = await sendSmtp({
    host: '127.0.0.1',
    port,
    insecureTls: true,
    timeoutMs: 5000,
    user: 'slippery@example.com',
    pass: 'app password here',
    from: 'slippery@example.com',
    to: 'punter@example.com',
    subject: 'Your Slippery code',
    // The middle dot is the reason the body is base64: it is not ASCII, and
    // it is in every verification email this product sends.
    text: 'Your code is 481920.\n\n18+ · BeGambleAware.org',
  });
  const script = await done;
  server.close();

  assert.equal(res.sent, true, JSON.stringify(res));

  const verbs = script.transcript.filter((l) => /^[A-Z]{4}/.test(l)).map((l) => l.split(' ')[0]);
  assert.deepEqual(verbs, ['EHLO', 'AUTH', 'MAIL', 'RCPT', 'DATA', 'QUIT']);

  assert.ok(script.transcript.includes('MAIL FROM:<slippery@example.com>'));
  assert.ok(script.transcript.includes('RCPT TO:<punter@example.com>'));

  // The credentials go base64, which is what AUTH LOGIN is, and they are the
  // ones passed in.
  const b64 = script.transcript.filter((l) => /^[A-Za-z0-9+/=]+$/.test(l) && l.length > 8);
  assert.equal(Buffer.from(b64[0], 'base64').toString('utf8'), 'slippery@example.com');
  assert.equal(Buffer.from(b64[1], 'base64').toString('utf8'), 'app password here');

  // The headers arrived, and the body decodes back to exactly what went in,
  // middle dot included.
  const [headers, ...rest] = script.body.split('\n\n');
  assert.match(headers, /^From: slippery@example\.com$/m);
  assert.match(headers, /^To: punter@example\.com$/m);
  assert.match(headers, /^Subject: Your Slippery code$/m);
  assert.match(headers, /^Content-Transfer-Encoding: base64$/m);
  const decoded = Buffer.from(rest.join('\n\n').replace(/\n/g, ''), 'base64').toString('utf8');
  assert.equal(decoded, 'Your code is 481920.\r\n\r\n18+ · BeGambleAware.org');
});

test('a refusal names the step that refused', async (t) => {
  for (const [refuseAt, reason] of [['PASS', 'auth_pass_refused'], ['RCPT', 'rcpt_to_refused']] as const) {
    const fake = await fakeSmtp({ refuseAt });
    if (!fake) return t.skip('no openssl in this environment');
    const { port, server, done } = fake;
    const res = await sendSmtp({
      host: '127.0.0.1',
      port,
      insecureTls: true,
      timeoutMs: 5000,
      user: 'u@example.com',
      pass: 'wrong',
      from: 'u@example.com',
      to: 'them@example.com',
      subject: 'x',
      text: 'x',
    });
    await done;
    server.close();
    assert.equal(res.sent, false);
    assert.equal(res.reason, reason, `${refuseAt}: ${JSON.stringify(res)}`);
  }
});

test('a newline in a header is refused before anything connects', async () => {
  const res = await sendSmtp({
    host: '127.0.0.1',
    port: 1,                       // never reached
    user: 'u@example.com',
    pass: 'p',
    from: 'u@example.com',
    to: 'them@example.com\r\nRCPT TO:<victim@example.com>',
    subject: 'x',
    text: 'x',
  });
  assert.deepEqual(res, { sent: false, reason: 'header_injection_to' });
});

test('an unreachable host is unreachable, not a crash', async () => {
  const res = await sendSmtp({
    host: '127.0.0.1',
    port: 1,
    user: 'u@example.com',
    pass: 'p',
    from: 'u@example.com',
    to: 'them@example.com',
    subject: 'x',
    text: 'x',
    timeoutMs: 2000,
  });
  assert.equal(res.sent, false);
  assert.equal(res.reason, 'unreachable');
});
