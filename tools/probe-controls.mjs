/* THE FIVE CONTROLS THE SWEEP FOUND, CHECKED BY STATE RATHER THAN BY TEXT.
 *
 *   node tools/probe-controls.mjs [base] [width]
 *
 * tools/dead-buttons.mjs compares rendered text, so a control that only flips
 * an attribute reads as dead to it — feed reactions reported NOTHING HAPPENS
 * while working correctly. Each check here asserts the thing the control is
 * actually for: rows filtered, a field present, cur.plan recorded, aria-pressed
 * flipped, and no profile button pointing at yourself.
 *
 * Pass a deployment URL to check the live site rather than a local build.
 */
import { chromium } from 'playwright-core';
import { contextFor, isRemote } from './live-origin.mjs';

const B = (process.argv[2] || 'http://127.0.0.1:3903').replace(/\/$/, '');
const WIDTH = Number(process.argv[3] || 1440);
const AFTER = isRemote(B) ? 900 : 450;
/* A remote origin is fulfilled one curl at a time, so how long a route takes
   to mount varies run to run. A fixed sleep made this report a different
   control dead each time; wait for the thing itself to exist instead. */
const MOUNT_MS = isRemote(B) ? 45000 : 8000;

const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const ctx = await contextFor(b, B, { viewport: { width: WIDTH, height: 900 } });
const p = await ctx.newPage();
p.on('pageerror', (e) => console.log('ERR:', e.message.slice(0, 120)));

const go = async (path, expect) => {
  await p.goto(B + path, { waitUntil: 'domcontentloaded' }).catch(() => {});
  await p.waitForFunction(() => Boolean(window.__slippery), null, { timeout: MOUNT_MS })
    .catch(() => console.log(`  (${path} never mounted)`));
  if (expect) {
    await p.locator(expect).first().waitFor({ state: 'attached', timeout: MOUNT_MS })
      .catch(() => console.log(`  (${path}: ${expect} never appeared)`));
  }
  await p.waitForTimeout(AFTER);
};
const click = async (sel) => {
  const el = p.locator(sel).first();
  if (!(await p.locator(sel).count())) return false;
  await el.click({ timeout: 4000 }).catch(() => {});
  await p.waitForTimeout(AFTER);
  return true;
};

console.log(`\n${B} at ${WIDTH}\n`);

/* 1 · do the ledger facet chips actually filter, or only look selected? */
await go('/app/ledger', '.bet');
const before = await p.locator('.bet').count();
await click('.chips button:has-text("Won")');
const after = await p.locator('.bet').count();
const sel = await p.locator('.chips button[aria-current=true]').first().innerText().catch(() => '?');
console.log(`ledger facets   rows ${before} -> ${after} | selected "${sel.trim()}"`,
  before === after ? '  ← LOOKS SELECTED BUT FILTERS NOTHING' : '  ok');

/* 2 · Custom used to highlight itself and offer nothing to type into. */
await go('/signup/unit', '.chips button');
const u0 = await p.evaluate(() => window.__slippery?.cur?.unit);
await click('button:has-text("Custom")');
const field = await p.locator('input#customunit,[data-customunit]').count();
console.log(`unit Custom     unit ${u0} -> ${await p.evaluate(() => window.__slippery?.cur?.unit)} | field ${field}`,
  field ? '  ok' : '  ← NO WAY TO TYPE A UNIT');

/* 3 · the plan cells moved a highlight and recorded nothing, so checkout had
       no plan to read. */
await go('/signup/plan', '[data-plan]');
const cells = await p.locator('[data-plan]').count();
await click('[data-plan="monthly"]');
const plan = await p.evaluate(() => window.__slippery?.cur?.plan);
console.log(`plan cells      data-plan elements ${cells} | cur.plan ${plan}`,
  plan ? '  ok' : '  ← THE CHOICE IS NOT RECORDED');

/* 4 · reactions carried data-react with no handler behind it. */
await go('/app/social/feed', '.react');
const rk = await p.locator('.react').count();
const pre = rk ? await p.locator('.react').first().getAttribute('aria-pressed') : 'n/a';
await click('.react');
const post = rk ? await p.locator('.react').first().getAttribute('aria-pressed') : 'n/a';
console.log(`feed reactions  buttons ${rk} | aria-pressed ${pre} -> ${post}`,
  rk && pre !== post ? '  ok' : '  ← NOTHING TOGGLES');

/* 5 · the avatar for You was a button to nobody's profile. */
const who = await p.evaluate(() => [...document.querySelectorAll('.feedwho')]
  .map((e) => (e.tagName === 'BUTTON' ? Object.keys(e.dataset).join(',') || 'button,no data-*' : 'span')).join(' | '));
console.log(`feed avatars    ${who || 'none found'}`);

await b.close();
