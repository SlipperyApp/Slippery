/*  A viewport-sized shot at a given scroll offset. fullPage on a 2600px
 *  dashboard squashes every module into an unreadable strip, and the thing
 *  being judged here is what a laptop actually shows at once. */
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';

const BASE = process.env.E2E_BASE || 'http://127.0.0.1:3309';
const OUT = process.env.SHOT_DIR || 'test-results/wide';
const EXEC = process.env.CHROME_PATH || '/opt/pw-browsers/chromium';
const W = Number(process.env.VW || 1920);
const H = Number(process.env.VH || 1080);
const TAG = process.env.TAG || String(W);

const [path, ...offsets] = process.argv.slice(2);
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ executablePath: EXEC, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1, isMobile: W < 700, hasTouch: W < 700 });
const page = await ctx.newPage();
await page.goto(BASE + path, { waitUntil: 'domcontentloaded', timeout: 45000 });
await page.waitForLoadState('load').catch(() => {});
await page.waitForTimeout(500);
const base = (path === '/' ? 'home' : path.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, ''));
await page.addStyleTag({ content: 'html{scroll-behavior:auto !important}' });
for (const o of (offsets.length ? offsets : ['0'])) {
  await page.evaluate((y) => window.scrollTo(0, Number(y)), o);
  await page.waitForTimeout(1200);
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  await page.screenshot({ path: `${OUT}/${base}-${TAG}-y${o}.png` });
  console.log(`${OUT}/${base}-${TAG}-y${o}.png`);
}
await browser.close();
