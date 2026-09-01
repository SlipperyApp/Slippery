import { chromium } from 'playwright-core';
import { ALL } from './tools/routes.mjs';
const BASE = 'http://127.0.0.1:3200';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
const seen = new Map();
for (const r of ALL) {
  const p = await ctx.newPage();
  try { await p.goto(BASE + r, { waitUntil: 'domcontentloaded', timeout: 25000 }); await p.waitForTimeout(180); }
  catch { await p.close(); continue; }
  const items = await p.evaluate(() => {
    const main = document.querySelector('main') || document.body;
    const vis = (el) => el.checkVisibility?.({ checkVisibilityCSS: true }) ?? true;
    return [...main.querySelectorAll('.card__foot, .card__note, .small.dim, .small.muted')]
      .filter(vis)
      .map((el) => ({ cls: el.className.split(' ').slice(0, 2).join('.'), t: (el.innerText || '').trim().replace(/\s+/g, ' ') }))
      .filter((x) => x.t.length > 12);
  });
  await p.close();
  for (const it of items) {
    const k = it.t;
    if (!seen.has(k)) seen.set(k, { n: 0, where: r, cls: it.cls });
    seen.get(k).n += 1;
  }
}
await b.close();
const rows = [...seen.entries()].map(([t, v]) => ({ t, ...v })).sort((a, c) => c.n - a.n || c.t.length - a.t.length);
console.log(`${rows.length} distinct pieces of small print\n`);
for (const r of rows) console.log(`${String(r.n).padStart(3)}x ${String(r.t.split(/\s+/).length).padStart(3)}w  ${r.where.padEnd(26)} ${r.t.slice(0, 108)}`);
