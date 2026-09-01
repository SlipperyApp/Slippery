/** A minimal SMTP client, so email does not need a provider account.
 *
 *  The rest of this codebase talks to Stripe over fetch rather than through
 *  an SDK, for the same two reasons that apply here: a dependency that ships
 *  a megabyte to send one message is a poor trade, and a protocol you can
 *  read in one file is a protocol you can debug at three in the morning.
 *
 *  It speaks exactly as much SMTP as sending one plain-text message needs:
 *  implicit TLS on 465, or STARTTLS on 587, AUTH LOGIN, one recipient, one
 *  body. Nothing else, deliberately.
 *
 *  WHAT IS NEVER LOGGED. Not the password, not the code, not the body, not
 *  the recipient. A failure records the SMTP status and the verb that
 *  produced it, which is enough to tell "the password is wrong" from "the
 *  host refused the recipient" and tells an attacker with the log nothing.
 */

import { connect as tlsConnect, type TLSSocket } from 'node:tls';
import { connect as netConnect, type Socket } from 'node:net';

export type SmtpSend = {
  host: string;
  port: number;
  user: string;
  pass: string;
  from: string;
  to: string;
  subject: string;
  text: string;
  /*  How TLS starts. Implicit means the socket is TLS from its first byte,
      which is what 465 is for; STARTTLS means a plain socket upgraded after
      EHLO, which is what 587 and 25 are for. Left unset it follows the port,
      because a host that wants something else is a host with an unusual port
      and its operator can say so. */
  tls?: 'implicit' | 'starttls';
  /** Test only. A self-signed certificate is a defect in production. */
  insecureTls?: boolean;
  timeoutMs?: number;
};

export type SmtpResult = { sent: boolean; reason?: string; status?: number };

/*  A header cannot contain a newline. `to` reaches this from a request body,
 *  and a CR or LF inside it would let a caller write their own headers and
 *  their own recipients. Rejected outright rather than stripped: a caller
 *  passing a newline is not making a typo. */
const CLEAN = /^[^\r\n]*$/;

/** RFC 2047, only when it is needed. An ASCII subject stays readable in the
 *  raw message, which matters when somebody is reading a bounce. */
function headerWord(s: string): string {
  // eslint-disable-next-line no-control-regex
  if (/^[\x20-\x7E]*$/.test(s)) return s;
  return `=?UTF-8?B?${Buffer.from(s, 'utf8').toString('base64')}?=`;
}

/** Base64 in 76 character lines, because a bare 8-bit body is not portable
 *  and this one carries a middle dot. */
function base64Body(s: string): string {
  const b = Buffer.from(s.replace(/\r?\n/g, '\r\n'), 'utf8').toString('base64');
  return (b.match(/.{1,76}/g) ?? []).join('\r\n');
}

class Conn {
  private sock: Socket | TLSSocket;
  private buf = '';
  private waiter: ((line: string) => void) | null = null;
  private failed: Error | null = null;

  constructor(sock: Socket | TLSSocket) {
    this.sock = sock;
    this.sock.setEncoding('utf8');
    this.sock.on('data', (chunk: string) => {
      this.buf += chunk;
      this.drain();
    });
    this.sock.on('error', (e) => { this.failed = e; this.drain(); });
    this.sock.on('close', () => {
      if (!this.failed) this.failed = new Error('closed');
      this.drain();
    });
  }

  private drain() {
    if (!this.waiter) return;
    if (this.failed) { const w = this.waiter; this.waiter = null; w(''); return; }
    /*  A reply is one or more lines. Continuations are "250-text" and the
     *  last line is "250 text", so the reply is complete only at a space in
     *  the fourth column. */
    const lines = this.buf.split('\r\n');
    for (let i = 0; i < lines.length; i += 1) {
      if (/^\d{3} /.test(lines[i])) {
        const reply = lines.slice(0, i + 1).join('\r\n');
        this.buf = lines.slice(i + 1).join('\r\n');
        const w = this.waiter;
        this.waiter = null;
        w(reply);
        return;
      }
    }
  }

  read(): Promise<string> {
    return new Promise((resolve) => {
      this.waiter = resolve;
      this.drain();
    });
  }

  write(s: string) { this.sock.write(s); }

  raw(): Socket | TLSSocket { return this.sock; }

  end() { try { this.sock.end(); } catch { /* already gone */ } }

  swap(sock: TLSSocket) {
    this.sock.removeAllListeners('data');
    this.sock.removeAllListeners('error');
    this.sock.removeAllListeners('close');
    this.buf = '';
    this.sock = sock;
    this.sock.setEncoding('utf8');
    this.sock.on('data', (chunk: string) => { this.buf += chunk; this.drain(); });
    this.sock.on('error', (e) => { this.failed = e; this.drain(); });
    this.sock.on('close', () => {
      if (!this.failed) this.failed = new Error('closed');
      this.drain();
    });
  }
}

