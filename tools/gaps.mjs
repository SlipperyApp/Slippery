/* ============================================================
   DEAD SCROLL DETECTOR
   ============================================================
   Measuring element boxes does not find a blank screen. A sticky
   stage spans its whole track, and a section with 400px of unused
   padding is still one continuous box, so a box-based sweep reports
   no gaps on a page that is visibly half empty.

   This walks text nodes and images instead — the things a reader can
   actually see — projects each onto the y axis, merges the spans and
   reports the holes between them. A hole taller than half a viewport
   is a screen of nothing, whatever the boxes say.
   ============================================================ */
import { chromium } from 'playwright-core';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';

const PORT = 4183;
const html = readFileSync('public/index.html', 'utf8');
const srv = createServer((_, res) => {
  res.writeHead(200, { 'content-type': 'text/html' });
  res.end(html);
}).listen(PORT);

const W = Number(process.argv[2] || 390);
const H = Number(process.argv[3] || 844);

const browser = await chromium.launch({ executablePath: process.env.CHROME_BIN || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await browser.newPage({ viewport: { width: W, height: H } });
await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'networkidle' });
await page.waitForTimeout(600);

const report = await page.evaluate((vh) => {
  const spans = [];
  const push = (r) => {
    if (r && r.height > 0 && r.width > 0) spans.push([r.top + scrollY, r.bottom + scrollY]);
  };
  const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = walk.nextNode(); n; n = walk.nextNode()) {
    if (!n.nodeValue.trim()) continue;
    const p = n.parentElement;
    if (!p || p.closest('[hidden]') || getComputedStyle(p).visibility === 'hidden') continue;
    const rng = document.createRange();
    rng.selectNodeContents(n);
    push(rng.getBoundingClientRect());
  }
  for (const el of document.querySelectorAll('svg,img,canvas,input,button,[class*=bar],[class*=cell],[class*=dot]')) {
    if (el.closest('[hidden]')) continue;
    push(el.getBoundingClientRect());
  }
  spans.sort((a, b) => a[0] - b[0]);
  const merged = [];
  for (const s of spans) {
    const last = merged[merged.length - 1];
    if (last && s[0] <= last[1] + 8) last[1] = Math.max(last[1], s[1]);
    else merged.push([s[0], s[1]]);
  }
  const gaps = [];
  for (let i = 1; i < merged.length; i++) {
    const g = merged[i][0] - merged[i - 1][1];
    if (g > vh * 0.5) gaps.push({ from: Math.round(merged[i - 1][1]), to: Math.round(merged[i][0]), px: Math.round(g) });
  }
  return { page: Math.round(document.documentElement.scrollHeight), gaps };
}, H);

console.log(`page ${report.page}px  (${(report.page / H).toFixed(1)} screens at ${W}x${H})`);
if (!report.gaps.length) console.log('no dead bands over half a screen');
for (const g of report.gaps) console.log(`  DEAD ${g.px}px  ${g.from} -> ${g.to}`);

await browser.close();
srv.close();
process.exit(report.gaps.length ? 1 : 0);
