import { chromium } from 'playwright-core';
import { ALL } from './routes.mjs';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const c = await b.newContext({ viewport:{width:1440,height:900} });
const sizes = new Map(); const gaps = new Map(); const pads = new Map();
for (const r of ALL) {
  const p = await c.newPage();
  try { await p.goto('http://127.0.0.1:3200'+r,{waitUntil:'load',timeout:25000}); await p.waitForTimeout(120); }
  catch { await p.close(); continue; }
  const d = await p.evaluate(() => {
    const S={},G={},P={};
    for (const el of document.querySelectorAll('body *')) {
      if (!el.checkVisibility?.({checkVisibilityCSS:true})) continue;
      const cs=getComputedStyle(el);
      const t=[...el.childNodes].some(n=>n.nodeType===3&&n.textContent.trim());
      if (t) S[cs.fontSize]=(S[cs.fontSize]||0)+1;
      if (cs.display.includes('flex')||cs.display.includes('grid')) {
        const g=cs.rowGap; if(g&&g!=='normal'&&g!=='0px') G[g]=(G[g]||0)+1;
      }
      for (const side of ['paddingTop','paddingLeft']) {
        const v=cs[side]; if(v&&v!=='0px') P[v]=(P[v]||0)+1;
      }
    }
    return {S,G,P};
  });
  for (const [k,v] of Object.entries(d.S)) sizes.set(k,(sizes.get(k)||0)+v);
  for (const [k,v] of Object.entries(d.G)) gaps.set(k,(gaps.get(k)||0)+v);
  for (const [k,v] of Object.entries(d.P)) pads.set(k,(pads.get(k)||0)+v);
  await p.close();
}
await b.close();
const top=(m,n)=>[...m.entries()].sort((a,b)=>b[1]-a[1]).slice(0,n);
console.log('FONT SIZES in use (px : count)');
for (const [k,v] of top(sizes,30)) console.log('  ',k,v);
console.log('\nROW GAPS'); for (const [k,v] of top(gaps,16)) console.log('  ',k,v);
console.log('\nPADDINGS'); for (const [k,v] of top(pads,20)) console.log('  ',k,v);
