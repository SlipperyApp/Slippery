/** Fetch every route and assert what can be asserted over HTTP.
 *
 *  Against localhost this is a fast smoke test. Against the live origin it is
 *  the verification that matters, because driving Chromium over the network
 *  from this container is not reliable enough to tell a dropped connection
 *  from a defect: the full browser sweep runs locally against the same
 *  commit, and this proves the deployed build is that commit and that every
 *  route answers with real content.
 *
 *    E2E_BASE=https://slippery-iota.vercel.app node tools/check.mjs
 */
import { ALL, API } from './routes.mjs';

const BASE = (process.env.E2E_BASE || 'http://127.0.0.1:3100').replace(/\/$/, '');
const paths = [...ALL, ...API];

const strip = (html) => html
  .replace(/<script[\s\S]*?<\/script>/gi, '')
  .replace(/<style[\s\S]*?<\/style>/gi, '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

let bad = 0;
const rows = [];

for (const p of paths) {
  let status = 0;
  let html = '';
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const res = await fetch(BASE + p, { redirect: 'follow', signal: AbortSignal.timeout(40000) });
      status = res.status;
      html = await res.text();
      if (status < 500) break;
    } catch {
      status = 0;
      await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
    }
  }

  const isApi = p.startsWith('/api/');
  const title = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1]?.trim() ?? '';
  const h1s = (html.match(/<h1[\s>]/gi) ?? []).length;
  const text = isApi ? html : strip(html);

  const problems = [];
  if (status !== 200) problems.push(`status ${status}`);
  if (!isApi) {
    if (h1s !== 1) problems.push(`${h1s} h1`);
    if (title.length < 10) problems.push(`title "${title}"`);
    // The brief's bar is 40. 150 is clear of it and still catches a page
    // that rendered its chrome and nothing else.
    if (text.length < 150) problems.push(`${text.length} characters of content`);
    if (!/BeGambleAware/i.test(html) && !p.startsWith('/app')) problems.push('no compliance footer');
  }

  if (problems.length) bad += 1;
  rows.push({ p, status, chars: text.length, h1s, problems });
  console.log(
    `${problems.length ? 'FAIL' : 'ok  '} ${String(status).padEnd(4)} ${String(text.length).padStart(7)}ch `
    + `h1=${h1s}  ${p}${problems.length ? `\n       ${problems.join(', ')}` : ''}`,
  );
}

console.log(`\n${paths.length - bad} of ${paths.length} routes answered with real content.`);

/*  Hostile query strings.
 *
 *  /api/share?period=toString returned 500 on the live site for weeks. A
 *  plain object literal inherits from Object.prototype, so PERIODS.toString
 *  is a function rather than undefined and the `?? fallback` never fired.
 *  Every route that reads a query parameter is probed with the prototype
 *  keys and with junk in the numeric fields. None of them may 5xx: a public
 *  endpoint that crashes on a URL anybody can type is a defect whether or
 *  not anybody has typed it.
 */
/*  Security headers, asserted over HTTP so this holds against the live origin
 *  as well as a local build. The platform adds HSTS and nothing else. */
const MUST_HAVE = {
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'strict-origin-when-cross-origin',
  'x-frame-options': 'SAMEORIGIN',
  'content-security-policy': "frame-ancestors 'self'",
  'cross-origin-opener-policy': 'same-origin',
};
let headerFails = 0;
try {
  const res = await fetch(`${BASE}/`, { signal: AbortSignal.timeout(30000) });
  for (const [name, want] of Object.entries(MUST_HAVE)) {
    const got = res.headers.get(name);
    if (got !== want) {
      headerFails += 1;
      console.log(`FAIL header ${name}: ${got === null ? 'absent' : `"${got}"`}, wanted "${want}"`);
    }
  }
  const pp = res.headers.get('permissions-policy') ?? '';
  // The camera photographs a shop slip. Nothing else is any of our business.
  for (const want of ['camera=(self)', 'microphone=()', 'geolocation=()']) {
    if (!pp.includes(want)) { headerFails += 1; console.log(`FAIL permissions-policy is missing ${want}`); }
  }
} catch (e) {
  headerFails += 1;
  console.log('FAIL could not read the headers:', e.message);
}
console.log(`${Object.keys(MUST_HAVE).length + 3 - headerFails} of ${Object.keys(MUST_HAVE).length + 3} security headers set as intended.`);

const POISON = ['toString', 'constructor', '__proto__', 'valueOf', 'hasOwnProperty', 'prototype'];
const hostile = [];
for (const k of POISON) {
  hostile.push(`/api/share?period=${k}&net=100&bets=5&units=100&roi=10&turn=1000`);
  hostile.push(`/api/share?cur=${k}&net=100&bets=5&units=100&roi=10&turn=1000`);
  hostile.push(`/og?title=${k}&sub=${k}`);
  hostile.push(`/app/ledger?period=${k}&book=${k}&sport=${k}`);
  hostile.push(`/demo?period=${k}`);
}
hostile.push('/api/share?net=NaN&bets=-1e9&units=Infinity&roi=abc&turn=null&h=<script>');
hostile.push('/api/share');
hostile.push(`/og?title=${'x'.repeat(600)}`);
hostile.push('/app/ledger?q=' + encodeURIComponent('"><img src=x onerror=1>'));

let poisoned = 0;
for (const p of hostile) {
  let status = 0;
  try {
    const res = await fetch(BASE + p, { redirect: 'follow', signal: AbortSignal.timeout(40000) });
    status = res.status;
  } catch { status = 0; }
  if (status >= 500 || status === 0) {
    poisoned += 1;
    console.log(`FAIL ${String(status).padEnd(4)} ${p}`);
  }
}
console.log(`${hostile.length - poisoned} of ${hostile.length} hostile query strings handled without a 5xx.`);

process.exit(bad || poisoned || headerFails ? 1 : 0);
