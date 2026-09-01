/** How much is on each page, counted rather than felt.
 *
 *  Words is the blunt number. The interesting one is CHROME: the small
 *  explanatory bits that are not the content and not the navigation. A page
 *  with four of them reads considered; a page with fourteen reads like it does
 *  not trust you.
 */
import { chromium } from 'playwright-core';
import { ALL } from './routes.mjs';

const BASE = (process.env.E2E_BASE || 'http://127.0.0.1:3200').replace(/\/$/, '');
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });

const rows = [];
for (const route of ALL) {
  const p = await ctx.newPage();
  try {
    await p.goto(BASE + route, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await p.waitForTimeout(250);
  } catch { await p.close(); continue; }

  const m = await p.evaluate(() => {
    const main = document.querySelector('main') || document.body;
    const vis = (el) => el.checkVisibility?.({ checkVisibilityCSS: true }) ?? true;
    const text = (main.innerText || '').trim();
    const words = text ? text.split(/\s+/).length : 0;

    // The small print, by the classes that carry it.
    const chrome = [...main.querySelectorAll('.small.dim, .small.muted, .card__note, .card__foot, .brow__sub, .brk__sub, .rowcard__s, .tpick__blurb, .cal__key')]
      .filter(vis);
    const chromeWords = chrome.reduce((n, el) => n + ((el.innerText || '').trim().split(/\s+/).filter(Boolean).length), 0);

    const paras = [...main.querySelectorAll('p')].filter(vis);
    return {
      words,
      chrome: chrome.length,
      chromeWords,
      paras: paras.length,
      cards: main.querySelectorAll('.card').length,
      longest: Math.max(0, ...paras.map((el) => (el.innerText || '').trim().split(/\s+/).length)),
    };
  });
  await p.close();
  rows.push({ route, ...m });
}
await b.close();

rows.sort((a, c) => c.words - a.words);
const pad = (s, n) => String(s).padEnd(n);
console.log(pad('route', 34), 'words  chrome  cw   paras cards longest');
for (const r of rows) {
  console.log(pad(r.route, 34), String(r.words).padStart(5), String(r.chrome).padStart(7), String(r.chromeWords).padStart(4), String(r.paras).padStart(6), String(r.cards).padStart(5), String(r.longest).padStart(6));
}
const tot = rows.reduce((a, r) => a + r.words, 0);
const totc = rows.reduce((a, r) => a + r.chromeWords, 0);
console.log(`\n${rows.length} routes, ${tot} words, ${totc} of them small print (${Math.round((totc / tot) * 100)}%)`);
