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
 *  THE PASSWORD NEVER CROSSES A PLAIN SOCKET. On the STARTTLS ports the
 *  client refuses to continue unless the upgrade actually happened, because
 *  the failure mode it prevents is silent: a host that does not offer
 *  STARTTLS would otherwise be handed a Gmail App Password in the clear and
 *  the send would look like it worked.
 *
 *  WHAT IS NEVER LOGGED. Nothing, by this module: it writes no log line at
 *  all, at any level. It returns a fixed `reason` from a closed vocabulary
 *  and a fixed `detail` sentence written here, never text copied off the
 *  wire. That matters because a real SMTP refusal quotes the recipient back
 *  at you ("550 5.1.1 <someone@example.com> user unknown"), so passing the
 *  server's own words upwards would put an address in whatever the caller
 *  does with them.
 */

import { connect as tlsConnect, type TLSSocket } from 'node:tls';
import { connect as netConnect, type Socket } from 'node:net';
import { bareAddress } from './codes';

/** The closed vocabulary of ways a send fails. A caller switches on this;
 *  nothing here is ever assembled from server text. */
export type SmtpFailure =
  | 'header_injection_from'
  | 'header_injection_to'
  | 'header_injection_subject'
  | 'header_injection_user'
  | 'no_sender'
  | 'no_recipient'
  | 'dns_failure'
  | 'connection_refused'
  | 'connect_timeout'
  | 'network_error'
  | 'tls_failed'
  | 'starttls_unsupported'
  | 'starttls_refused'
  | 'starttls_required'
  | 'greeting_refused'
  | 'ehlo_refused'
  | 'auth_unsupported'
  | 'auth_app_password_required'
  | 'auth_rejected'
  | 'auth_temporary'
  | 'auth_refused'
  | 'sender_rejected'
  | 'recipient_rejected'
  | 'data_refused'
  | 'message_rejected'
  | 'timeout'
  | 'connection_lost'
  | 'protocol_error';

/** One sentence per failure, aimed at whoever has to fix it, naming the
 *  variable that is wrong wherever a variable is wrong. Fixed strings: no
 *  value, no address and no reply text is interpolated into any of them. */
export const SMTP_DETAIL: Record<SmtpFailure, string> = {
  header_injection_from: 'A carriage return or newline was in the from address. Refused before connecting: it would let the caller write their own headers.',
  header_injection_to: 'A carriage return or newline was in the recipient. Refused before connecting: it would let the caller add their own recipients.',
  header_injection_subject: 'A carriage return or newline was in the subject. Refused before connecting: it would let the caller write their own headers.',
  header_injection_user: 'A carriage return or newline was in the SMTP username. Check GMAIL_USER for a stray line break.',
  no_sender: 'No from address. Set EMAIL_FROM, or MAIL_FROM, or GMAIL_USER.',
  no_recipient: 'No recipient address was given to the sender.',
  dns_failure: 'The SMTP host name did not resolve. Check EMAIL_SMTP_HOST, or leave it unset to use smtp.gmail.com.',
  connection_refused: 'Nothing is listening on that port. EMAIL_SMTP_PORT should be 465 for TLS from the first byte or 587 for STARTTLS.',
  connect_timeout: 'The connection did not complete in time. Outbound SMTP is commonly blocked by the host, which looks exactly like this.',
  network_error: 'The socket failed before the conversation started. The host is named correctly and the route to it is not working.',
  tls_failed: 'The TLS handshake failed. Either the certificate did not verify, or the port speaks plain SMTP and was addressed as implicit TLS. Check EMAIL_SMTP_PORT against EMAIL_SMTP_HOST.',
  starttls_unsupported: 'The host offered no STARTTLS, so the password would have crossed the wire in clear. Nothing was sent and no credential left this process. Use port 465 instead.',
  starttls_refused: 'The host advertised STARTTLS and then refused it. Nothing was sent and no credential left this process.',
  starttls_required: 'The host requires STARTTLS before it will take a password. Set EMAIL_SMTP_PORT to 587 so the client upgrades.',
  greeting_refused: 'The host answered the connection with a refusal rather than a greeting. Usually a block on the sending address or a rate limit.',
  ehlo_refused: 'The host refused EHLO, so it is not speaking ESMTP on this port.',
  auth_unsupported: 'The host offered no AUTH LOGIN on this connection. On Gmail that means the session was not encrypted at the point AUTH was due.',
  auth_app_password_required: 'Google asked for an application specific password. The value in GMAIL_APP_PASSWORD is an ordinary account password, and Google has not accepted one over SMTP since May 2022.',
  auth_rejected: 'Google refused the username and password. Either GMAIL_USER is not the account the app password belongs to, or the app password has been revoked, or 2-Step Verification is off on that account, in which case no app password exists at all.',
  auth_temporary: 'Authentication failed temporarily. Google throttles repeated attempts from one address. Retry rather than rotating the password.',
  auth_refused: 'The host refused AUTH LOGIN for a reason outside the usual set. The status is reported alongside this.',
  sender_rejected: 'The host refused the envelope sender. Gmail only accepts the authenticated account or one of its verified Send mail as aliases there.',
  recipient_rejected: 'The host refused the recipient. The address does not exist, or this account is not permitted to send to it.',
  data_refused: 'The host refused to start the message body. Usually a size limit declared at EHLO.',
  message_rejected: 'The host took the envelope and refused the message itself. Usually size or content filtering.',
  timeout: 'The host stopped answering part way through the conversation.',
  connection_lost: 'The host closed the connection part way through the conversation.',
  protocol_error: 'The conversation failed in a way this client does not have a name for.',
};

