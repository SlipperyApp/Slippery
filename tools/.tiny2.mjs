import { chromium } from 'playwright-core';
import { ALL } from './routes.mjs';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const out = new Map();
for (const w of [320, 1440]) {
  const c = await b.newContext({ viewport:{width:w,height:900} });
  for (const r of ALL) {
    const p = await c.newPage();
    try { await p.goto('http://127.0.0.1:3200'+r,{waitUntil:'load',timeout:25000}); await p.waitForTimeout(120); }
    catch { await p.close(); continue; }
    const d = await p.evaluate(() => {
      const res=[];
      for (const el of document.querySelectorAll('body *, body svg text')) {
        if (!el.ownerSVGElement && !el.checkVisibility?.({checkVisibilityCSS:true})) continue;
        if (el.closest('.sr-only')||el.classList.contains('sr-only')) continue;
        const t=[...el.childNodes].some(n=>n.nodeType===3&&n.textContent.trim().length>0);
        if (!t) continue;
        const px=parseFloat(getComputedStyle(el).fontSize);
        if (px < 11 - 0.5 + 0.5) res.push(`${px.toFixed(1)}px ${el.tagName.toLowerCase()}.${String(el.className.baseVal ?? el.className).split(' ')[0]} "${el.textContent.trim().slice(0,18)}"`);
      }
      return res;
    });
    for (const x of d) out.set(`${x} @${w}`, (out.get(`${x} @${w}`)||0)+1);
    await p.close();
  }
  await c.close();
}
await b.close();
const rows=[...out.keys()];
const uniq=new Map();
for (const r of rows) { const k=r.replace(/"[^"]*"/,'').trim(); uniq.set(k,(uniq.get(k)||0)+1); }
for (const [k,v] of [...uniq.entries()].sort((a,b)=>b[1]-a[1]).slice(0,20)) console.log(v, k);
console.log('total distinct', rows.length);
