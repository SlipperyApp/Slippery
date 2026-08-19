import { chromium } from 'playwright-core';
import { readFileSync } from 'node:fs';
const axe = readFileSync('node_modules/axe-core/axe.min.js', 'utf8');
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const p = await b.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
for (const path of ['/', '/dashboard', '/settings', '/signup']) {
  await p.goto('http://localhost:3100' + path, { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(900);
  await p.addScriptTag({ content: axe });
  const r = await p.evaluate(async () => await window.axe.run(document, { resultTypes: ['violations'] }));
  console.log('\n===== ' + path);
  for (const v of r.violations) {
    if (v.id === 'region') { console.log(v.id, v.nodes.length, '| first:', v.nodes[0].html.slice(0,80)); continue; }
    console.log('--', v.id, v.impact, v.nodes.length);
    for (const n of v.nodes.slice(0, 3)) console.log('    ', n.html.slice(0, 130).replace(/\n/g,' '), '\n      >', (n.failureSummary||'').split('\n').slice(1,3).join(' '));
  }
}
await b.close();
