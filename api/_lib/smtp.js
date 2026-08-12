/* A minimal SMTP client, over implicit TLS.
 *
 * Written rather than pulled in because the whole protocol we need is four
 * commands, and a mail library brings a dependency tree into a serverless
 * bundle for the sake of them. What a library really buys you is the fiddly
 * parts, so those are the parts this file is careful about:
 *
 *   · Dot-stuffing. A body line starting with "." ends the DATA section.
 *     A verification email will not contain one, but the day someone writes
 *     copy that does, the message would silently truncate.
 *   · CRLF. SMTP lines end \r\n, not \n. Gmail is strict.
 *   · Header encoding. A display name with a non-ASCII character has to be
 *     RFC 2047 encoded or the header is rejected.
 *   · Multi-line greetings. Gmail answers EHLO with several 250- lines and
 *     one final "250 ". Reading only the first is the classic bug.
 *
 * Port 465 with implicit TLS, not 587 with STARTTLS: one fewer round trip
 * and no plaintext phase at all. Gmail accepts an app password over it.
 */
import { connect } from 'node:tls';

const PORT = 465;
const TIMEOUT_MS = 15000;

/**
 * Send one message.
 * @param {{host:string, user:string, pass:string, from:string, to:string,
 *          subject:string, text:string, html:string}} opts
 */
export function sendMail(opts) {
  return new Promise((resolve, reject) => {
    const socket = connect({
      host: opts.host,
      port: PORT,
      servername: opts.host,          // SNI, or the certificate will not match
      timeout: TIMEOUT_MS
    });

    let buffer = '';
    let step = 0;
    let done = false;

    const finish = err => {
      if (done) return;
      done = true;
      try { socket.end(); } catch { /* already gone */ }
      err ? reject(err) : resolve();
    };

    /* Never include the server's text in a rejection: it echoes the
       recipient address, and these errors are logged. */
    const failAt = (where, code) =>
      finish(Object.assign(new Error('The mail server rejected ' + where + '.'),
        { statusCode: 502, smtpCode: code }));

    socket.setTimeout(TIMEOUT_MS, () =>
      finish(Object.assign(new Error('The mail server timed out.'), { statusCode: 504 })));
    socket.on('error', err =>
      finish(Object.assign(new Error('Could not reach the mail server.'),
        { statusCode: 502, cause: err.message })));

    /* Each entry is [what we send, the reply code that means success]. The
       greeting arrives unprompted, so the walk starts by consuming it. */
    const script = [
      ['EHLO slippery', 250],
      ['AUTH PLAIN ' + Buffer.from('\0' + opts.user + '\0' + opts.pass).toString('base64'), 235],
      ['MAIL FROM:<' + address(opts.from) + '>', 250],
      ['RCPT TO:<' + address(opts.to) + '>', 250],
      ['DATA', 354],
      [message(opts) + '\r\n.', 250],
      ['QUIT', 221]
    ];

    socket.on('data', chunk => {
      buffer += chunk.toString('utf8');
      /* A reply may span several lines: "250-FIRST\r\n250 LAST\r\n". Only
         the line whose fourth character is a space is the final one. */
      const lines = buffer.split('\r\n').filter(Boolean);
      const last = lines[lines.length - 1];
      if (!last || last[3] === '-') return;      // more of this reply to come
      buffer = '';

      const code = parseInt(last.slice(0, 3), 10);

      if (step === 0) {
        if (code !== 220) return failAt('the connection', code);
      } else {
        const expected = script[step - 1][1];
        if (code !== expected) {
          return failAt(step === 2 ? 'the login' : 'the message', code);
        }
        if (step === script.length) return finish();
      }
      socket.write(script[step][0] + '\r\n');
      step++;
    });
  });
}

/* The bare address out of "Name <a@b>", SMTP envelope commands take only
   the address, while the From: header keeps the display name. */
function address(value) {
  const m = /<([^>]+)>/.exec(String(value || ''));
  return (m ? m[1] : String(value || '')).trim();
}

/** RFC 2047, so a display name with an accent in it does not break. */
function encodeHeader(value) {
  const s = String(value || '');
  // eslint-disable-next-line no-control-regex
  if (!/[^\x00-\x7F]/.test(s)) return s;
  return '=?UTF-8?B?' + Buffer.from(s, 'utf8').toString('base64') + '?=';
}

/** Build the RFC 5322 message: headers, then a two-part MIME body. */
export function message(opts) {
  const boundary = 'slip_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
  const headers = [
    'From: ' + encodeHeader(opts.from),
    'To: ' + address(opts.to),
    'Subject: ' + encodeHeader(opts.subject),
    'MIME-Version: 1.0',
    'Date: ' + new Date().toUTCString(),
    'Content-Type: multipart/alternative; boundary="' + boundary + '"'
  ];
  const part = (type, body) => [
    '--' + boundary,
    'Content-Type: ' + type + '; charset=UTF-8',
    'Content-Transfer-Encoding: 8bit',
    '',
    stuff(body)
  ].join('\r\n');

  return headers.join('\r\n') + '\r\n\r\n' +
    part('text/plain', opts.text) + '\r\n' +
    part('text/html', opts.html) + '\r\n' +
    '--' + boundary + '--';
}

/* Dot-stuffing. A line that is exactly "." terminates DATA, so any body
   line beginning with one gets a second. The receiver strips it. */
export function stuff(body) {
  return String(body).replace(/\r\n|\n|\r/g, '\r\n').replace(/^\./gm, '..');
}
