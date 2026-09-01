/** Repeated sentences and over-long ones, measured across the built pages
 *  rather than guessed at from the source. */
import { chromium } from 'playwright-core';
import { ALL } from './routes.mjs';
const BASE = (process.env.E2E_BASE || 'http://127.0.0.1:3200').replace(/\/$/, '');
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
const seen = new Map();
const long = [];
for (const route of ALL) {
  const page = await ctx.newPage();
  try {
    await page.goto(BASE + route, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(150);
  } catch { await page.close(); continue; }
  const text = await page.evaluate(() => {
    const main = document.querySelector('main') || document.body;
    return main.innerText || '';
  });
  await page.close();
  for (const raw of text.split(/(?<=[.!?])\s+|\n+/)) {
    const s = raw.trim().replace(/\s+/g, ' ');
    if (s.length < 40) continue;
    if (!seen.has(s)) seen.set(s, new Set());
    seen.get(s).add(route);
    const words = s.split(/\s+/).length;
    if (words > 34) long.push({ route, words, s });
  }
}
await b.close();
const repeats = [...seen.entries()].filter(([, r]) => r.size >= 3).sort((a, c) => c[1].size - a[1].size);
console.log(`REPEATED ON 3+ PAGES: ${repeats.length}`);
for (const [s, r] of repeats.slice(0, 25)) console.log(`  ${r.size}x  ${[...r].slice(0,4).join(' ')}\n       "${s.slice(0, 150)}"`);
const uniqLong = [...new Map(long.map((l) => [l.s, l])).values()].sort((a, c) => c.words - a.words);
console.log(`\nOVER 34 WORDS: ${uniqLong.length}`);
for (const l of uniqLong.slice(0, 25)) console.log(`  ${l.words}w ${l.route}\n       "${l.s.slice(0, 190)}"`);
