/** Transactional email.
 *
 *  The transport is Gmail over SMTP, with a Google App Password, and no
 *  provider account anywhere. lib/server/smtp.ts is the whole client.
 *
 *  Two transports exist, chosen by the shape of the key rather than by a
 *  third variable to get wrong:
 *
 *    EMAIL_API_KEY starting "re_"   Resend, over HTTPS. An escape hatch that
 *                                   nothing in this deployment uses.
 *    anything else                  SMTP. The path everything actually takes.
 *
 *  It must be an App Password: Google has not accepted an account password
 *  over SMTP since May 2022, and an account password should not be in an
 *  environment variable in any case. Google issues one only on an account
 *  with 2-Step Verification switched on, so 2FA is a requirement of this
 *  transport and not a suggestion. See docs/EMAIL.md.
 *
 *  THE ENVELOPE SENDER IS THE ACCOUNT, ALWAYS. Gmail refuses a MAIL FROM that
 *  is not the authenticated account or one of its verified Send mail as
 *  aliases, so sending from a MAIL_FROM on your own domain used to fail at
 *  the envelope with a bare 553 and no route to the cause. The From HEADER
 *  still carries whatever MAIL_FROM says. Gmail rewrites that header to the
 *  account unless the address is a verified alias, which is Google's rule and
 *  cannot be changed from here.
 *
 *  A CODE IS NEVER WRITTEN TO A LOG, in any environment. The privacy policy
 *  commits to it, and a log line outlives the ten minutes the code is valid
 *  for. Neither is the password, the recipient, the subject or the body: a
 *  failure records a reason from a fixed vocabulary and the SMTP status, which
 *  separates a wrong app password from a refused recipient and tells anybody
 *  holding the log nothing else. tests/smtp.test.ts asserts it by capturing
 *  everything this module prints during a successful send and a failed one. */

import { appPasswordShaped, emailCredentials, read } from './env';
import { bareAddress } from './codes';
import { SMTP_DETAIL, probeSmtp, sendSmtp, tlsModeForPort, type SmtpFailure, type SmtpProbe } from './smtp';

export function canSendEmail(): boolean {
  return emailCredentials() !== null;
}

/** Which transport this deployment would use. Reported by /api/sources so
 *  the answer to "why did no code arrive" is one request. */
export function emailTransport(): 'resend' | 'smtp' | 'none' {
  const c = emailCredentials();
  if (!c) return 'none';
  return c.key.startsWith('re_') ? 'resend' : 'smtp';
}

export const GMAIL_HOST = 'smtp.gmail.com';
export const GMAIL_PORT = 465;

/** Where a message would go and how, with no credential in it.
 *
 *  Separate from emailCredentials() on purpose: this half is safe to reason
 *  about, log the shape of, and probe. The password stays in the other half. */
export function smtpSettings(): { host: string; port: number; tls: 'implicit' | 'starttls' } {
  const host = read('EMAIL_SMTP_HOST') ?? GMAIL_HOST;
  /*  465 by default, which is TLS from the first byte and what Gmail wants.
      A host that offers only STARTTLS is set to 587 or 25 and the client
      upgrades instead. An unparseable port falls back rather than connecting
      to NaN, which resolves as port 0 and fails as "unreachable". */
  const declared = Number(read('EMAIL_SMTP_PORT'));
  const port = Number.isInteger(declared) && declared > 0 && declared < 65536 ? declared : GMAIL_PORT;
  return { host, port, tls: tlsModeForPort(port) };
}

type Sent = { sent: boolean; reason?: SmtpFailure | 'not_configured' | 'provider_error' | 'unreachable' };

