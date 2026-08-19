/* DOES THE APP RENDER WHAT THE PROTOTYPE RENDERS?
 *
 * The prototype is the visual and copy specification. Asserting that the port
 * is faithful by reading the diff is not the same as checking, so this loads
 * the prototype itself, drives its harness through all 35 views and every
 * sheet, drives the app through the same, and compares what each one puts on
 * screen.
 *
 * Text is compared exactly after whitespace is collapsed. A single changed
 * word is a failure, because copy is final and "if a string is in the
 * prototype, use it exactly".
 *
 * The differences that are expected are listed in ALLOWED below, each with
 * the rule that overrides the prototype. Anything not on that list fails.
 * Structural differences that are not copy are handled before comparing:
 * the app inserts one visually hidden h1 naming the view, it paints into the
 * page rather than a 390px phone frame, and it has no harness toolbar.
 */

/* WHERE THIS DELIBERATELY DOES NOT MATCH THE PROTOTYPE.
 *
 * "The prototype is the visual and copy specification. This document is the
 * data and behaviour specification. Prototype wins on look, this document
 * wins on rules." Each entry is a place a rule wins, named here so it is a
 * decision on the record rather than a silent divergence. */
const ALLOWED: { view: string; because: string; expect: RegExp }[] = [
  {
    view: 'ledger',
    because:
      'The prototype hardcodes Cashed 2 and Void 1 beside an All that counts the rows, ' +
      'so the strip reads 6 + 6 + 2 + 1 against a total of 12. The spec requires that ' +
      'every count derive from one query, that zero-count facets be hidden, and that the ' +
      'facet total equal the row total. All twelve sample bets are won or lost, so the two ' +
      'empty facets are not drawn and the figures above them are the prototype\'s exactly.',
    /* What the app must show instead, so a later change cannot quietly turn
       this allowance into cover for a different divergence. */
    expect: /Select All 12 Won 6 Lost 6 ✓/,
  },
];

import { chromium, type Browser, type Page } from 'playwright-core';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { ROUTES } from '../../lib/proto/routes.ts';

const APP = process.env.E2E_BASE || 'http://localhost:3100';
const CHROME = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const PORT = 3101;

const problems: string[] = [];
const note = (where: string, what: string) => problems.push(`${where}\n    ${what}`);

/* Collapse the things that are not copy: runs of whitespace, and the count-up
   animation's intermediate values, which are a different number every frame. */
const normalise = (s: string) =>
  s.replace(/\s+/g, ' ')
    .replace(/[+−-]?£[\d,]+\.\d{2}/g, '£#')
    .trim();

async function main() {
  const html = readFileSync('tests/fixtures/prototype.html', 'utf8');
  const server = createServer((_req, res) => {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(html);
  }).listen(PORT);

  const browser = await chromium.launch({ executablePath: CHROME });
  try {
    await compareViews(browser);
    await compareSheets(browser);
    await compareThemes(browser);
  } finally {
    await browser.close();
    server.close();
  }

  if (problems.length) {
    console.error(`\nDIVERGES FROM THE PROTOTYPE in ${problems.length} places:\n`);
    for (const p of problems) console.error('  ' + p);
    process.exit(1);
  }
  console.log('\nEvery view, every sheet and every theme matches the prototype.');
}

async function open(browser: Browser, url: string): Promise<Page> {
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    /* Settled rather than mid-entrance: the prototype staggers its sections
       in, and comparing during the stagger compares two different frames. */
    reducedMotion: 'reduce',
  });
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(900);
  return page;
}

const readBody = (page: Page) =>
  page.evaluate(() => (document.querySelector('#ph .body') as HTMLElement)?.innerText ?? '');

const readSheet = (page: Page) =>
  page.evaluate(() => (document.querySelector('#ph .sheet') as HTMLElement)?.innerText ?? '');

async function compareViews(browser: Browser) {
  const spec = await open(browser, `http://localhost:${PORT}/`);
  const app = await open(browser, APP + '/');

  const views = Object.keys(ROUTES);
  for (const view of views) {
    await spec.evaluate((v) => (0, eval)('go')(v), view);
    await spec.waitForTimeout(420);
    await app.evaluate((v) => (window as any).__slippery.go(v), view);
    await app.waitForTimeout(420);

    const want = normalise(await readBody(spec));
    /* The heading the app inserts is read, not drawn, so it is not part of
       what the prototype puts on screen and is removed before comparing. */
    const got = normalise((await readBody(app)).replace(/^[^\n]*\n/, (m) => (m.trim() ? '' : m)));

    if (want !== got) {
      const allowed = ALLOWED.find((a) => a.view === view);
      if (!allowed) {
        note(`view ${view}`, firstDifference(want, got));
      } else if (!allowed.expect.test(got)) {
        note(`view ${view}`, 'diverges from the prototype AND from what the rule requires.\n      ' +
          allowed.because + '\n      ' + firstDifference(want, got));
      } else {
        console.log(`view ${view}: diverges by design.\n  ${allowed.because}\n`);
      }
    }
  }
  await spec.close();
  await app.close();
}