export type SmtpSend = {
  host: string;
  port: number;
  user: string;
  pass: string;
  /** The From header. May carry a display name: `Slippery <post@example.com>`. */
  from: string;
  /*  The envelope sender, which is what SPF is checked against and what a
      bounce goes to. Defaults to the address inside `from`, but Gmail only
      accepts the authenticated account or a verified alias here, so
      lib/server/mail.ts passes the account. */
  envelopeFrom?: string;
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

export type SmtpResult = {
  sent: boolean;
  reason?: SmtpFailure;
  /** The SMTP status that produced the failure, where one did. */
  status?: number;
  /** SMTP_DETAIL[reason]. Safe to print: it is written above, not received. */
  detail?: string;
};

/*  A header cannot contain a newline. `to` reaches this from a request body,
 *  and a CR or LF inside it would let a caller write their own headers and
 *  their own recipients. Rejected outright rather than stripped: a caller
 *  passing a newline is not making a typo. */
const CLEAN = /^[^\r\n]*$/;

function refuse(reason: SmtpFailure, status?: number): SmtpResult {
  return { sent: false, reason, detail: SMTP_DETAIL[reason], ...(status === undefined ? {} : { status }) };
}

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

/*  RFC 5321 transparency. A line of a single dot ends the DATA phase, so any
 *  payload line already starting with one gets a second.
 *
 *  Base64 never produces a leading dot, so today this is a no-op on every
 *  message this product sends. It is here anyway because the day somebody
 *  switches the body to quoted-printable or plain 7bit is the day a message
 *  containing a line reading "." truncates itself and the SMTP conversation
 *  desynchronises, which is a bug that reads as "the server randomly rejects
 *  some emails". Cheaper to be correct now than to find that. */
function dotStuff(payload: string): string {
  return payload.replace(/^\./gm, '..');
}

/** The right hand side of a Message-ID has to be a domain. The first version
 *  of this wrote `<uuid@slippery>`, a bare label with no dot in it, which
 *  several filters score as forged and some servers refuse outright. */
function messageIdDomain(envelope: string, host: string): string {
  const at = envelope.lastIndexOf('@');
  const domain = at === -1 ? '' : envelope.slice(at + 1).trim();
  if (domain.includes('.')) return domain;
  return host.includes('.') ? host : 'localhost';
}

class Conn {
  private sock: Socket | TLSSocket;
  private buf = '';
  private waiter: ((line: string | null) => void) | null = null;
  private failed: Error | null = null;

  constructor(sock: Socket | TLSSocket) {
    this.sock = sock;
    this.listen();
  }

  private listen() {
    this.sock.setEncoding('utf8');
    this.sock.on('data', (chunk: string) => { this.buf += chunk; this.drain(); });
    this.sock.on('error', (e) => { this.failed = e; this.drain(); });
    this.sock.on('close', () => {
      if (!this.failed) this.failed = new Error('closed');
      this.drain();
    });
  }

  private drain() {
    if (!this.waiter) return;
    /*  null rather than '' when the socket is gone. The first version
     *  resolved an empty string, which parses as status 0, which came back to
     *  the caller as "the server refused AUTH" when what actually happened is
     *  that the connection dropped or the guard timer fired. Two very
     *  different things to be told at three in the morning. */
    if (this.failed) { const w = this.waiter; this.waiter = null; w(null); return; }
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

  read(): Promise<string | null> {
    return new Promise((resolve) => {
      this.waiter = resolve;
      this.drain();
    });
  }

  write(s: string) { this.sock.write(s); }

  end() { try { this.sock.end(); } catch { /* already gone */ } }

  /** Hand the raw socket over to the TLS wrapper for a STARTTLS upgrade.
   *
   *  Listeners off and the socket paused first. A socket left in flowing mode
   *  with a utf8 decoder on it is a socket already reading the first bytes of
   *  the handshake that is about to start, and decoding them as text. */
  detach(): Socket {
    this.sock.removeAllListeners('data');
    this.sock.removeAllListeners('error');
    this.sock.removeAllListeners('close');
    this.sock.pause();
    this.buf = '';
    return this.sock as Socket;
  }

  swap(sock: TLSSocket) {
    this.buf = '';
    this.sock = sock;
    this.listen();
  }
}

function status(reply: string): number {
  const n = Number(reply.slice(0, 3));
  return Number.isFinite(n) ? n : 0;
}

/*  Node reports a failed connection three different ways and they mean three
 *  different things to whoever has to fix it: a name that does not resolve, a
 *  port with nothing behind it, and a TLS handshake that did not complete.
 *  Collapsing all three into "unreachable" is what made a self-signed
 *  certificate on a perfectly reachable host read as a network outage. */
function classifyConnect(err: unknown): SmtpFailure {
  const code = (err as { code?: string } | null)?.code ?? '';
  const message = err instanceof Error ? err.message : '';
  if (code === 'ENOTFOUND' || code === 'EAI_AGAIN') return 'dns_failure';
  if (code === 'ECONNREFUSED') return 'connection_refused';
  if (code === 'ETIMEDOUT' || message === 'connect_timeout' || message === 'tls_timeout') return 'connect_timeout';
  /*  OpenSSL failures arrive either as an ERR_TLS_/ERR_SSL_ code or as a bare
   *  verification reason such as DEPTH_ZERO_SELF_SIGNED_CERT. Speaking TLS at
   *  a plain SMTP port lands here too, as EPROTO or a wrong version number. */
  if (code.startsWith('ERR_TLS') || code.startsWith('ERR_SSL') || code === 'EPROTO' || /CERT|SSL|TLS/.test(code)) {
    return 'tls_failed';
  }
  return 'network_error';
}

/** Gmail's authentication refusals, which are not interchangeable.
 *
 *  534 and 535 send an operator to two completely different places: 534 means
 *  the account has 2-Step Verification on and was handed an ordinary account
 *  password, and 535 means the credential itself is wrong or revoked, or that
 *  2-Step Verification is off and therefore no app password can exist. */
function classifyAuth(st: number): SmtpFailure {
  if (st === 534) return 'auth_app_password_required';
  if (st === 535) return 'auth_rejected';
  if (st === 454 || st === 421) return 'auth_temporary';
  if (st === 530) return 'starttls_required';
  return 'auth_refused';
}

/** Whether an EHLO reply advertises an extension, by keyword. */
function offers(ehlo: string, keyword: string): boolean {
  return ehlo.split('\r\n').some((l) => new RegExp(`^\\d{3}[ -]${keyword}\\b`, 'i').test(l));
}

/** AUTH LOGIN specifically. A host offering only XOAUTH2 offers this client
 *  nothing, and saying "no AUTH" about it would send somebody looking for a
 *  missing STARTTLS that is not missing. */
function offersAuthLogin(ehlo: string): boolean {
  return ehlo.split('\r\n').some((l) => /^\d{3}[ -]AUTH\b/i.test(l) && /\bLOGIN\b/i.test(l));
}

/** Implicit TLS on 465, STARTTLS on 587 and 25. An explicit mode wins. */
export function tlsModeForPort(port: number, explicit?: 'implicit' | 'starttls'): 'implicit' | 'starttls' {
  return explicit ?? (port === 587 || port === 25 ? 'starttls' : 'implicit');
}

type Opened = { conn: Conn; ehlo: string } | { failure: SmtpResult };

/*  Connect, greet, EHLO, and upgrade if the port calls for it. Shared by the
 *  sender and by the health probe, so the probe exercises the same TLS and
 *  the same extension parsing the real send does rather than a simplified
 *  copy that can drift away from it. */
async function open(o: {
  host: string; port: number; tls?: 'implicit' | 'starttls'; insecureTls?: boolean; timeoutMs: number;
}): Promise<Opened> {
  const implicit = tlsModeForPort(o.port, o.tls) === 'implicit';

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
      const t = setTimeout(() => reject(new Error('connect_timeout')), o.timeoutMs);
      sock.once(implicit ? 'secureConnect' : 'connect', () => { clearTimeout(t); resolve(); });
      sock.once('error', (e) => { clearTimeout(t); reject(e); });
    });
    conn = new Conn(sock);
  } catch (err) {
    return { failure: refuse(classifyConnect(err)) };
  }

  /*  The reads below need a guard of their own. A host that accepts the
   *  socket and then says nothing would otherwise hang this request until the
   *  platform kills the whole invocation, which is a signup that never
   *  answers rather than a signup that fails. */
  let expired = false;
  const guard = setTimeout(() => { expired = true; conn.end(); }, o.timeoutMs);
  const stop = (reason: SmtpFailure, st?: number): Opened => {
    clearTimeout(guard);
    conn.end();
    return { failure: refuse(reason, st) };
  };
  const dead = (): SmtpFailure => (expired ? 'timeout' : 'connection_lost');

  const greeting = await conn.read();
  if (greeting === null) return stop(dead());
  if (status(greeting) !== 220) return stop('greeting_refused', status(greeting));

  // The name after EHLO is cosmetic to every server that matters, and a real
  // hostname here would be a fact about the deployment in a header.
  conn.write('EHLO slippery\r\n');
  let ehlo = await conn.read();
  if (ehlo === null) return stop(dead());
  if (status(ehlo) !== 250) return stop('ehlo_refused', status(ehlo));

  if (!implicit) {
    /*  Checked before it is asked for, and the conversation stops here when
     *  it is absent. The alternative is handing a Gmail App Password to a
     *  plain socket, which no error anywhere would ever tell you happened. */
    if (!offers(ehlo, 'STARTTLS')) return stop('starttls_unsupported');

    conn.write('STARTTLS\r\n');
    const go = await conn.read();
    if (go === null) return stop(dead());
    if (status(go) !== 220) return stop('starttls_refused', status(go));

    try {
      const upgraded = tlsConnect({
        socket: conn.detach(),
        servername: sni,
        rejectUnauthorized: !o.insecureTls,
      });
      await new Promise<void>((resolve, reject) => {
        const t = setTimeout(() => reject(new Error('tls_timeout')), o.timeoutMs);
        upgraded.once('secureConnect', () => { clearTimeout(t); resolve(); });
        upgraded.once('error', (e) => { clearTimeout(t); reject(e); });
      });
      conn.swap(upgraded);
    } catch (err) {
      /*  A handshake that fails after a 220 is a certificate problem, never a
       *  routing one, so it must not be reported as unreachable. */
      const why = classifyConnect(err);
      return stop(why === 'network_error' ? 'tls_failed' : why);
    }

    // A second EHLO is required after the upgrade: the extension list before
    // it is not binding, and on Gmail it is where AUTH first appears.
    conn.write('EHLO slippery\r\n');
    ehlo = await conn.read();
    if (ehlo === null) return stop(dead());
    if (status(ehlo) !== 250) return stop('ehlo_refused', status(ehlo));
  }

  clearTimeout(guard);
  return { conn, ehlo };
}

