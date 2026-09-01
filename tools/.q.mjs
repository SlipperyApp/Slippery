import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const c = await b.newContext({ viewport:{width:1440,height:900} });
const p = await c.newPage();
await p.goto('http://127.0.0.1:3200/app',{waitUntil:'load'});
await p.waitForTimeout(700);
console.log(await p.evaluate(() => {
  const row=document.querySelector('.hero-net__row');
  const banners=[...document.querySelectorAll('.banner')].map(b=>({cls:b.className,h:Math.round(b.getBoundingClientRect().height),top:Math.round(b.getBoundingClientRect().top)}));
  return { rowDisplay: row?getComputedStyle(row).display:'none', rowWidth: row?Math.round(row.getBoundingClientRect().width):0,
    statsW: Math.round(document.querySelector('.hero-net__stats').getBoundingClientRect().width),
    scopeW: Math.round(document.querySelector('.scopebar').getBoundingClientRect().width),
    banners };
}));
await b.close();
