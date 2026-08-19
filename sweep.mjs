import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';
const PATHS = ['/','/demo','/signup','/signup/rate-limited','/signup/verify','/signup/name','/signup/unit','/signup/sports','/signup/plan','/sign-in','/dashboard','/ledger','/history','/social','/social/discover','/social/group','/social/person','/add','/add/crop','/add/analysing','/add/review','/add/manual','/add/linked','/add/history','/add/history/review','/settings','/settings/plan','/settings/referrals','/billing/trial','/billing/declined','/billing/read-only','/states/new-dashboard','/states/new-ledger','/states/new-social','/states/offline','/states/save-failed','/states/unreadable'];
mkdirSync('shots', { recursive: true });
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1.6, isMobile: true, hasTouch: true });
for (const path of PATHS) {
  await p.goto('http://localhost:3100' + path, { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(950);
  const name = path === '/' ? 'landing' : path.slice(1).replace(/\//g, '-');
  await p.screenshot({ path: `shots/${name}.png`, fullPage: true });
  const h = await p.evaluate(() => document.querySelector('.body')?.scrollHeight || 0);
  console.log(name.padEnd(26), h + 'px');
}
await b.close();
