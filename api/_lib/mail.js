/* Transactional email via Resend.
 *
 * One fetch call, no SDK. If RESEND_API_KEY is unset the caller is told the
 * mail path is unconfigured rather than being left to think a code was sent.
 */

const ENDPOINT = 'https://api.resend.com/emails';

export function configured() { return Boolean(process.env.RESEND_API_KEY); }

export async function sendVerificationEmail(to, code) {
  if (!configured()) {
    const err = new Error('Email delivery is not configured yet.');
    err.statusCode = 503;
    throw err;
  }
  const from = process.env.MAIL_FROM || 'Slippery <onboarding@resend.dev>';
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      authorization: 'Bearer ' + process.env.RESEND_API_KEY,
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject: 'Your Slippery code: ' + code,
      text: verificationText(code),
      html: verificationHtml(code)
    })
  });
  if (!res.ok) {
    /* Log the status, never the body — it echoes the recipient address. */
    const err = new Error('Could not send the verification email.');
    err.statusCode = 502;
    console.error('[slippery] resend responded', res.status);
    throw err;
  }
}

const verificationText = code => `Your Slippery verification code is ${code}.

It expires in ten minutes. If you did not create a Slippery account, you can
ignore this email and nothing will happen.

Slippery tracks bets. It does not accept them and never handles money.
18+ only. When the fun stops, stop. begambleaware.org`;

const verificationHtml = code => `<!doctype html>
<html lang="en-GB"><body style="margin:0;background:#0B1020;color:#F1F5F9;
  font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;padding:32px 20px">
  <div style="max-width:440px;margin:0 auto">
    <p style="font-size:19px;font-weight:700;letter-spacing:-.02em;margin:0 0 24px">Slippery</p>
    <p style="font-size:15px;line-height:1.6;color:#98A6BC;margin:0 0 20px">
      Here is your verification code. It expires in ten minutes.</p>
    <p style="font-family:ui-monospace,Menlo,monospace;font-size:32px;letter-spacing:.28em;
      font-weight:600;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);
      border-radius:12px;padding:18px;text-align:center;margin:0 0 20px">${code}</p>
    <p style="font-size:13.5px;line-height:1.6;color:#98A6BC;margin:0 0 24px">
      If you did not create a Slippery account, ignore this email and nothing will happen.</p>
    <p style="font-size:11.5px;line-height:1.6;color:#75839B;margin:0;
      border-top:1px solid rgba(255,255,255,.1);padding-top:16px">
      Slippery tracks bets. It does not accept them and never handles money. 18+ only.
      When the fun stops, stop. <a href="https://www.begambleaware.org"
      style="color:#7DD3FC">begambleaware.org</a></p>
  </div>
</body></html>`;
