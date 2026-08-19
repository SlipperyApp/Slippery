/* THE DEFINITION OF DONE, ACTUALLY RUN.
 *
 * jsdom has no layout engine: offsetWidth is zero and CSS never applies. A
 * previous build of this product passed every jsdom test while scrolling
 * sideways on a phone with seventy nine backdrop-filter elements stuttering
 * the scroll. So this drives a real browser, at real widths, and looks.
 *
 * Six viewports, every route, every button clicked twice, every sheet opened
 * and closed, all eight themes applied in sequence on every viewport.
 */
import { chromium, type Browser, type Page } from 'playwright-core';
import { mkdirSync, writeFileSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { ALL_PATHS, ROUTES } from '../../lib/proto/routes.ts';

const BASE = process.env.E2E_BASE || 'http://localhost:3100';
const CHROME = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const SHOTS = 'test-results';

const VIEWPORTS = [
  { name: '360', width: 360, height: 780, touch: true },
  { name: '390', width: 390, height: 844, touch: true },
  { name: '430', width: 430, height: 932, touch: true },
  { name: '1024', width: 1024, height: 768, touch: false },
  { name: '1280', width: 1280, height: 900, touch: false },
  { name: '1440', width: 1440, height: 900, touch: false },
];

const THEMES = ['periwinkle', 'ink', 'graphite', 'slate', 'tide', 'bronze', 'light', 'linen'];

type Failure = { where: string; what: string };
const failures: Failure[] = [];
const note = (where: string, what: string) => { failures.push({ where, what }); };

const axeSource = readFileSync('node_modules/axe-core/axe.min.js', 'utf8');

async function main() {
  mkdirSync(SHOTS, { recursive: true });
  const browser = await chromium.launch({ executablePath: CHROME });

  for (const vp of VIEWPORTS) {
    await sweepViewport(browser, vp);
  }

  await grepBundleForSecrets();

  await browser.close();

  if (failures.length) {
    console.error('\nFAILED, ' + failures.length + ' problems:\n');
    for (const f of failures) console.error('  ' + f.where + '\n    ' + f.what);
    process.exit(1);
  }
  console.log('\nAll gates passed.');
}

async function sweepViewport(browser: Browser, vp: (typeof VIEWPORTS)[number]) {
  const context = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    hasTouch: vp.touch,
    isMobile: vp.touch,
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();

  const errors: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push('uncaught: ' + e.message));

  for (const path of ALL_PATHS) {
    const where = `${vp.name} ${path}`;
    errors.length = 0;

    await page.goto(BASE + path, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(700);

    /* Every view renders more than forty characters. A blank screen that
       throws no error is the failure mode a smoke test misses. */
    const text = await page.evaluate(() => (document.querySelector('.ph') as HTMLElement)?.innerText?.trim() ?? '');
    if (text.length <= 40) note(where, `rendered only ${text.length} characters`);

    await assertNoOverflow(page, where);
    await assertNoDuplicateIds(page, where);
    await assertAppBarIntact(page, where);

    if (errors.length) note(where, 'console errors: ' + [...new Set(errors)].join(' | '));
  }

  /* Every button, twice. Once catches a handler that throws; twice catches
     one that only works the first time, which is the whole class of bug that
     a toggle rendered from a template string produces. */
  await clickEverything(page, vp.name, errors);

  /* Every sheet, opened and closed. */
  await openEverySheet(page, vp.name, errors);

  /* All eight themes, in sequence, on this viewport. */
  await applyEveryTheme(page, vp.name, errors);

  await assertReducedMotionKeepsContent(page, vp.name);

  /* axe, on the screens that carry the most of the interface. */
  for (const path of ['/', '/dashboard', '/ledger', '/settings', '/signup', '/social']) {
    await auditAccessibility(page, path, vp.name);
  }

  await page.goto(BASE + '/dashboard', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(600);
  await page.screenshot({ path: join(SHOTS, `dashboard-${vp.name}.png`) });

  await context.close();
}

async function assertNoOverflow(page: Page, where: string) {
  const over = await page.evaluate(() => {
    const b = document.body;
    const d = document.documentElement;
    const widest = Math.max(b.scrollWidth, d.scrollWidth);
    if (widest <= d.clientWidth) return null;
    /* Name the element, or the failure is a number nobody can act on. */
    let worst = '';
    let worstRight = d.clientWidth;
    for (const el of Array.from(document.querySelectorAll<HTMLElement>('.ph *'))) {
      const r = el.getBoundingClientRect();
      if (r.right > worstRight + 0.5) { worstRight = r.right; worst = el.className || el.tagName; }
    }
    return { by: widest - d.clientWidth, worst, worstRight };
  });
  if (over) note(where, `${over.by}px of horizontal scroll, widest element "${over.worst}" reaching ${Math.round(over.worstRight)}px`);
}

async function assertNoDuplicateIds(page: Page, where: string) {
  const dupes = await page.evaluate(() => {
    const seen = new Set<string>();
    const bad = new Set<string>();
    for (const el of Array.from(document.querySelectorAll('[id]'))) {
      const id = el.id;
      if (seen.has(id)) bad.add(id);
      seen.add(id);
    }
    return [...bad];
  });
  if (dupes.length) note(where, 'duplicate ids: ' + dupes.join(', '));
}

/* The app bar is a three column grid and its middle column holds a handle
   that can be long. If the columns collide the handle sits under the running
   pill and neither is readable. */
async function assertAppBarIntact(page: Page, where: string) {
  const collision = await page.evaluate(() => {
    const bar = document.querySelector('.appbar');
    if (!bar) return null;
    const kids = Array.from(bar.children) as HTMLElement[];
    const boxes = kids.map((k) => k.getBoundingClientRect()).filter((r) => r.width > 0);
    for (let i = 1; i < boxes.length; i++) {
      if (boxes[i].left < boxes[i - 1].right - 1) {
        return { a: kids[i - 1].className, b: kids[i].className };
      }
    }
    return null;
  });
  if (collision) note(where, `app bar columns collide: "${collision.a}" overlaps "${collision.b}"`);
}

async function clickEverything(page: Page, vpName: string, errors: string[]) {
  for (const path of ALL_PATHS) {
    await page.goto(BASE + path, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(400);

    const count = await page.locator('.ph button').count();

    for (let i = 0; i < Math.min(count, 80); i++) {
      for (const pass of [1, 2]) {
        errors.length = 0;
        try {
          const button = page.locator('.ph button').nth(i);
          if (!(await button.isVisible({ timeout: 300 }).catch(() => false))) break;
          await button.click({ timeout: 900, force: true, noWaitAfter: true });
          await page.waitForTimeout(70);
        } catch {
          /* A button that scrolled away or was replaced by its own handler is
             not a failure. A handler that throws is, and that arrives below. */
        }
        if (errors.length) {
          note(vpName + ' ' + path + ' button ' + i + ' pass ' + pass, [...new Set(errors)].join(' | '));
        }
      }

      /* Only reset when the click actually left the route or opened a sheet.
         Reloading after every button turns a two minute sweep into an hour. */
      const moved = await page.evaluate((want) => ({
        away: window.location.pathname !== want,
        sheet: Boolean(document.querySelector('.sheet')),
      }), path);
      if (moved.away) {
        await page.goto(BASE + path, { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(250);
      } else if (moved.sheet) {
        await page.evaluate(() => (window as any).__slippery?.closeSheet());
        await page.waitForTimeout(150);
      }
    }
  }
}

async function openEverySheet(page: Page, vpName: string, errors: string[]) {
  await page.goto(BASE + '/dashboard', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(500);

  const keys: string[] = await page.evaluate(() => (window as any).__slippery?.sheetKeys ?? []);
  if (!keys.length) { note(vpName + ' sheets', 'no sheet registry exposed to the test'); return; }

  for (const key of keys) {
    errors.length = 0;
    const rendered = await page.evaluate((k) => {
      const api = (window as any).__slippery;
      try { api.sheet(k); } catch (e) { return 'threw: ' + (e as Error).message; }
      return null;
    }, key);
    if (rendered) { note(`${vpName} sheet ${key}`, rendered); continue; }

    await page.waitForTimeout(220);
    const text = await page.evaluate(() => (document.querySelector('.sheet') as HTMLElement)?.innerText?.trim() ?? '');
    if (text.length < 10) note(`${vpName} sheet ${key}`, `opened with only ${text.length} characters`);

    await assertNoOverflow(page, `${vpName} sheet ${key}`);

    await page.evaluate(() => (window as any).__slippery.closeSheet());
    await page.waitForTimeout(220);

    if (errors.length) note(`${vpName} sheet ${key}`, [...new Set(errors)].join(' | '));
  }
}

async function applyEveryTheme(page: Page, vpName: string, errors: string[]) {
  await page.goto(BASE + '/dashboard', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(500);

  for (const theme of THEMES) {
    errors.length = 0;
    await page.evaluate((t) => (window as any).__slippery.setTheme(t), theme);
    await page.waitForTimeout(200);

    const applied = await page.evaluate(() => document.body.dataset.t);
    if (applied !== theme) note(`${vpName} theme ${theme}`, `body says "${applied}"`);

    /* THE TWO SEMANTIC COLOURS MUST READ IN EVERY THEME. The two light
       themes need a darker green and a darker red, which is exactly why
       there is no single global profit green. */
    const contrast = await page.evaluate(() => {
      const cs = getComputedStyle(document.documentElement);
      const read = (v: string) => cs.getPropertyValue(v).trim();
      const parse = (c: string) => {
        const m = c.match(/^#?([0-9a-f]{6})$/i);
        if (!m) return null;
        const n = parseInt(m[1], 16);
        return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
      };
      const lum = (rgb: number[]) => {
        const [r, g, b] = rgb.map((v) => {
          const s = v / 255;
          return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
        });
        return 0.2126 * r + 0.7152 * g + 0.0722 * b;
      };
      const ratio = (a: number[], b: number[]) => {
        const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
        return (hi + 0.05) / (lo + 0.05);
      };
      const bg = parse(read('--bg'));
      const out: Record<string, number> = {};
      for (const token of ['--pos', '--neg', '--t1', '--t2']) {
        const fg = parse(read(token));
        if (fg && bg) out[token] = Math.round(ratio(fg, bg) * 100) / 100;
      }
      return out;
    });

    for (const [token, ratio] of Object.entries(contrast)) {
      /* 3:1 for the large semantic figures, which is what the headline and
         the calendar cells are; 4.5:1 for body text. */
      const floor = token === '--t2' ? 4.5 : 3;
      if (ratio < floor) note(`${vpName} theme ${theme}`, `${token} is ${ratio}:1 against the background, needs ${floor}:1`);
    }

    if (errors.length) note(`${vpName} theme ${theme}`, [...new Set(errors)].join(' | '));
  }

  await page.evaluate(() => (window as any).__slippery.setTheme('periwinkle'));
}

/* Audited on a page that has finished arriving.
 *
 * The landing page reveals its sections on scroll, so a contrast check run
 * against the page as it loads measures text at six percent opacity and
 * reports thirty one failures that are the animation, not the design. Under
 * reduced motion every section is present and still, which is both the
 * settled state and a state a real person can be in. */
async function auditAccessibility(page: Page, path: string, vpName: string) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(BASE + path, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(600);
  await page.addScriptTag({ content: axeSource });
  const result = await page.evaluate(async () => {
    // @ts-expect-error injected
    return await window.axe.run(document, { resultTypes: ['violations'] });
  });
  const violations = (result as { violations: { id: string; impact: string; nodes: { html: string }[] }[] }).violations;
  if (violations.length) {
    note(`${vpName} axe ${path}`, violations
      .map((v) => `${v.id} (${v.impact}, ${v.nodes.length}) first: ${v.nodes[0]?.html.slice(0, 70)}`)
      .join(' | '));
  }
  await page.emulateMedia({ reducedMotion: 'no-preference' });
}

/* REDUCED MOTION MEANS PRESENT BUT STILL, NEVER ABSENT.
 *
 * `.reveal` hides a section with a plain opacity of zero and brings it back
 * with a class from an IntersectionObserver. Switching the transition off
 * does not put the content back, so the kill switch alone left somebody who
 * asked for less motion with a landing page missing most of its content. */
async function assertReducedMotionKeepsContent(page: Page, vpName: string) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(500);
  const hidden = await page.evaluate(() =>
    Array.from(document.querySelectorAll('.reveal'))
      .filter((el) => Number(getComputedStyle(el).opacity) < 0.99).length);
  if (hidden) note(vpName + ' reduced motion', hidden + ' sections stay invisible with motion turned off');

  const moving = await page.evaluate(() =>
    Array.from(document.querySelectorAll('.ph *'))
      .filter((el) => {
        const cs = getComputedStyle(el);
        return cs.animationName !== 'none' && cs.animationDuration !== '0s';
      }).length);
  if (moving) note(vpName + ' reduced motion', moving + ' elements still animate');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
}

/* NONE OF THE SECRETS MAY REACH THE BUNDLE. Names and values both: a name in
   client code means somebody wired process.env into a component, and a value
   means it is already public. */
async function grepBundleForSecrets() {
  const NAMES = [
    'DATABASE_URL', 'AUTH_SECRET', 'GOOGLE_CLIENT_SECRET', 'STRIPE_SECRET_KEY',
    'STRIPE_WEBHOOK_SECRET', 'TELEGRAM_BOT_TOKEN', 'TELEGRAM_WEBHOOK_SECRET',
    'VISION_API_KEY', 'ANTHROPIC_API_KEY', 'EMAIL_API_KEY', 'ADMIN_SECRET',
  ];
  const values = NAMES.map((n) => process.env[n]).filter((v): v is string => Boolean(v) && v.length > 8);

  const dir = '.next/static';
  const files: string[] = [];
  const walk = (d: string) => {
    for (const entry of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, entry.name);
      if (entry.isDirectory()) walk(p);
      else if (/\.(js|css|map)$/.test(entry.name)) files.push(p);
    }
  };
  try { walk(dir); } catch { note('bundle grep', 'no .next/static to grep, run a build first'); return; }

  for (const file of files) {
    const source = readFileSync(file, 'utf8');
    for (const name of NAMES) {
      if (source.includes(name)) note('bundle grep', `${name} appears in ${file}`);
    }
    for (const value of values) {
      if (source.includes(value)) note('bundle grep', `a secret VALUE appears in ${file}`);
    }
  }
  console.log(`bundle grep: ${files.length} files, ${NAMES.length} names, ${values.length} values`);
}

main().catch((err) => { console.error(err); process.exit(1); });
