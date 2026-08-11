import { chromium } from 'playwright-core';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import path from 'node:path';
const root = path.dirname(path.dirname(new URL(import.meta.url).pathname));
const MIME={'.html':'text/html','.js':'text/javascript','.woff2':'font/woff2','.png':'image/png','.svg':'image/svg+xml','.webmanifest':'application/json'};
const server = createServer(async (req,res)=>{let p=req.url.split('?')[0]; if(p==='/')p='/index.html';
  try{const b=await readFile(path.join(root,'public',p)); res.writeHead(200,{'content-type':MIME[path.extname(p)]||'application/octet-stream'}); res.end(b);}catch{res.writeHead(404);res.end();}});
await new Promise(r=>server.listen(0,r));
const base='http://127.0.0.1:'+server.address().port;
const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--no-sandbox']});
const page = await b.newPage({viewport:{width:390,height:844},deviceScaleFactor:2});

async function measure(label, css) {
  const runs=[];
  for(let a=0;a<3;a++){
    await page.goto(base,{waitUntil:'networkidle'});
    if(css) await page.addStyleTag({content:css});
    await page.waitForTimeout(600);
    const t = await page.evaluate(async ()=>{
      const f=[];let last=performance.now(),stop=false;
      const tick=n=>{f.push(n-last);last=n;if(!stop)requestAnimationFrame(tick)};
      requestAnimationFrame(tick);
      await new Promise(r=>setTimeout(r,400)); f.length=0; last=performance.now();
      for(let i=0;i<60;i++){window.scrollBy(0,30);await new Promise(r=>setTimeout(r,16));}
      stop=true;await new Promise(r=>setTimeout(r,50));return f;
    });
    const s=t.slice(3).sort((x,y)=>x-y);
    runs.push(s[Math.floor(s.length*0.95)]||0);
  }
  runs.sort((x,y)=>x-y);
  console.log('  '+label.padEnd(34)+String(runs[1].toFixed(1)).padStart(7)+'ms   ('+runs.map(r=>r.toFixed(0)).join('/')+')');
}
console.log('  scenario                              p95   (3 runs)');
await measure('everything on', null);
await measure('silk: no blur', '.sky-band-in{filter:none!important}');
await measure('silk: no mask', '.sky-silk{-webkit-mask-image:none!important;mask-image:none!important}');
await measure('silk: no animation', '.sky-band-in{animation:none!important}');
await measure('silk hidden', '.sky-silk{display:none!important}');
await measure('sky hidden', '.sky{display:none!important}');
await b.close(); server.close();
