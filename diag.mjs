import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const p = await b.newPage({ viewport: { width: 1024, height: 768 } });
await p.goto('http://localhost:3100/ledger', { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(900);
const r = await p.evaluate(() => {
  const out = [];
  for (const el of document.querySelectorAll('.ph *')) {
    const b = el.getBoundingClientRect();
    if (b.right > document.documentElement.clientWidth + 0.5) {
      out.push({ cls: String(el.className).slice(0,40), txt: (el.textContent||'').trim().slice(0,24), right: Math.round(b.right), w: Math.round(b.width), parent: String(el.parentElement?.className).slice(0,30) });
    }
  }
  return out.slice(0, 10);
});
console.log(JSON.stringify(r, null, 1));
await b.close();
