import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';
const BASE = process.env.E2E_BASE || 'http://127.0.0.1:3100';
const OUT = process.env.SHOT_DIR || 'test-results';
const EXEC = process.env.CHROME_PATH || '/opt/pw-browsers/chromium';
const [path = '/', w = '390', h = '844', scrollY = '0', name = 'view'] = process.argv.slice(2);
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: EXEC, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const ctx = await browser.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: 2, isMobile: +w < 700, hasTouch: +w < 700 });
const page = await ctx.newPage();
await page.goto(BASE + path, { waitUntil: 'domcontentloaded', timeout: 45000 });
await page.waitForLoadState('load').catch(() => {});
await page.waitForTimeout(1200);
if (+scrollY) { await page.evaluate((y) => window.scrollTo(0, y), +scrollY); await page.waitForTimeout(700); }
await page.screenshot({ path: `${OUT}/${name}.png` });
console.log('ok', `${OUT}/${name}.png`);
await browser.close();