function status(reply: string): number {
  const n = Number(reply.slice(0, 3));
  return Number.isFinite(n) ? n : 0;
}

export async function sendSmtp(o: SmtpSend): Promise<SmtpResult> {
  for (const [k, v] of [['from', o.from], ['to', o.to], ['subject', o.subject], ['user', o.user]] as const) {
    if (!CLEAN.test(v)) return { sent: false, reason: `header_injection_${k}` };
  }

  const timeout = o.timeoutMs ?? 15000;
  const implicit = (o.tls ?? (o.port === 587 || o.port === 25 ? 'starttls' : 'implicit')) === 'implicit';

  /*  SNI carries a NAME. Node rejects an IP address there, which only ever
   *  happens against a server addressed by number, which only ever happens in
   *  the tests: the first run against the fake server failed at the greeting
   *  with an empty reply, because the socket had already errored before the
   *  first byte. */
  const sni = /^[\d.]+$/.test(o.host) || o.host.includes(':') ? undefined : o.host;

  let conn: Conn;
  try {
    const sock = implicit
      ? tlsConnect({ host: o.host, port: o.port, servername: sni, rejectUnauthorized: !o.insecureTls })
      : netConnect({ host: o.host, port: o.port });
    await new Promise<void>((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('connect_timeout')), timeout);
      sock.once(implicit ? 'secureConnect' : 'connect', () => { clearTimeout(t); resolve(); });
      sock.once('error', (e) => { clearTimeout(t); reject(e); });
    });
    conn = new Conn(sock);
  } catch {
    return { sent: false, reason: 'unreachable' };
  }

  const guard = setTimeout(() => conn.end(), timeout);

  /** Send a verb, read one reply, and require a status. */
  const step = async (line: string | null, want: number, verb: string): Promise<SmtpResult | null> => {
    if (line !== null) conn.write(`${line}\r\n`);
    const reply = await conn.read();
    const st = status(reply);
    if (st !== want) return { sent: false, reason: `${verb}_refused`, status: st };
    return null;
  };

  try {
    let bad = await step(null, 220, 'greeting');
    if (bad) return bad;

    // The name after EHLO is cosmetic to every server that matters, and a
    // real hostname here would be a fact about the deployment in a header.
    bad = await step('EHLO slippery', 250, 'ehlo');
    if (bad) return bad;

    if (!implicit) {
      bad = await step('STARTTLS', 220, 'starttls');
      if (bad) return bad;
      const upgraded = tlsConnect({
        socket: conn.raw() as Socket,
        servername: sni,
        rejectUnauthorized: !o.insecureTls,
      });
      await new Promise<void>((resolve, reject) => {
        const t = setTimeout(() => reject(new Error('tls_timeout')), timeout);
        upgraded.once('secureConnect', () => { clearTimeout(t); resolve(); });
        upgraded.once('error', (e) => { clearTimeout(t); reject(e); });
      });
      conn.swap(upgraded);
      bad = await step('EHLO slippery', 250, 'ehlo_tls');
      if (bad) return bad;
    }

    bad = await step('AUTH LOGIN', 334, 'auth');
    if (bad) return bad;
    bad = await step(Buffer.from(o.user, 'utf8').toString('base64'), 334, 'auth_user');
    if (bad) return bad;
    bad = await step(Buffer.from(o.pass, 'utf8').toString('base64'), 235, 'auth_pass');
    if (bad) return bad;

    bad = await step(`MAIL FROM:<${o.from}>`, 250, 'mail_from');
    if (bad) return bad;
    bad = await step(`RCPT TO:<${o.to}>`, 250, 'rcpt_to');
    if (bad) return bad;
    bad = await step('DATA', 354, 'data');
    if (bad) return bad;

    const headers = [
      `From: ${o.from}`,
      `To: ${o.to}`,
      `Subject: ${headerWord(o.subject)}`,
      `Date: ${new Date().toUTCString()}`,
      `Message-ID: <${crypto.randomUUID()}@slippery>`,
      'MIME-Version: 1.0',
      'Content-Type: text/plain; charset=utf-8',
      'Content-Transfer-Encoding: base64',
    ].join('\r\n');

    // Base64 has no leading dots, so dot-stuffing cannot apply, but the
    // terminator still must be its own line.
    conn.write(`${headers}\r\n\r\n${base64Body(o.text)}\r\n.\r\n`);
    const reply = await conn.read();
    if (status(reply) !== 250) return { sent: false, reason: 'body_refused', status: status(reply) };

    conn.write('QUIT\r\n');
    return { sent: true };
  } catch {
    return { sent: false, reason: 'protocol_error' };
  } finally {
    clearTimeout(guard);
    conn.end();
  }
}
