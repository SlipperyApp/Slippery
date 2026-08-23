/* LOOK AT THE DEPLOYED SITE, NOT A LOCAL BUILD AT THE SAME COMMIT.
 *
 *   node scripts/check-live.mjs [url]
 *
 * Screenshots production at both breakpoints and reports console errors,
 * failed requests and horizontal overflow. Defaults to the production URL;
 * pass a deployment URL to check a preview.
 *
 * WHY IT FETCHES THROUGH CURL. Chromium cannot open a CONNECT tunnel through
 * this container's agent proxy — every navigation comes back
 * ERR_CONNECTION_RESET — while curl goes through it fine. So every request
 * the page makes is intercepted and fulfilled from a curl fetch of the live
 * origin. What renders is the bytes production is actually serving.
 *
 * The content type has to be carried across that boundary by hand, and
 * getting it wrong is silent: an empty contentType makes the browser refuse
 * the stylesheet and the page renders unstyled, which looks exactly like a
 * broken deployment. It is not. Check the marker parsing before believing a
 * bare page.
 */
import { chromium, devices } from 'playwright-core';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const run = promisify(execFile);
const B = (process.argv[2] || 'https://slippery-iota.vercel.app').replace(/\/$/, '');

async function liveWithType(url) {
  try {
    const { stdout } = await run('bash', ['-c',
      `curl -sS --max-time 25 -w '\\n@@CT@@%{content_type}@@%{http_code}' ${JSON.stringify(url)} | base64 -w0`],
      { maxBuffer: 60e6 });
    const raw = Buffer.from(stdout.trim(), 'base64');
    const s = raw.toString('binary');
    const i = s.lastIndexOf('\n@@CT@@');
    if (i < 0) return { body: raw, type: 'application/octet-stream', status: 200 };
    const [type, code] = s.slice(i + 7).split('@@');   /* not [, type, code]: the marker is already stripped */
    return { body: raw.subarray(0, i), type: (type || '').split(';')[0], status: Number(code) || 200 };
  } catch { return null; }
}

const OUT = process.env.SHOT_DIR || '/tmp';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const shots = [
  ['land', '/', { viewport: { width: 1440, height: 980 } }, 0],
  ['app', '/app', { viewport: { width: 1440, height: 980 } }, 0],
  ['app2', '/app', { viewport: { width: 1440, height: 980 } }, 1600],
  ['app-m', '/app', { ...devices['iPhone 13'] }, 0],
  ['imp', '/app/import', { viewport: { width: 1440, height: 980 } }, 0],
  ['soc', '/app/social', { viewport: { width: 1440, height: 980 } }, 0],
  ['soc-m', '/app/social', { ...devices['iPhone 13'] }, 0],
  ['perf', '/app', { viewport: { width: 1440, height: 980 } }, 2600],
];

/* Markers for the things this pass changed, checked against the deployed
   bytes rather than a local build at the same commit. A screenshot proves
   the page rendered; these prove it rendered the current design. */
const MARKERS = {
  land: [['the hero trust line', () => !!document.querySelector('.herotrust')?.textContent.includes('does not take them')],
         ['no em dashes left on the page', () => !/—/.test(document.body.innerText)]],
  app:  [['the exposure chip is labelled', () => !!document.querySelector('.runpill .rplab')],
         ['the period is stated once', () => document.querySelector('[data-netlab]')?.textContent.trim() === 'Net'],
         ['the viewport toggle is present', () => !!document.querySelector('.vptoggle')]],
  perf: [['the performance chart fills its card', () => {
           const s = document.querySelector('[data-cardid=curve] svg');
           if (!s) return false;
           const c = s.closest('.card');
           return s.getBoundingClientRect().width / c.getBoundingClientRect().width > 0.9;
         }]],
  soc:  [['group detail sits beside the list', () => {
           const d = document.querySelector('.socdetail');
           return !!d && getComputedStyle(d).display !== 'none';
         }]],
  'soc-m': [['and is not painted on a phone', () => {
           const d = document.querySelector('.socdetail');
           return !d || getComputedStyle(d).display === 'none';
         }]],
  'app-m': [['recent bets stops at five', () => {
           const rows = document.querySelectorAll('.recent5>.bet');
           if (!rows.length) return true;
           return [...rows].filter(r => getComputedStyle(r).display !== 'none').length <= 5;
         }]],
};
const failed = [];
for (const [name, path, opts, y] of shots) {
  const ctx = await b.newContext({ ...opts, ignoreHTTPSErrors: true });
  const errs = [], missing = [];
  await ctx.route('**/*', async (route) => {
    const u = route.request().url();
    if (!u.startsWith(B)) return route.abort();
    const r = await liveWithType(u);
    if (!r || r.status >= 400) { missing.push(u.replace(B, '') + ' ' + (r ? r.status : 'ERR')); return route.abort(); }
    return route.fulfill({ status: r.status, contentType: r.type, body: r.body });
  });
  const p = await ctx.newPage();
  p.on('pageerror', e => errs.push(e.message));
  p.on('console', m => { if (m.type() === 'error') errs.push('c:' + m.text().slice(0, 90)); });
  await p.goto(B + path, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForTimeout(2800);
  if (y) {
    await p.evaluate(v => { const b = document.querySelector('.body');
      (b && b.scrollHeight > b.clientHeight ? b : document.scrollingElement).scrollTop = v; }, y);
    await p.waitForTimeout(1200);
  }
  await p.screenshot({ path: `${OUT}/${name}.png` });
  console.log(name.padEnd(6), 'scrollW', await p.evaluate(() => document.documentElement.scrollWidth),
    '| errs', errs.length ? errs.slice(0, 2) : 'none',
    '| missing', missing.length ? missing.slice(0, 3) : 'none');
  for (const [label, fn] of MARKERS[name] || []) {
    const ok = await p.evaluate(`(${fn.toString()})()`).catch(() => false);
    console.log('        ', ok ? '✓' : '✗', label);
    if (!ok) failed.push(`${name}: ${label}`);
  }
  await ctx.close();
}
await b.close();
if (failed.length) {
  console.error('\nTHE DEPLOYED SITE IS MISSING:\n  ' + failed.join('\n  '));
  process.exit(1);
}
console.log('\nEverything this pass changed is live and behaving.');