async function compareSheets(browser: Browser) {
  const spec = await open(browser, `http://localhost:${PORT}/`);
  const app = await open(browser, APP + '/dashboard');

  /* `const SH` at the top level of a classic script lives in the global
     lexical environment, so it is in scope here even though it is not a
     property of window. */
  const keys: string[] = await spec.evaluate(() => {
    try { return Object.keys((0, eval)('SH')); } catch { return []; }
  });
  {
    const appKeys: string[] = await app.evaluate(() => (window as any).__slippery.sheetKeys);
    const specKeys = keys.length ? keys : sheetKeysFromSource();
    const missing = specKeys.filter((k) => !appKeys.includes(k));
    const extra = appKeys.filter((k) => !specKeys.includes(k));
    if (missing.length) note('sheets', 'the app is missing: ' + missing.join(', '));
    if (extra.length) note('sheets', 'the app has sheets the prototype does not: ' + extra.join(', '));

    for (const key of specKeys) {
      await spec.evaluate((k) => (0, eval)('sheet')(k), key);
      await spec.waitForTimeout(320);
      await app.evaluate((k) => (window as any).__slippery.sheet(k), key);
      await app.waitForTimeout(320);
      const want = normalise(await readSheet(spec));
      const got = normalise(await readSheet(app));
      if (want !== got) note(`sheet ${key}`, firstDifference(want, got));
      await spec.evaluate(() => (0, eval)('closeSheet')());
      await app.evaluate(() => (window as any).__slippery.closeSheet());
      await spec.waitForTimeout(120);
      await app.waitForTimeout(120);
    }
  }
  await spec.close();
  await app.close();
}

/* THE EIGHT THEMES, TOKEN BY TOKEN.
   Every colour in the product comes from these blocks, so if one token differs
   the whole theme is a near miss that nobody can point at. */
async function compareThemes(browser: Browser) {
  const spec = await open(browser, `http://localhost:${PORT}/`);
  const app = await open(browser, APP + '/dashboard');

  const TOKENS = ['--pos', '--neg', '--a', '--bg', '--p', '--s', '--card', '--line',
    '--t1', '--t2', '--t3', '--t4', '--elev', '--lg1', '--lg2'];
  const THEMES = ['periwinkle', 'ink', 'graphite', 'slate', 'tide', 'bronze', 'light', 'linen'];

  for (const theme of THEMES) {
    const read = (page: Page, apply: string) =>
      page.evaluate(([t, tokens, how]) => {
        const el = document.getElementById('ph')!;
        if (how === 'app') (window as any).__slippery.setTheme(t);
        else { el.dataset.t = t; document.body.dataset.t = t; }
        const cs = getComputedStyle(el);
        return Object.fromEntries((tokens as string[]).map((k) => [k, cs.getPropertyValue(k).trim()]));
      }, [theme, TOKENS, apply] as [string, string[], string]);

    const want = await read(spec, 'spec');
    const got = await read(app, 'app');
    for (const token of TOKENS) {
      if (want[token] !== got[token]) {
        note(`theme ${theme}`, `${token} is "${got[token]}", the prototype says "${want[token]}"`);
      }
    }
  }
  await spec.close();
  await app.close();
}

function sheetKeysFromSource(): string[] {
  const src = readFileSync('tests/fixtures/prototype.html', 'utf8');
  const start = src.indexOf('Object.assign(SH,{');
  const end = src.indexOf('\n});', start);
  const block = src.slice(start, end);
  const keys = new Set<string>();
  /* A sheet is a property at the top level of the Object.assign block, which
     is the only place in the file indented by exactly one space. */
  for (const m of block.matchAll(/^ ([a-zA-Z][a-zA-Z0-9_]*)\s*[:(]/gm)) keys.add(m[1]);
  return [...keys];
}

function firstDifference(want: string, got: string): string {
  let i = 0;
  while (i < want.length && i < got.length && want[i] === got[i]) i++;
  const at = Math.max(0, i - 40);
  return `at character ${i}\n      prototype: ...${want.slice(at, i + 60)}\n      app:       ...${got.slice(at, i + 60)}`;
}

main().catch((err) => { console.error(err); process.exit(1); });
