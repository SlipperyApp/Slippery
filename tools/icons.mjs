/* Rasterise icon.svg into the PNG sizes iOS and Android need.
   Run once after changing the icon: node tools/icons.mjs */
import { chromium } from 'playwright-core';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = path.dirname(path.dirname(new URL(import.meta.url).pathname));
const CHROME = process.env.CHROME_BIN || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

/* Maskable icons need the artwork inside the safe zone: Android crops to a
   circle, so a full-bleed icon loses its corners. */
const MASKABLE_INSET = 0.10;

const sizes = [
  { file: 'icon-192.png', size: 192, maskable: false },
  { file: 'icon-512.png', size: 512, maskable: false },
  { file: 'icon-180.png', size: 180, maskable: false },
  { file: 'icon-maskable.png', size: 512, maskable: true }
];

const svg = await readFile(path.join(root, 'public', 'icon.svg'), 'utf8');
const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });

for (const { file, size, maskable } of sizes) {
  const pad = maskable ? Math.round(size * MASKABLE_INSET) : 0;
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  await page.setContent(
    `<html><body style="margin:0;background:#0B1020">
     <div style="width:${size}px;height:${size}px;display:grid;place-items:center;background:#0B1020">
       <div style="width:${size - pad * 2}px;height:${size - pad * 2}px">${svg}</div>
     </div></body></html>`
  );
  const buf = await page.screenshot({ omitBackground: false });
  await writeFile(path.join(root, 'public', file), buf);
  await page.close();
  console.log('  ' + file + '  ' + size + 'x' + size + (maskable ? ' (maskable)' : ''));
}

/* ── the share card ──
   og:image is the one asset a link preview shows, and every scraper
   rasterises it server-side, so it cannot be SVG and cannot rely on a
   web font being fetched. It is drawn here from the same palette and
   the same silk artwork the site uses, with system serif/sans stand-ins
   for Fraunces and Schibsted Grotesk — at 1200x630 in a feed, the
   difference does not survive the downscale, and a missing font would.
   Facebook and LinkedIn both cache aggressively; regenerate with
   `node tools/icons.mjs` and the filename stays /og.png so the cache
   key does not change. */
const OG = `<html><body style="margin:0">
<div style="width:1200px;height:630px;position:relative;overflow:hidden;
            background:#0B1020;color:#F1F5F9;
            font-family:system-ui,-apple-system,'Segoe UI',sans-serif">
  <div style="position:absolute;inset:-10%;
    background:
      radial-gradient(1200px 820px at 50% -12%, #182238, transparent 66%),
      radial-gradient(820px 560px at 88% 6%, rgba(56,189,248,.20), transparent 68%),
      radial-gradient(760px 700px at 2% 24%, rgba(93,118,203,.26), transparent 70%)"></div>
  <svg viewBox="0 0 1200 620" preserveAspectRatio="none"
       style="position:absolute;left:-6%;right:-6%;top:-14%;width:112%;height:70%;opacity:.55">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="#5D76CB"/><stop offset=".4" stop-color="#38BDF8"/>
        <stop offset=".75" stop-color="#8FC7C0"/><stop offset="1" stop-color="#8B5CF6"/>
      </linearGradient>
      <filter id="b" x="-25%" y="-25%" width="150%" height="150%">
        <feGaussianBlur stdDeviation="38"/></filter>
    </defs>
    <path d="M-120,300 C160,175 340,430 620,300 C900,175 1060,415 1340,285 L1340,460
             C1060,590 900,350 620,478 C340,606 160,366 -120,494 Z"
          fill="url(#g)" filter="url(#b)"/>
  </svg>
  <div style="position:relative;padding:74px 78px;height:630px;box-sizing:border-box;
              display:flex;flex-direction:column;justify-content:space-between">
    <div style="display:flex;align-items:center;gap:20px">
      <div style="width:64px;height:64px;border-radius:18px;
                  background:linear-gradient(135deg,#5D76CB,#7DD3FC)"></div>
      <span style="font-size:40px;font-weight:700;letter-spacing:-.02em">Slippery</span>
    </div>
    <div>
      <p style="margin:0 0 20px;font-size:20px;letter-spacing:.22em;
                text-transform:uppercase;color:#7DD3FC">Bet slip tracker</p>
      <h1 style="margin:0 0 22px;font-size:80px;line-height:1.02;letter-spacing:-.03em;
                 font-family:Georgia,'Times New Roman',serif;font-weight:600">
        Don't let your profit slip.</h1>
      <p style="margin:0;font-size:27px;line-height:1.45;color:#98A6BC;max-width:22ch">
        Capture a bet when you place it, not when it wins.</p>
    </div>
    <div style="display:flex;gap:14px">
      <span style="padding:13px 22px;border-radius:999px;background:rgba(255,255,255,.055);
                   border:1px solid rgba(255,255,255,.10);font-size:21px">20 free slips</span>
      <span style="padding:13px 22px;border-radius:999px;background:rgba(134,239,172,.14);
                   border:1px solid rgba(134,239,172,.34);font-size:21px;color:#86EFAC;
                   font-variant-numeric:tabular-nums">+£1,938.38 this month</span>
    </div>
  </div>
</div></body></html>`;

{
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
  await page.setContent(OG);
  await writeFile(path.join(root, 'public', 'og.png'), await page.screenshot());
  await page.close();
  console.log('  og.png    1200x630 (link preview)');
}

await browser.close();
