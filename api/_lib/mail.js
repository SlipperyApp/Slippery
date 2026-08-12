/* Transactional email.
 *
 * Gmail SMTP is the configured path: GMAIL_USER plus a Google app password,
 * which is what an ordinary Google account can offer without a domain or a
 * mail provider account. Resend stays supported because it needs no app
 * password and does not have Gmail's sending limits, so it is the upgrade
 * when this outgrows a personal mailbox.
 *
 * Two things about Gmail worth knowing before relying on it:
 *   · An app password is required. A normal account password will be
 *     refused, and 2-Step Verification has to be on before Google will
 *     issue one.
 *   · Roughly 500 messages a day, and the From address is forced to the
 *     account's own. MAIL_FROM may set the display name but not a different
 *     address, Gmail rewrites it, so a mismatched one just looks odd in
 *     the recipient's client.
 */
import { sendMail } from './smtp.js';

const RESEND_ENDPOINT = 'https://api.resend.com/emails';

const gmailReady = () => Boolean(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD);
const resendReady = () => Boolean(process.env.RESEND_API_KEY);

export function configured() { return gmailReady() || resendReady(); }

/** Which path would be used. Reported by /api/sources, never the values. */
export function provider() {
  return gmailReady() ? 'gmail' : resendReady() ? 'resend' : null;
}

export async function sendVerificationEmail(to, code) {
  return send(to, 'Your Slippery code: ' + code, codeText(code, VERIFY), codeHtml(code, VERIFY));
}

export async function sendResetEmail(to, code) {
  return send(to, 'Reset your Slippery password: ' + code,
    codeText(code, RESET), codeHtml(code, RESET));
}

async function send(to, subject, text, html) {
  if (!configured()) {
    const err = new Error('Email delivery is not configured yet.');
    err.statusCode = 503;
    throw err;
  }

  if (gmailReady()) {
    /* Gmail rewrites From to the authenticated account, so defaulting to it
       keeps the header honest instead of showing an address that is not the
       one the mail came from. */
    const from = process.env.MAIL_FROM || ('Slippery <' + process.env.GMAIL_USER + '>');
    await sendMail({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
      from, to, subject, text, html
    });
    return;
  }

  const res = await fetch(RESEND_ENDPOINT, {
    method: 'POST',
    headers: {
      authorization: 'Bearer ' + process.env.RESEND_API_KEY,
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      from: process.env.MAIL_FROM || 'Slippery <onboarding@resend.dev>',
      to: [to], subject, text, html
    })
  });
  if (!res.ok) {
    /* Log the status, never the body, it echoes the recipient address. */
    const err = new Error('Could not send the verification email.');
    err.statusCode = 502;
    console.error('[slippery] resend responded', res.status);
    throw err;
  }
}

/* The two emails differ only in their wording, so they share a body. What
   they must not share is the reassurance line: "ignore this and nothing
   happens" is true of an unwanted signup, and it is the single most useful
   sentence in a reset email someone did not ask for. */
const VERIFY = {
  lead: 'Here is your verification code. It expires in ten minutes.',
  ignore: 'If you did not create a Slippery account, ignore this email and nothing will happen.',
  window: 'ten minutes'
};
const RESET = {
  lead: 'Here is your password reset code. It expires in ten minutes.',
  ignore: 'If you did not ask to reset your password, ignore this email. Your password has not changed.',
  window: 'ten minutes'
};

const codeText = (code, copy) => `Your Slippery code is ${code}.

It expires in ${copy.window}. ${copy.ignore}

Slippery tracks bets. It does not accept them and never handles money.
18+ only. When the fun stops, stop. begambleaware.org`;

const codeHtml = (code, copy) => `<!doctype html>
<html lang="en-GB"><body style="margin:0;background:#0B1020;color:#F1F5F9;
  font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;padding:32px 20px">
  <div style="max-width:440px;margin:0 auto">
    <p style="font-size:19px;font-weight:700;letter-spacing:-.02em;margin:0 0 24px">Slippery</p>
    <p style="font-size:15px;line-height:1.6;color:#98A6BC;margin:0 0 20px">${copy.lead}</p>
    <p style="font-family:ui-monospace,Menlo,monospace;font-size:32px;letter-spacing:.28em;
      font-weight:600;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);
      border-radius:12px;padding:18px;text-align:center;margin:0 0 20px">${code}</p>
    <p style="font-size:13.5px;line-height:1.6;color:#98A6BC;margin:0 0 24px">${copy.ignore}</p>
    <p style="font-size:11.5px;line-height:1.6;color:#75839B;margin:0;
      border-top:1px solid rgba(255,255,255,.1);padding-top:16px">
      Slippery tracks bets. It does not accept them and never handles money. 18+ only.
      When the fun stops, stop. <a href="https://www.begambleaware.org"
      style="color:#7DD3FC">begambleaware.org</a></p>
  </div>
</body></html>`;
