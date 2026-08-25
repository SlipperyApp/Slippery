/* 19 · Rasterise the calendar artwork at every size the product needs.
 *
 *   node tools/icons.mjs
 *
 * One source — tools/calendar-art.mjs — so the icon, the favicon, the
 * maskable icon and the OG image cannot drift into three different marks
 * again, which is exactly what had happened.
 */
import { chromium } from 'playwright-core';
import { writeFileSync } from 'node:fs';
import { iconSvg, maskableSvg, ogSvg, INK } from './calendar-art.mjs';

const CHROME = process.env.CHROME_PATH
  || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

/* 16 is in the list because a browser tab really does ask for it, and it is
   the size the seven-column grid cannot survive — see the small cut in
   calendar-art.mjs. */
const ICONS = [
  ['icon-512.png', 512], ['icon-192.png', 192],
  ['apple-touch-icon.png', 180], ['favicon-32.png', 32], ['favicon-16.png', 16],
];

const browser = await chromium.launch({ executablePath: CHROME });

async function shoot(svg, w, h, out) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  await page.setContent(
    `<style>html,body{margin:0;background:${INK.bg}}svg{display:block}</style>${svg}`,
    { waitUntil: 'load' },
  );
  await page.screenshot({ path: 'public/' + out, omitBackground: false });
  await page.close();
  console.log('  ' + out.padEnd(24) + w + 'x' + h);
}

console.log('icons, from the calendar:');
for (const [name, size] of ICONS) await shoot(iconSvg(size), size, size, name);
await shoot(maskableSvg(512), 512, 512, 'icon-maskable-512.png');

console.log('open graph:');
await shoot(ogSvg(), 1200, 630, 'og.png');

/* The SVG icon is the one a modern browser prefers, so it is written rather
   than rasterised — and it is the same drawing. */
writeFileSync('public/icon.svg', iconSvg(512));
console.log('  icon.svg');

/* NO favicon.ico. The old one was a PNG with a .ico name, which works only
   because browsers sniff the bytes — and nothing in this product references
   it. icon.svg plus favicon-32.png covers every browser that matters. */

await browser.close();