export async function sendEmail(to: string, subject: string, text: string): Promise<Sent> {
  const creds = emailCredentials();
  if (!creds) {
    // Say what happened without saying what was in it.
    console.log('[mail] not configured, nothing sent');
    return { sent: false, reason: 'not_configured' };
  }
  const { key, from, user } = creds;

  if (emailTransport() === 'smtp') {
    const { host, port } = smtpSettings();
    const res = await sendSmtp({
      host,
      port,
      user,
      pass: key,
      from,
      // Gmail accepts the authenticated account here and very little else.
      envelopeFrom: user,
      to,
      subject,
      text,
    });
    if (!res.sent) {
      /*  Reason and status only. Both come from closed sets written in
       *  lib/server/smtp.ts, so no address, subject, body or credential can
       *  reach a log through this line however the far end phrases its
       *  refusal. The sentence that explains the reason is printed from the
       *  local table rather than from the wire, for the same reason. */
      console.log('[mail] smtp refused:', res.reason ?? 'unknown', res.status ?? '', explain(res.reason));
      return { sent: false, reason: res.reason };
    }
    return { sent: true };
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
      body: JSON.stringify({ from, to, subject, text }),
    });
    if (!res.ok) {
      console.log('[mail] provider refused, status', res.status);
      return { sent: false, reason: 'provider_error' };
    }
    return { sent: true };
  } catch {
    console.log('[mail] provider unreachable');
    return { sent: false, reason: 'unreachable' };
  }
}

/** The developer-facing sentence for a failure. Never shown to a user: the
 *  routes answer `emailSent: false` and nothing else, because "Google refused
 *  the app password" is an operator's problem and a stranger's reconnaissance. */
export function explain(reason: SmtpFailure | 'not_configured' | 'provider_error' | 'unreachable' | undefined): string {
  if (!reason) return 'The send failed without naming a step.';
  if (reason === 'not_configured') return 'No credential is set. Set GMAIL_USER and GMAIL_APP_PASSWORD, or EMAIL_FROM and EMAIL_API_KEY.';
  if (reason === 'provider_error') return 'The HTTPS provider refused the message.';
  if (reason === 'unreachable') return 'The HTTPS provider could not be reached.';
  return SMTP_DETAIL[reason];
}

/** Is email configured, and would the host take a message?
 *
 *  BOOLEANS ONLY. No host, no port, no address and no key: this is served by
 *  GET /api/sources on a public deployment, and the rule there is that a
 *  value never leaves process.env. `reachable` costs a socket, so it is only
 *  filled in when an operator asks for it. */
export type EmailHealth = {
  configured: boolean;
  transport: 'resend' | 'smtp' | 'none';
  /** A from address is set and a username was resolved for it. */
  senderResolved: boolean;
  /** The From address is the authenticated account. When false, Gmail
   *  rewrites the From header unless it is a verified Send mail as alias. */
  fromIsAccount: boolean;
  /** EMAIL_SMTP_HOST is unset, so the send goes to Gmail. */
  gmailHost: boolean;
  /** The port selects TLS from the first byte rather than a STARTTLS upgrade. */
  implicitTls: boolean;
  /** The port is one of the three this client knows how to speak on. */
  knownPort: boolean;
  /** The credential is shaped like a Google App Password: sixteen lowercase
   *  letters. False on a Gmail host usually means an account password. */
  appPasswordShaped: boolean;
  /** Filled in only when the probe was asked for. */
  probe?: SmtpProbe;
};

export function emailHealth(): EmailHealth {
  const creds = emailCredentials();
  const transport = emailTransport();
  const { host, port, tls } = smtpSettings();
  return {
    configured: creds !== null,
    transport,
    senderResolved: Boolean(creds && creds.user && creds.from),
    fromIsAccount: Boolean(creds && bareAddress(creds.from).toLowerCase() === creds.user.toLowerCase()),
    gmailHost: host === GMAIL_HOST,
    implicitTls: tls === 'implicit',
    knownPort: port === 465 || port === 587 || port === 25,
    appPasswordShaped: appPasswordShaped(),
  };
}

/** Reach the configured SMTP host and read back what it offers, with no
 *  credential involved and nothing sent. On demand, because it costs a socket
 *  and a second or two. */
export async function probeEmailHost(): Promise<SmtpProbe> {
  const { host, port, tls } = smtpSettings();
  return probeSmtp({ host, port, tls, timeoutMs: 6000 });
}

export function verificationEmail(code: string): { subject: string; text: string } {
  return {
    subject: 'Your Slippery code',
    text: [
      `Your code is ${code}.`,
      '',
      'It is good for ten minutes and can be used once.',
      'If you did not ask for this, nothing has been created and you can ignore it.',
      '',
      'Slippery never accepts bets, holds money or pays winnings.',
      '18+ · BeGambleAware.org · National Gambling Helpline 0808 8020 133',
    ].join('\n'),
  };
}
