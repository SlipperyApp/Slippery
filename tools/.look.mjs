import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const shots = process.env.SHOTS
  ? JSON.parse(process.env.SHOTS)
  : [['/app', 'dash', 1440, 900], ['/', 'home', 1440, 900], ['/app', 'dash', 390, 844], ['/', 'home', 390, 844]];
for (const [r, n, w, h] of shots) {
  const c = await b.newContext({ viewport: { width: w, height: h } });
  const p = await c.newPage();
  await p.goto('http://127.0.0.1:3200' + r, { waitUntil: 'load' });
  await p.waitForTimeout(1200);
  await p.screenshot({ path: `/tmp/shots/nw-${n}-${w}.png` });
  await c.close();
}
await b.close();
console.log('ok');