export async function sendSmtp(o: SmtpSend): Promise<SmtpResult> {
  /*  First, before anything is parsed out of these strings. A recipient
   *  carrying a newline parses as an address plus a second RCPT TO line, so
   *  reading the address out of it before refusing it would be reading an
   *  attacker's address. */
  for (const [k, v] of [
    ['from', o.from], ['to', o.to], ['subject', o.subject], ['user', o.user],
  ] as const) {
    if (!CLEAN.test(v)) return refuse(`header_injection_${k}` as SmtpFailure);
  }
  if (o.envelopeFrom !== undefined && !CLEAN.test(o.envelopeFrom)) return refuse('header_injection_from');

  const envelope = bareAddress(o.envelopeFrom ?? o.from);
  const recipient = bareAddress(o.to);
  if (!envelope) return refuse('no_sender');
  if (!recipient) return refuse('no_recipient');

  const timeoutMs = o.timeoutMs ?? 15000;
  const opened = await open({ host: o.host, port: o.port, tls: o.tls, insecureTls: o.insecureTls, timeoutMs });
  if ('failure' in opened) return opened.failure;
  const { conn, ehlo } = opened;

  /*  The guard ends the socket rather than throwing, so a server that stops
   *  answering resolves the pending read as a dead socket. `expired` is what
   *  turns that into "timeout" instead of "the connection dropped". */
  let expired = false;
  const guard = setTimeout(() => { expired = true; conn.end(); }, timeoutMs);

  /** Send a verb, read one reply, and require a status. */
  const step = async (line: string | null, want: number, onFail: (st: number) => SmtpFailure): Promise<SmtpResult | null> => {
    if (line !== null) conn.write(`${line}\r\n`);
    const reply = await conn.read();
    if (reply === null) return refuse(expired ? 'timeout' : 'connection_lost');
    const st = status(reply);
    if (st !== want) return refuse(onFail(st), st);
    return null;
  };

  try {
    if (!offersAuthLogin(ehlo)) return refuse('auth_unsupported');

    let bad = await step('AUTH LOGIN', 334, classifyAuth);
    if (bad) return bad;
    bad = await step(Buffer.from(o.user, 'utf8').toString('base64'), 334, classifyAuth);
    if (bad) return bad;
    bad = await step(Buffer.from(o.pass, 'utf8').toString('base64'), 235, classifyAuth);
    if (bad) return bad;

    bad = await step(`MAIL FROM:<${envelope}>`, 250, () => 'sender_rejected');
    if (bad) return bad;
    bad = await step(`RCPT TO:<${recipient}>`, 250, () => 'recipient_rejected');
    if (bad) return bad;
    bad = await step('DATA', 354, () => 'data_refused');
    if (bad) return bad;

    const headers = [
      `From: ${o.from}`,
      `To: ${o.to}`,
      `Subject: ${headerWord(o.subject)}`,
      `Date: ${new Date().toUTCString()}`,
      `Message-ID: <${crypto.randomUUID()}@${messageIdDomain(envelope, o.host)}>`,
      'MIME-Version: 1.0',
      'Content-Type: text/plain; charset=utf-8',
      'Content-Transfer-Encoding: base64',
    ].join('\r\n');

    conn.write(`${headers}\r\n\r\n${dotStuff(base64Body(o.text))}\r\n.\r\n`);
    const reply = await conn.read();
    if (reply === null) return refuse(expired ? 'timeout' : 'connection_lost');
    if (status(reply) !== 250) return refuse('message_rejected', status(reply));

    conn.write('QUIT\r\n');
    return { sent: true };
  } catch {
    return refuse('protocol_error');
  } finally {
    clearTimeout(guard);
    conn.end();
  }
}

