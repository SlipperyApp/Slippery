/* The share card, rendered once and committed.
 *
 * A link pasted into a group chat or forwarded by the bot rendered as a bare
 * URL, and invite links are the product's growth loop. Drawn rather than
 * screenshotted so it is the same at any moment and carries no live figure
 * that would go stale — and no profit figure at all, which is a deliberate
 * choice given the category.
 */
import { chromium } from 'playwright-core';
import { readFileSync } from 'node:fs';

const b64 = (p) => readFileSync(p).toString('base64');
const serif = b64('public/fonts/SourceSerif4-400-latin.woff2');
const ui = b64('public/fonts/SchibstedGrotesk-400-latin.woff2');

const html = `<!doctype html><meta charset="utf-8"><style>
@font-face{font-family:S;src:url(data:font/woff2;base64,${serif}) format('woff2');font-weight:100 900}
@font-face{font-family:U;src:url(data:font/woff2;base64,${ui}) format('woff2');font-weight:100 900}
*{margin:0;box-sizing:border-box}
body{width:1200px;height:630px;background:#0C0E13;color:#E6EBF3;
 font-family:U,sans-serif;display:flex;flex-direction:column;justify-content:center;
 padding:84px;position:relative;overflow:hidden}
.rib{position:absolute;left:-10%;right:-10%;bottom:-6%;height:52%;opacity:.5}
.eyebrow{font-size:22px;letter-spacing:.18em;text-transform:uppercase;color:#7A8598;
 word-spacing:-.06em;margin-bottom:26px}
h1{font-family:S,serif;font-weight:700;font-size:88px;line-height:1.04;letter-spacing:-.025em}
h1 em{font-style:normal;color:#A8C2E8}
p{font-size:30px;color:#9AA6BB;margin-top:26px;max-width:26ch;line-height:1.4}
.mark{position:absolute;top:64px;left:84px;display:flex;align-items:center;gap:14px;
 font-size:26px;font-weight:800;letter-spacing:-.01em}
.dot{width:34px;height:34px;border-radius:10px;background:linear-gradient(135deg,#A8C2E8,#6E86B8)}
</style>
<div class="mark"><span class="dot"></span>SLIPPERY</div>
<svg class="rib" viewBox="0 0 1440 300" preserveAspectRatio="none">
 <defs><linearGradient id="g" x1="0" x2="1">
  <stop offset="0" stop-color="#6E86B8" stop-opacity="0"/>
  <stop offset=".32" stop-color="#6E86B8"/>
  <stop offset="1" stop-color="#A8C2E8" stop-opacity="0"/></linearGradient></defs>
 <path d="M-200 140C180 80 460 210 740 120S1240 50 1640 130" stroke="url(#g)" stroke-width="15" fill="none" stroke-linecap="round"/>
 <path d="M-200 195C250 255 520 100 820 180S1280 240 1640 155" stroke="url(#g)" stroke-width="11" fill="none" stroke-linecap="round" opacity=".8"/>
 <path d="M-200 95C300 165 560 45 900 110S1300 165 1640 90" stroke="url(#g)" stroke-width="20" fill="none" stroke-linecap="round" opacity=".55"/></svg>
<div class="eyebrow">Bet tracking for UK and Irish bettors</div>
<h1>Don't let your profit <em>slip.</em></h1>
<p>Capture the bet when you place it, not when it wins.</p>`;

const browser = await chromium.launch({
  executablePath: process.env.OG_CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
});
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
await page.setContent(html, { waitUntil: 'load' });
await page.waitForTimeout(400);
await page.screenshot({ path: 'public/og.png' });
await browser.close();
console.log('public/og.png written');
