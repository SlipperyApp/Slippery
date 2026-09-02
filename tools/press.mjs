/*  Press something, then shoot. The detail panes only exist after a click,
 *  so a sweep that only loads pages never sees half of what this branch
 *  changed. Usage: node tools/press.mjs <path> <selector> [nth] */
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';

const BASE = process.env.E2E_BASE || 'http://127.0.0.1:3309';
const OUT = process.env.SHOT_DIR || 'test-results/wide';
const EXEC = process.env.CHROME_PATH || '/opt/pw-browsers/chromium';
const W = Number(process.env.VW || 1920);
const H = Number(process.env.VH || 1080);
const TAG = process.env.TAG || String(W);
const Y = Number(process.env.Y || 0);

const [path, selector, nth = '0'] = process.argv.slice(2);
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ executablePath: EXEC, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1, isMobile: W < 700, hasTouch: W < 700 });
const page = await ctx.newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto(BASE + path, { waitUntil: 'domcontentloaded', timeout: 45000 });
await page.waitForLoadState('load').catch(() => {});
await page.waitForTimeout(600);
const el = page.locator(selector).nth(Number(nth));
await el.click({ timeout: 10000 });
await page.waitForTimeout(700);
if (Y) { await page.evaluate((y) => window.scrollTo(0, y), Y); await page.waitForTimeout(500); }
const base = (path === '/' ? 'home' : path.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, ''));
const name = `${OUT}/${base}-${TAG}-press${nth}.png`;
await page.screenshot({ path: name });
const dup = await page.evaluate(() => {
  const ids = [...document.querySelectorAll('[id]')].map((e) => e.id);
  return ids.filter((v, i) => ids.indexOf(v) !== i);
});
console.log(name, 'err=' + errors.length, 'dupids=' + JSON.stringify(dup));
if (errors.length) console.log('   ' + errors.slice(0, 3).join('\n   '));
await browser.close();
