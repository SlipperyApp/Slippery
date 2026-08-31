import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
const p = await b.newPage({ viewport: { width: 1440, height: 1000 } });
const errs=[];p.on('console',m=>{if(m.type()==='error')errs.push(m.text())});p.on('pageerror',e=>errs.push('PAGEERROR '+e.message));p.on('response',r=>{if(r.status()>=400)errs.push(r.status()+' '+r.url())});
await p.goto('http://127.0.0.1:3100/app', { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(2000);
const r = await p.evaluate(() => {
  const box = document.querySelector('#mod-curve .chartbox');
  const svg = box?.querySelector('svg');
  const cal = document.querySelector('#mod-calendar');
  return {
    boxW: box?.getBoundingClientRect().width, boxH: box?.getBoundingClientRect().height,
    hasSvg: !!svg, svgW: svg?.getBoundingClientRect().width, svgH: svg?.getBoundingClientRect().height,
    boxHTML: box ? box.innerHTML.slice(0, 200) : null,
    calH: cal?.getBoundingClientRect().height,
    calScroll: cal?.scrollHeight,
  };
});
console.log(JSON.stringify(r, null, 2));
console.log('ERRORS:', errs.slice(0,6).join('\n---\n'));
await b.close();
