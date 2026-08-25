import {chromium} from 'playwright-core';
import {ROUTES} from './lib/proto/routes.ts';
const B='http://127.0.0.1:3903';
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const p=await (await b.newContext({viewport:{width:1440,height:900}})).newPage();
const errs=[]; p.on('pageerror',e=>errs.push(e.message));
const dead=[], threw=[]; let tested=0;

const snap=()=>p.evaluate(()=>({
  url:location.pathname,
  cur:JSON.stringify(window.__slippery?.cur||{}),
  dom:(document.querySelector('#ph')?.innerHTML||'').length,
  sheet:!!document.querySelector('.sheet'),
  toast:!!document.querySelector('.toast'),
}));

for(const path of [...new Set(Object.values(ROUTES))]){
  await p.goto(B+path,{waitUntil:'domcontentloaded'}).catch(()=>{});
  await p.waitForTimeout(420);
  const n=await p.locator('.ph button:visible').count();
  for(let i=0;i<Math.min(n,22);i++){
    const el=p.locator('.ph button:visible').nth(i);
    let label='',attrs='';
    try{
      label=((await el.getAttribute('aria-label'))||(await el.innerText())||'').trim().replace(/\s+/g,' ').slice(0,38);
      attrs=await el.evaluate(e=>Object.keys(e.dataset).join(','));
    }catch{ continue }
    const before=await snap();
    const e0=errs.length;
    try{ await el.click({timeout:700}) }catch{ continue }
    tested++;
    await p.waitForTimeout(220);
    const after=await snap();
    if(errs.length>e0) threw.push(`${path} · "${label}" [${attrs}] · ${errs[errs.length-1].slice(0,60)}`);
    const changed = before.url!==after.url || before.cur!==after.cur
      || before.dom!==after.dom || before.sheet!==after.sheet || before.toast!==after.toast;
    if(!changed) dead.push(`${path} · "${label}" [${attrs||'NO data-*'}]`);
    // return to the page only if we left it or opened something
    await p.evaluate(()=>{try{window.__slippery.closeSheet()}catch{}});
    if(after.url!==path){ await p.goto(B+path,{waitUntil:'domcontentloaded'}).catch(()=>{}); await p.waitForTimeout(300); }
    else await p.waitForTimeout(80);
  }
}
await b.close();
console.log(`tested ${tested} buttons across ${new Set(Object.values(ROUTES)).size} routes`);
console.log(`\nTHREW (${threw.length}):`); [...new Set(threw)].slice(0,15).forEach(x=>console.log('  '+x));
console.log(`\nNO OBSERVABLE EFFECT (${dead.length}):`); [...new Set(dead)].slice(0,45).forEach(x=>console.log('  '+x));
