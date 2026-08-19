import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const errs = [];
p.on('console', m => m.type() === 'error' && errs.push(m.text()));
p.on('pageerror', e => errs.push('PAGEERROR ' + e.message));
for (const [name, path] of [['landing','/'],['dash','/dashboard'],['ledger','/ledger'],['settings','/settings'],['social','/social'],['add','/add'],['signup','/signup']]) {
  await p.goto('http://localhost:3100' + path, { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(1100);
  await p.screenshot({ path: `/tmp/${name}.png` });
  const t = await p.evaluate(() => document.querySelector('.ph')?.innerText?.length || 0);
  const ov = await p.evaluate(() => document.body.scrollWidth - document.body.clientWidth);
  console.log(name.padEnd(10), 'text=', String(t).padStart(5), 'overflow=', ov);
}
console.log('ERRORS', [...new Set(errs)].slice(0,8));
await b.close();
