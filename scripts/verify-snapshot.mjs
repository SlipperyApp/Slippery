/* PROVE IT WORKS WITH THE NETWORK OFF.
 *
 * A snapshot that only renders because the machine that built it still has a
 * server running is not a snapshot. This opens the file over file://, refuses
 * every request that is not the file itself, and reports what it sees.
 *
 * `node scripts/verify-snapshot.mjs [snapshot.html]`
 */
import { chromium } from 'playwright-core';
import { existsSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

const FILE = resolve(process.argv[2] || 'snapshot.html');
const CHROME = process.env.SNAPSHOT_CHROME
  || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

if (!existsSync(FILE)) { console.error('no such file:', FILE); process.exit(1); }
console.log(`${FILE} — ${(statSync(FILE).size / 1048576).toFixed(2)}MB`);

const browser = await chromium.launch({ executablePath: CHROME });
const context = await browser.newContext({ viewport: { width: 1500, height: 1000 } });

/* THE NETWORK IS OFF. Anything the page reaches for that is not the file
   itself is refused, and refusals are counted rather than tolerated. */
const reached = [];
await context.route('**/*', (route) => {
  const url = route.request().url();
  if (url.startsWith('file://') || url.startsWith('data:') || url.startsWith('about:')) return route.continue();
  reached.push(url);
  return route.abort();
});

const page = await context.newPage();
const failed = [];
const errors = [];
page.on('requestfailed', (r) => { if (!r.url().startsWith('data:')) failed.push(r.url()); });
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text().slice(0, 140)); });

await page.goto('file://' + FILE, { waitUntil: 'load' });
await page.waitForTimeout(2500);

/* Lazy iframes only load when they are near the viewport, so the whole page
   is walked before anything is judged. */
const total = await page.evaluate(async () => {
  const frames = [...document.querySelectorAll('iframe')];
  for (const f of frames) { f.loading = 'eager'; f.scrollIntoView(); await new Promise((r) => setTimeout(r, 8)); }
  window.scrollTo(0, 0);
  return frames.length;
});
await page.waitForTimeout(3500);

const report = await page.evaluate(() => {
  const out = { frames: 0, empty: [], noFont: [], noColour: [], short: [] };
  for (const f of document.querySelectorAll('iframe')) {
    out.frames++;
    const label = (f.getAttribute('title') || '').slice(0, 70);
    let d;
    try { d = f.contentDocument; } catch { d = null; }
    if (!d || !d.body) { out.empty.push(label); continue; }
    const text = (d.body.innerText || '').trim();
    if (text.length < 30) out.empty.push(label + ' (' + text.length + ' chars)');
    /* The three faces are the point of subsetting them; a fallback here
       means the data URI did not parse. */
    const heads = [...d.querySelectorAll('h1,h2,.lh1,.lh2,.authh,b')].slice(0, 6);
    const fams = heads.map((h) => getComputedStyle(h).fontFamily);
    if (fams.length && !fams.some((f2) => /Source Serif|Schibsted|Geist/.test(f2))) out.noFont.push(label);
    /* A capture with no stylesheet renders on white. */
    const bg = getComputedStyle(d.body).backgroundColor;
    if (!bg || bg === 'rgba(0, 0, 0, 0)' || bg === 'rgb(255, 255, 255)') out.noColour.push(label + ' bg=' + bg);
    if (d.body.scrollHeight > f.clientHeight + 24) out.short.push(label + ' cut by ' + (d.body.scrollHeight - f.clientHeight) + 'px');
  }
  return out;
});

/* Are the fonts genuinely loaded inside a capture, or only declared? */
const fontsReady = await page.evaluate(async () => {
  const f = document.querySelector('iframe');
  if (!f || !f.contentDocument) return null;
  try {
    await f.contentDocument.fonts.ready;
    return [...f.contentDocument.fonts].map((x) => `${x.family} ${x.weight} ${x.status}`).slice(0, 6);
  } catch { return null; }
});

console.log(`\niframes: ${report.frames}`);
console.log(`fonts in the first capture: ${fontsReady ? fontsReady.join(' | ') : 'could not read'}`);
console.log(`reached for the network: ${reached.length}${reached.length ? ' — ' + [...new Set(reached)].slice(0, 6).join(', ') : ''}`);
console.log(`failed requests: ${failed.length}${failed.length ? ' — ' + [...new Set(failed)].slice(0, 6).join(', ') : ''}`);
console.log(`page errors: ${errors.length}${errors.length ? '\n  ' + [...new Set(errors)].slice(0, 5).join('\n  ') : ''}`);
console.log(`empty captures: ${report.empty.length}${report.empty.length ? '\n  ' + report.empty.slice(0, 8).join('\n  ') : ''}`);
console.log(`captures with no product font: ${report.noFont.length}${report.noFont.length ? '\n  ' + report.noFont.slice(0, 8).join('\n  ') : ''}`);
console.log(`captures with no background colour: ${report.noColour.length}${report.noColour.length ? '\n  ' + report.noColour.slice(0, 8).join('\n  ') : ''}`);
console.log(`captures cut off by their frame: ${report.short.length}${report.short.length ? '\n  ' + report.short.slice(0, 8).join('\n  ') : ''}`);

await page.screenshot({ path: '/tmp/snapshot-top.png' });
await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight * 0.35));
await page.waitForTimeout(1800);
await page.screenshot({ path: '/tmp/snapshot-mid.png' });
await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight * 0.72));
await page.waitForTimeout(1800);
await page.screenshot({ path: '/tmp/snapshot-late.png' });
console.log('\nscreenshots: /tmp/snapshot-top.png /tmp/snapshot-mid.png /tmp/snapshot-late.png');

await browser.close();

const bad = reached.length + failed.length + report.empty.length + report.noFont.length + report.noColour.length;
process.exit(bad ? 1 : 0);
