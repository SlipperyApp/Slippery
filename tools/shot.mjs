import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';

const BASE = process.env.E2E_BASE || 'http://127.0.0.1:3100';
const OUT = process.env.SHOT_DIR || 'test-results';
const EXEC = process.env.CHROME_PATH || '/opt/pw-browsers/chromium';

const args = process.argv.slice(2);
const paths = args.length ? args : ['/'];

mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ executablePath: EXEC, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
for (const p of paths) {
  for (const [w, h, tag] of [[390, 844, 'm'], [1440, 900, 'd']]) {
    const ctx = await browser.newContext({
      viewport: { width: w, height: h },
      deviceScaleFactor: 2,
      isMobile: w < 700,
      hasTouch: w < 700,
      userAgent: w < 700
        ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
        : undefined,
    });
    const page = await ctx.newPage();
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('requestfailed', (r) => errors.push('requestfailed ' + r.url() + ' ' + (r.failure()?.errorText||'')));
    const res = await page.goto(BASE + p, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForLoadState('load').catch(()=>{});
    await page.waitForTimeout(700);
    const m = await page.evaluate(() => ({
      sw: document.body.scrollWidth, cw: document.documentElement.clientWidth,
      h1: document.querySelectorAll('h1').length,
      title: document.title,
      chars: (document.body.innerText || '').trim().length,
    }));
    const name = (p === '/' ? 'home' : p.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '')) + '-' + tag;
    await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: w < 700 });
    console.log(`${p} ${tag} status=${res?.status()} overflow=${m.sw - m.cw} h1=${m.h1} chars=${m.chars} err=${errors.length} title="${m.title}"`);
    if (errors.length) console.log('   ' + errors.slice(0, 4).join('\n   '));
    await ctx.close();
  }
}
await browser.close();
