/* Rasterise the mark into the icons a phone asks for.
 *
 * Run after any change to public/icon.svg. It uses the browser that is
 * already installed for the audit rather than adding an image toolchain for
 * four files.
 */
import { chromium } from 'playwright-core';
import { readFileSync, copyFileSync } from 'node:fs';

const CHROME = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const svg = readFileSync('public/icon.svg', 'utf8');

const b = await chromium.launch({ executablePath: CHROME });
for (const [name, size] of [['favicon-32.png', 32], ['icon-192.png', 192], ['icon-512.png', 512], ['apple-touch-icon.png', 180]]) {
  const p = await b.newPage({ viewport: { width: size, height: size } });
  await p.setContent(`<style>html,body{margin:0;padding:0}svg{display:block;width:${size}px;height:${size}px}</style>` + svg);
  await p.screenshot({ path: 'public/' + name, omitBackground: true });
  await p.close();
  console.log('public/' + name, size + 'px');
}
await b.close();
copyFileSync('public/favicon-32.png', 'public/favicon.ico');
console.log('public/favicon.ico');
