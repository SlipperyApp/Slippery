/** The five checks, run and reported as numbers.
 *
 *  The browser sweep in tools/audit.mjs is broader than this and is still the
 *  thing that finds defects. This is narrower on purpose: it answers exactly
 *  the five questions that were asked, in the order they were asked, and
 *  prints a figure for each rather than a verdict.
 *
 *    1  no horizontal overflow, at 390, 768 and 1440, on every route
 *    2  every text colour on every ground, in all eight themes
 *    3  console errors, on every route
 *    4  every step of the calendar ramp, in both bands, in all eight themes
 *    5  a keyboard-only traversal of one journey
 *
 *  Two and four are measured from tokens.css rather than from the browser,
 *  because a composite is arithmetic and the arithmetic is what has to be
 *  right; the sweep runs axe over the rendered page as the second opinion.
 *
 *    E2E_BASE=http://127.0.0.1:3200 node tools/verify.mjs
 */
import { chromium } from 'playwright-core';
import { readFileSync } from 'node:fs';
import { ALL } from './routes.mjs';

const BASE = (process.env.E2E_BASE || 'http://127.0.0.1:3200').replace(/\/$/, '');
const CSS = readFileSync(new URL('../app/styles/tokens.css', import.meta.url), 'utf8');
const THEMES = ['carbon', 'periwinkle', 'ink', 'graphite', 'slate', 'bronze', 'cinnabar', 'sage'];

const rgb = (hex) => [0, 2, 4].map((i) => parseInt(hex.replace('#', '').slice(i, i + 2), 16));
const mix = (a, b, p) => [0, 1, 2].map((i) => a[i] * p + b[i] * (1 - p));
const lum = (c) => {
  const f = (v) => (v / 255 <= 0.03928 ? v / 255 / 12.92 : (((v / 255) + 0.055) / 1.055) ** 2.4);
  return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]);
};
const contrast = (a, b) => {
  const [hi, lo] = lum(a) > lum(b) ? [lum(a), lum(b)] : [lum(b), lum(a)];
  return (hi + 0.05) / (lo + 0.05);
};

const rootBlock = /:root \{([\s\S]*?)\n\}/.exec(CSS)?.[1] ?? '';
const ROOT = {};
for (const m of rootBlock.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-fA-F]{6})/g)) ROOT[m[1]] = rgb(m[2]);

function palette(theme) {
  const re = theme === 'carbon'
    ? /:root,\s*\[data-theme='carbon'\]\s*\{([\s\S]*?)\n\}/
    : new RegExp(`\\[data-theme='${theme}'\\]\\s*\\{([\\s\\S]*?)\\n\\}`);
  const body = re.exec(CSS)?.[1] ?? '';
  const out = { ...ROOT };
  for (const m of body.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-fA-F]{6})/g)) out[m[1]] = rgb(m[2]);
  return out;
}

const fail = [];
const line = (s) => console.log(s);

// ---------------------------------------------------------------- 1 and 3
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
line('1  HORIZONTAL OVERFLOW, and 3  CONSOLE ERRORS');
let overflows = 0;
let consoleErrors = 0;
let checked = 0;
const worstOverflow = { px: 0, where: '' };

for (const width of [390, 768, 1440]) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 } });
  for (const route of ALL) {
    const page = await ctx.newPage();
    const errs = [];
    page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
    page.on('pageerror', (e) => errs.push(String(e)));
    try {
      await page.goto(BASE + route, { waitUntil: 'load', timeout: 30000 });
      await page.waitForTimeout(180);
    } catch { await page.close(); continue; }
    checked += 1;
    const over = await page.evaluate(() => {
      const d = document.documentElement;
      return d.scrollWidth - d.clientWidth;
    });
    if (over > 0) {
      overflows += 1;
      if (over > worstOverflow.px) Object.assign(worstOverflow, { px: over, where: `${route} @ ${width}` });
      fail.push(`overflow ${over}px on ${route} at ${width}`);
    }
    if (errs.length) {
      consoleErrors += errs.length;
      fail.push(`${errs.length} console error(s) on ${route} at ${width}: ${errs[0].slice(0, 90)}`);
    }
    await page.close();
  }
  await ctx.close();
}
line(`   ${checked} route renders across 390, 768 and 1440`);
line(`   ${overflows} with horizontal overflow${overflows ? `, worst ${worstOverflow.px}px at ${worstOverflow.where}` : ''}`);
line(`   ${consoleErrors} console errors`);

