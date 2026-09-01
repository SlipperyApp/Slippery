import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
await p.goto(process.argv[2], { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(400);
const out = await p.evaluate(() => {
  const main = document.querySelector('main') || document.body;
  return [...main.querySelectorAll('section')].map((s) => {
    const h = s.querySelector('h1,h2,h3');
    const t = (s.innerText || '').trim();
    return {
      id: s.id || '',
      head: (h?.innerText || '').replace(/\n/g, ' ').slice(0, 58),
      words: t ? t.split(/\s+/).length : 0,
      paras: s.querySelectorAll('p').length,
      cards: s.querySelectorAll('.card').length,
      small: s.querySelectorAll('.small').length,
    };
  });
});
for (const s of out) console.log(String(s.words).padStart(5), 'w', String(s.paras).padStart(3), 'p', String(s.cards).padStart(2), 'c', String(s.small).padStart(3), 'sm  ', s.id.padEnd(12), s.head);
console.log('total sections:', out.length);
await b.close();