export type SmtpProbe = {
  /** The socket opened and the host greeted with a 220. */
  reachable: boolean;
  /** The conversation is encrypted: implicit from the first byte, or upgraded. */
  encrypted: boolean;
  /** The host offers AUTH LOGIN, which is the mechanism this client speaks. */
  authOffered: boolean;
  reason?: SmtpFailure;
  detail?: string;
};

/** Is the configured SMTP host reachable, and would it take a password?
 *
 *  Deliberately takes no credential. It greets, reads the extension list and
 *  quits, so an operator can tell "outbound 465 is blocked" from "the app
 *  password is wrong" without a send and without anything to leak. Used by
 *  GET /api/sources on demand. */
export async function probeSmtp(o: {
  host: string; port: number; tls?: 'implicit' | 'starttls'; insecureTls?: boolean; timeoutMs?: number;
}): Promise<SmtpProbe> {
  const timeoutMs = o.timeoutMs ?? 8000;
  const opened = await open({ ...o, timeoutMs });
  if ('failure' in opened) {
    const reason = opened.failure.reason as SmtpFailure;
    return {
      // A greeting arrived and the refusal came later, so the host is there.
      reachable: reason !== 'dns_failure' && reason !== 'connection_refused'
        && reason !== 'connect_timeout' && reason !== 'network_error' && reason !== 'tls_failed',
      encrypted: false,
      authOffered: false,
      reason,
      detail: SMTP_DETAIL[reason],
    };
  }
  opened.conn.write('QUIT\r\n');
  opened.conn.end();
  return {
    reachable: true,
    // open() returns only over TLS: implicit, or after a completed upgrade.
    encrypted: true,
    authOffered: offersAuthLogin(opened.ehlo),
  };
}
