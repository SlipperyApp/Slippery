/* EVERY BUTTON ON EVERY ROUTE, CLICKED.
 *
 *   node tools/dead-buttons.mjs [base] [width]
 *
 * Defaults to a local server. Pass a deployment URL to sweep what is actually
 * live — a control can be wired in the tree and still dead on the domain the
 * owner visits, which is exactly how the five this found stayed dead: the fix
 * was on a branch Vercel does not deploy.
 *
 * A button counts as dead when the path, `cur`, the rendered subtree, an open
 * sheet and an open toast are all unchanged after clicking it. That detector is
 * blind to an attribute-only change — an aria-pressed flip on a reaction button
 * is invisible to it — so tools/probe-controls.mjs checks those by state.
 */
import { chromium } from 'playwright-core';
import { ROUTES } from '../lib/proto/routes.ts';
import { contextFor, isRemote } from './live-origin.mjs';

const B = (process.argv[2] || 'http://127.0.0.1:3903').replace(/\/$/, '');
const WIDTH = Number(process.argv[3] || 1440);
const AFTER = isRemote(B) ? 500 : 220;
/* A remote origin is fulfilled one curl at a time, so how long a route takes
   to mount varies. A fixed sleep called a route's whole button list dead
   whenever it happened to be slow; wait for the app to exist instead, and
   retry a navigation that loses a request at the curl boundary. */
const MOUNT_MS = isRemote(B) ? 45000 : 8000;

const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const ctx = await contextFor(b, B, { viewport: { width: WIDTH, height: 900 } });
const p = await ctx.newPage();
const errs = []; p.on('pageerror', (e) => errs.push(e.message));
const dead = [], threw = []; let tested = 0;

const snap = () => p.evaluate(() => ({
  url: location.pathname,
  cur: JSON.stringify(window.__slippery?.cur || {}),
  dom: (document.querySelector('#ph')?.innerHTML || '').length,
  sheet: !!document.querySelector('.sheet'),
  toast: !!document.querySelector('.toast'),
}));

const open = async (path, attempt = 1) => {
  await p.goto(B + path, { waitUntil: 'domcontentloaded' }).catch(() => {});
  const ok = await p.waitForFunction(() => Boolean(window.__slippery), null, { timeout: MOUNT_MS })
    .then(() => true).catch(() => false);
  if (!ok && attempt < 3) return open(path, attempt + 1);
  if (!ok) unmounted.push(path);
  await p.waitForTimeout(AFTER);
  return ok;
};

const unmounted = [];
const routes = [...new Set(Object.values(ROUTES))];
for (const path of routes) {
  if (!await open(path)) continue;
  const n = await p.locator('.ph button:visible').count();
  for (let i = 0; i < Math.min(n, 22); i++) {
    const el = p.locator('.ph button:visible').nth(i);
    let label = '', attrs = '';
    try {
      label = ((await el.getAttribute('aria-label')) || (await el.innerText()) || '').trim().replace(/\s+/g, ' ').slice(0, 38);
      attrs = await el.evaluate((e) => Object.keys(e.dataset).join(','));
    } catch { continue }
    const before = await snap();
    const e0 = errs.length;
    try { await el.click({ timeout: 1500 }) } catch { continue }
    tested++;
    await p.waitForTimeout(AFTER);
    const after = await snap();
    if (errs.length > e0) threw.push(`${path} · "${label}" [${attrs}] · ${errs[errs.length - 1].slice(0, 60)}`);
    const changed = before.url !== after.url || before.cur !== after.cur
      || before.dom !== after.dom || before.sheet !== after.sheet || before.toast !== after.toast;
    if (!changed) dead.push(`${path} · "${label}" [${attrs || 'NO data-*'}]`);
    await p.evaluate(() => { try { window.__slippery.closeSheet() } catch {} });
    if (after.url !== path) await open(path);
    else await p.waitForTimeout(80);
  }
}
await b.close();
console.log(`\n${B} at ${WIDTH}: tested ${tested} buttons across ${routes.length} routes`);
console.log(`\nTHREW (${threw.length}):`); [...new Set(threw)].slice(0, 15).forEach((x) => console.log('  ' + x));
console.log(`\nNO OBSERVABLE EFFECT (${dead.length}):`); [...new Set(dead)].slice(0, 45).forEach((x) => console.log('  ' + x));
if (unmounted.length) {
  /* Named rather than silently skipped: a route the sweep could not open is
     not a route with no dead buttons. */
  console.log(`\nNEVER MOUNTED, so not swept (${unmounted.length}):`);
  unmounted.forEach((x) => console.log('  ' + x));
}
