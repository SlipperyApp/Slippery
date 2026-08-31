/** Transactional email.
 *
 *  Without EMAIL_API_KEY nothing is sent and the caller is told so. A code is
 *  NEVER written to a log, in any environment: the privacy policy commits to
 *  it and a log line outlives the ten minutes the code is valid for. */

import { has, read } from './env';

export function canSendEmail(): boolean {
  return has('EMAIL_API_KEY') && has('EMAIL_FROM');
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
