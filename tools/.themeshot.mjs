import { chromium } from 'playwright-core';
const THEMES = ['carbon','ink','graphite','slate','periwinkle','bronze','cinnabar','liquid'];
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const route = process.env.ROUTE || '/app';
for (const t of THEMES) {
  const c = await b.newContext({ viewport: { width: 1200, height: 760 } });
  await c.addCookies([{ name: 'slip_theme', value: t, url: 'http://127.0.0.1:3200' }]);
  const p = await c.newPage();
  await p.goto('http://127.0.0.1:3200' + route, { waitUntil: 'load' });
  await p.waitForTimeout(900);
  await p.screenshot({ path: `/tmp/shots/th-${t}.png` });
  await c.close();
}
await b.close();
console.log('ok');