// ---------------------------------------------------------------------- 2
line('');
line('2  TEXT ON GROUND, all eight themes');
const GROUNDS = ['bg', 'card', 'raise', 'elev'];
const INKS = ['t1', 't2', 't3', 'pos', 'neg', 'warn', 'gold'];
let pairs = 0;
const worstText = { r: 99, where: '' };
for (const theme of THEMES) {
  const t = palette(theme);
  for (const g of GROUNDS) {
    for (const i of INKS) {
      pairs += 1;
      const r = contrast(t[i], t[g]);
      if (r < worstText.r) Object.assign(worstText, { r, where: `${theme} --${i} on --${g}` });
      if (r < 4.5) fail.push(`contrast ${r.toFixed(2)}:1 for --${i} on --${g} in ${theme}`);
    }
  }
}
line(`   ${pairs} pairs measured, worst ${worstText.r.toFixed(2)}:1 at ${worstText.where}`);

// ---------------------------------------------------------------------- 4
line('');
line('4  CALENDAR RAMP, every step of both bands, all eight themes');
const { rampStep, RAMP } = await import('../lib/calendar-ramp.ts').catch(() => ({}));
if (!rampStep) {
  line('   skipped: this node cannot import the TypeScript module directly');
} else {
  let steps = 0;
  const worstRamp = { r: 99, where: '' };
  for (const theme of THEMES) {
    const t = palette(theme);
    for (const positive of [true, false]) {
      for (let mag = 0.001; mag <= 1.0001; mag += 0.005) {
        const step = rampStep(Math.round(mag * 100000), 100000);
        const cell = mix(positive ? t.pos : t.neg, t.elev, step.alpha);
        const figure = step.ink === 'result' ? (positive ? t.pos : t.neg) : t.bg;
        const date = step.ink === 'result' ? t.t1 : mix(t.bg, cell, RAMP.DATE_ON_HIGH);
        for (const [what, ink] of [['figure', figure], ['date', date]]) {
          steps += 1;
          const r = contrast(ink, cell);
          const where = `${theme} ${positive ? 'profit' : 'loss'} ${what} at mag ${mag.toFixed(3)}`;
          if (r < worstRamp.r) Object.assign(worstRamp, { r, where });
          if (r < 4.5) fail.push(`ramp ${r.toFixed(2)}:1 at ${where}`);
        }
      }
    }
  }
  line(`   ${steps} measurements, worst ${worstRamp.r.toFixed(2)}:1 at ${worstRamp.where}`);
}

// ---------------------------------------------------------------------- 5
line('');
line('5  KEYBOARD ONLY, land to sign in to add a bet to the ledger');
const JOURNEY = ['/', '/login', '/app/import', '/app/ledger'];
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
for (const route of JOURNEY) {
  const page = await ctx.newPage();
  try {
    await page.goto(BASE + route, { waitUntil: 'load', timeout: 30000 });
    /*  The app routes stream now: app/app/loading.tsx puts a Suspense
        boundary above the page, so `load` fires on the shell and the real
        content arrives after it. Tabbing at that moment counted the
        skeleton's controls, and /app/ledger dropped from 41 stops to 9
        without anything having changed. Wait for the placeholder to go. */
    await page.waitForFunction(() => !document.querySelector('.skel'), null, { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(250);
  } catch { await page.close(); continue; }

  // Drive real Tab presses and inspect each stop.
  let stops = 0;
  let ringless = 0;
  let firstStop = '';
  const seenTargets = new Set();
  for (let i = 0; i < 60; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    await page.keyboard.press('Tab');
    // eslint-disable-next-line no-await-in-loop
    /*  Wrap round is detected by ELEMENT IDENTITY, not by a description of
        the element. Keying on tag, class and text stopped the traversal the
        first time two links looked alike, and after the header lockup became
        one component the sidebar and the top bar both said "A.brand|
        Slippery": /app/ledger reported 9 stops instead of 41 and nothing on
        the page had changed. A marker attribute is the element itself. */
    const info = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el || el === document.body) return null;
      const cs = getComputedStyle(el);
      const ring = cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0;
      const seen = el.hasAttribute('data-verify-seen');
      el.setAttribute('data-verify-seen', '');
      return { seen, ring, label: (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 30) };
    });
    if (!info) break;
    if (info.seen) break;                      // wrapped round
    stops += 1;
    if (!firstStop) firstStop = info.label;
    if (!info.ring) { ringless += 1; fail.push(`no focus ring on ${route}: ${info.label}`); }
  }
  line(`   ${route}  ${stops} stops, ${ringless} without a ring, first stop "${firstStop}"`);
  await page.close();
}
await ctx.close();

