import {chromium} from 'playwright-core';
const B='http://127.0.0.1:3903';
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const p=await (await b.newContext({viewport:{width:1440,height:900}})).newPage();
p.on('pageerror',e=>console.log('ERR:',e.message.slice(0,120)));

// 1 · do the ledger facet chips actually filter?
await p.goto(B+'/app/ledger',{waitUntil:'networkidle'});await p.waitForTimeout(900);
const before=await p.locator('.bet').count();
await p.locator('.chips button:has-text("Won")').first().click();await p.waitForTimeout(500);
const after=await p.locator('.bet').count();
const cur1=await p.locator('.chips button[aria-current=true]').innerText();
console.log(`ledger facets: rows ${before} -> ${after} | selected "${cur1.trim()}"`,
  before===after?'  ← LOOKS SELECTED BUT FILTERS NOTHING':'  ok');

// 2 · signup unit Custom
await p.goto(B+'/signup/unit',{waitUntil:'networkidle'});await p.waitForTimeout(700);
const u0=await p.evaluate(()=>window.__slippery.cur.unit);
await p.locator('button:has-text("Custom")').first().click();await p.waitForTimeout(400);
console.log('unit Custom: unit',u0,'->',await p.evaluate(()=>window.__slippery.cur.unit),
  '| field?',await p.locator('input[data-mstake],input#customunit').count());

// 3 · plan cells
await p.goto(B+'/signup/plan',{waitUntil:'networkidle'});await p.waitForTimeout(700);
await p.locator('[data-plan="monthly"]').click();await p.waitForTimeout(400);
console.log('plan cells: aria-current ->',
  await p.locator('[data-plan][aria-current=true]').getAttribute('data-plan').catch(()=>'none'),
  '| cur.plan',await p.evaluate(()=>window.__slippery.cur.plan));

// 4 · feed reactions
await p.goto(B+'/app/social/feed',{waitUntil:'networkidle'});await p.waitForTimeout(700);
const r0=await p.locator('.feedrow').first().innerText();
await p.locator('.react').first().click();await p.waitForTimeout(400);
console.log('reaction:',r0===await p.locator('.feedrow').first().innerText()?'NOTHING HAPPENS':'ok');
console.log('feedwho for You has attrs:', await p.evaluate(()=>{
 const rows=[...document.querySelectorAll('.feedwho')];
 return rows.map(e=>Object.keys(e.dataset).join(',')||'NONE').join(' | ')}));
await b.close();
