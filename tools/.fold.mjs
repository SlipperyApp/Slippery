import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const c = await b.newContext({ viewport:{width:1440,height:900} });
const p = await c.newPage();
await p.goto('http://127.0.0.1:3200/app',{waitUntil:'load'});
await p.waitForTimeout(900);
console.log(await p.evaluate(() => {
  const box = (sel) => { const e=document.querySelector(sel); if(!e) return null; const r=e.getBoundingClientRect(); return {top:Math.round(r.top),h:Math.round(r.height)}; };
  return {
    viewport: window.innerHeight,
    banner: box('.banner'),
    h1: box('h1'),
    hero: box('#mod-net'),
    heroFig: box('.hero-net__fig'),
    heroStats: box('.hero-net__stats'),
    scope: box('.scopebar'),
    note: box('.hero-net__note'),
    calendar: box('#mod-calendar'),
  };
}));
await b.close();
