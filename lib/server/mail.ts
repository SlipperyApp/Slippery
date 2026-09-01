/** Transactional email.
 *
 *  Two transports, chosen by the shape of the key rather than by a third
 *  variable to get wrong:
 *
 *    EMAIL_API_KEY starting "re_"   Resend, over HTTPS.
 *    anything else                  SMTP, with EMAIL_FROM as the username
 *                                   and EMAIL_SMTP_HOST, or smtp.gmail.com,
 *                                   as the host.
 *
 *  The SMTP path exists so that a Gmail App Password is enough to send from
 *  the product's own address with no provider account at all. It must be an
 *  App Password: Google has not accepted an account password over SMTP since
 *  2022, and an account password should not be in an environment variable in
 *  any case.
 *
 *  Without either, nothing is sent and the caller is told so.
 *
 *  A CODE IS NEVER WRITTEN TO A LOG, in any environment. The privacy policy
 *  commits to it, and a log line outlives the ten minutes the code is valid
 *  for. Neither is the password, the recipient, or the body: a failure
 *  records which verb the far end refused and with what status, which
 *  separates a wrong password from a refused recipient and tells anybody
 *  holding the log nothing else. */

import { has, read } from './env';
import { sendSmtp } from './smtp';

export function canSendEmail(): boolean {
  return has('EMAIL_API_KEY') && has('EMAIL_FROM');
}

/** Which transport this deployment would use. Reported by /api/sources so
 *  the answer to "why did no code arrive" is one request. */
export function emailTransport(): 'resend' | 'smtp' | 'none' {
  if (!canSendEmail()) return 'none';
  return read('EMAIL_API_KEY')!.startsWith('re_') ? 'resend' : 'smtp';
}

type Sent = { sent: boolean; reason?: string };

export async function sendEmail(to: string, subject: string, text: string): Promise<Sent> {
  if (!canSendEmail()) {
    // Say what happened without saying what was in it.
    console.log('[mail] not configured, nothing sent');
    return { sent: false, reason: 'not_configured' };
  }
  const key = read('EMAIL_API_KEY')!;
  const from = read('EMAIL_FROM')!;

  if (emailTransport() === 'smtp') {
    const host = read('EMAIL_SMTP_HOST') ?? 'smtp.gmail.com';
    const res = await sendSmtp({
      host,
      port: 465,
      user: from,
      pass: key,
      from,
      to,
      subject,
      text,
    });
    if (!res.sent) {
      console.log('[mail] smtp refused at', res.reason ?? 'unknown', res.status ?? '');
      return { sent: false, reason: res.reason ?? 'smtp_error' };
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
