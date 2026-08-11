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

await browser.close();