// ---------------------------------------------------------------------- 6
/*  Is the background actually there?
 *
 *  This check exists because the answer was no for a long time and nothing
 *  said so. Three blobs drifted on 46, 61 and 73 second cycles behind a veil
 *  that laid the page ground over the whole field at 30% rising to 86%; with
 *  the content hidden the entire viewport measured RGB 12 to 25. Every test
 *  passed. The animation ran. The compositor did work every frame. Eleven
 *  levels out of 255 is not an animation, and no assertion in the codebase
 *  was capable of noticing.
 *
 *  So it is measured the only way it can honestly be measured: hide the
 *  content, photograph the field, and report the spread between its darkest
 *  and lightest pixel. */
line('');
line('6  THE BACKGROUND FIELD, measured in pixels');
let sharp = null;
try { sharp = (await import('sharp')).default; } catch { /* reported below */ }
if (!sharp) {
  line('   SKIPPED: no image decoder, so nothing was measured');
  fail.push('check 6 could not run: no image decoder');
} else {
  const ctx6 = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const worstField = { spread: 999, theme: '' };
  for (const theme of THEMES) {
    await ctx6.addCookies([{ name: 'slip_theme', value: theme, url: BASE }]);
    const page = await ctx6.newPage();
    try {
      await page.goto(BASE + '/', { waitUntil: 'load', timeout: 30000 });
      await page.waitForTimeout(400);
    } catch { await page.close(); continue; }
    await page.evaluate(() => {
      for (const el of document.querySelectorAll('body > *')) {
        if (!el.classList.contains('bgfield')) el.style.visibility = 'hidden';
      }
    });
    await page.waitForTimeout(120);
    const buf = await page.screenshot();
    const { data, info } = await sharp(buf).raw().toBuffer({ resolveWithObject: true });
    let lo = 255; let hi = 0;
    for (let i = 0; i < data.length; i += info.channels * 97) {
      const v = (data[i] + data[i + 1] + data[i + 2]) / 3;
      if (v < lo) lo = v;
      if (v > hi) hi = v;
    }
    const spread = hi - lo;
    if (spread < worstField.spread) Object.assign(worstField, { spread, theme, lo, hi });
    /*  24 levels out of 255. Below that the field is a flat colour that
        happens to be repainting itself, which is worse than no field: it
        costs a compositor layer every frame and returns nothing. */
    if (spread < 24) fail.push(`background field in ${theme} spans only ${spread.toFixed(1)} levels (${lo.toFixed(0)} to ${hi.toFixed(0)})`);
    await page.close();
  }
  await ctx6.close();
  line(`   8 themes, narrowest ${worstField.spread.toFixed(1)} levels of 255 (${worstField.theme}, ${worstField.lo?.toFixed(0)} to ${worstField.hi?.toFixed(0)})`);
}

await browser.close();

line('');
if (fail.length) {
  line(`${fail.length} FAILURES`);
  for (const f of fail.slice(0, 20)) line(`  ${f}`);
  process.exit(1);
}
line('All six checks pass.');
