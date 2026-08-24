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

/* The eight the redesign ships, darkest to lightest. Tide, Light and Linen
   are gone; Carbon, Cinnabar and Liquid replace them, and Carbon is the
   default. */
const THEMES = ['carbon', 'periwinkle', 'ink', 'graphite', 'slate', 'bronze', 'cinnabar', 'liquid'];

type Failure = { where: string; what: string };
const failures: Failure[] = [];
const note = (where: string, what: string) => { failures.push({ where, what }); };

const axeSource = readFileSync('node_modules/axe-core/axe.min.js', 'utf8');

/* THE STALE-BUILD TRAP, NAMED.
 *
 * This audit takes about an hour. Running `next build` while it is in flight
 * rewrites the chunk hashes under the server it is driving, so every script
 * 404s, the render layer never mounts, and `window.__slippery` is undefined.
 * What you then see is "Cannot read properties of undefined (reading
 * 'setTheme')" three quarters of the way through a long run, which names the
 * property and not the cause, and looks like a product bug.
 *
 * Checked before each page's assertions so the run stops early and says what
 * actually happened. Do not rebuild while the audit is running. */
async function requireMounted(page: Page, where: string): Promise<boolean> {
  const ok = await page
    .waitForFunction(() => !!(window as any).__slippery, null, { timeout: 20000 })
    .then(() => true)
    .catch(() => false);
  if (!ok) {
    const failed = await page.evaluate(() =>
      performance.getEntriesByType('resource')
        .filter((r) => (r as PerformanceResourceTiming).responseStatus >= 400)
        .map((r) => r.name.split('/').pop())
        .slice(0, 3));
    note(where, 'the render layer never mounted'
      + (failed.length ? ` — these 404ed: ${failed.join(', ')}. `
        + 'That is the signature of a rebuild landing under a running server; '
        + 'restart it and do not build again until the audit finishes.'
        : ''));
  }
  return ok;
}

async function main() {
  mkdirSync(SHOTS, { recursive: true });
  const browser = await chromium.launch({ executablePath: CHROME });

  for (const vp of VIEWPORTS) {
    await sweepViewport(browser, vp);
  }

  await grepBundleForSecrets();

  await browser.close();

  reportAcceptedContrast();

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

  /* THE AUDIT RUNS WITHOUT A DATABASE, so every data route honestly answers
     503 and the console fills with failures that are the environment, not
     the interface. Stub them, so a real console error is visible again. The
     routes themselves are covered by the unit and integration suites; this
     gate is about what the page does. */
  await context.route('**/api/**', (route) => {
    const url = route.request().url();
    const body = /\/api\/(bets|groups|follows|slips|reference)/.test(url)
      ? '{"items":[],"bets":[],"groups":[],"people":[]}'
      : '{"ok":true}';
    return route.fulfill({ status: 200, contentType: 'application/json', body });
  });

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
  await assertTabularFigures(page, vp.name);
  await applyEveryTheme(page, vp.name, errors);

  await assertReducedMotionKeepsContent(page, vp.name);
  await assertOddsConvert(page, vp.name);
  await assertProfitDisplaySwitches(page, vp.name);
  await assertWeekStartReorders(page, vp.name);
  await assertCalendarIsHonest(page, vp.name);
  await assertEighthsSlider(page, vp.name);
  await assertOffscreenMotionStops(page, vp.name);
  await assertTabBarIsAnchored(page, vp.name);
  /* The spec names 390 and 1440 for the tutorial specifically. */
  if (vp.name === '390' || vp.name === '1440') await assertTutorialCompletes(page, vp.name);

  /* axe, on the screens that carry the most of the interface. */
  for (const path of ['/', '/app', '/app/ledger', '/app/settings', '/signup', '/app/social']) {
    await auditAccessibility(page, path, vp.name);
  }

  await page.goto(BASE + '/app', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(600);
  await page.screenshot({ path: join(SHOTS, `dashboard-${vp.name}.png`) });

  await context.close();
}

/* 10 · T1 · DOES THE UI FONT ACTUALLY SHIP TABULAR FIGURES?
 *
 * `font-variant-numeric: tabular-nums` fails silently. If the face has no
 * tnum feature the declaration does nothing, no warning is raised, and every
 * money column in the product is quietly ragged — which is exactly the defect
 * CLAUDE.md says tabular figures exist to prevent.
 *
 * Measured rather than assumed: render four strings of repeated digits and
 * compare their widths. Schibsted Grotesk's proportional "1" is 28.8px
 * against 52.9 for "0", and with tabular-nums all four land on 53.33 — so it
 * does ship them. Asserted here so a font swap cannot take the whole figure
 * system with it unnoticed.
 */
async function assertTabularFigures(page: Page, vpName: string) {
  await page.goto(BASE + '/app', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(600);
  const result = await page.evaluate(() => {
    const measure = (text: string, css: string) => {
      const s = document.createElement('span');
      s.style.cssText = 'position:absolute;visibility:hidden;white-space:pre;font-size:14px;' + css;
      s.textContent = text;
      document.body.appendChild(s);
      const w = s.getBoundingClientRect().width;
      s.remove();
      return w;
    };
    const out: Record<string, { equal: boolean; widths: number[] }> = {};
    for (const [name, family] of [['ui', 'var(--ui)'], ['mono', 'var(--mono)']]) {
      const widths = ['111111', '000000', '999999', '444444']
        .map((t) => measure(t, `font-family:${family};font-variant-numeric:tabular-nums;`));
      out[name] = { equal: Math.max(...widths) - Math.min(...widths) < 0.5, widths };
    }
    return out;
  });
  for (const [family, r] of Object.entries(result)) {
    if (!r.equal) {
      note(`${vpName} tabular figures`,
        `the ${family} face does not honour tabular-nums — digit widths ${r.widths.join(', ')}. `
        + 'Every money column in the product is ragged. Set font-feature-settings:"tnum" 1, and '
        + 'if that does not fix it the face has no tnum table and column figures must use the '
        + 'mono face instead.');
    }
  }
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
  await page.goto(BASE + '/app', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(500);

  if (!(await requireMounted(page, vpName + ' sheets'))) return;

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
  await page.goto(BASE + '/app', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(500);

  if (!(await requireMounted(page, vpName + ' themes'))) return;

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

  await page.evaluate(() => (window as any).__slippery.setTheme('carbon'));
}


/* WHERE THE PROTOTYPE'S OWN COLOURS DO NOT CLEAR THE CONTRAST BAR.
 *
 * The prototype is the visual specification and is to be reproduced exactly,
 * so these are not fixed here. They are also not hidden: each one is named
 * with the rule it breaks, the ratio it measures, and the one line that would
 * fix it, and every run prints them. Accessibility is not a gate in the spec,
 * so this is a decision for the owner rather than one to take quietly.
 *
 * All three are text at 10.5px and under, which is where a token that reads
 * comfortably at 14px stops clearing 4.5 to 1.
 */
const ACCEPTED_CONTRAST: { selector: RegExp; ratio: string; fix: string }[] = [
  {
    selector: /\.dn$/,
    ratio: '2.15 to 1 on a day with a figure, 1.62 to 1 on a future day',
    fix: 'app/proto.css: .cal .c .dn takes --t2 instead of --t4, and .cal .c.fut .dn takes --t3',
  },
  {
    selector: /\.tgtime$/,
    ratio: '2.96 to 1 against the accent bubble',
    fix: 'app/proto.css: .tgtime opacity .85 instead of .6',
  },
  {
    selector: /\.tgfoot$/,
    ratio: '2.99 to 1',
    fix: 'app/proto.css: .tgfoot takes --t2 instead of --t4',
  },
];

const acceptedSeen = new Set<string>();

/** True when every node of a violation is one the prototype puts there. */
function isAcceptedContrast(v: { id: string; nodes: { target: string[] }[] }): boolean {
  if (v.id !== 'color-contrast') return false;
  return v.nodes.every((n) => {
    const target = n.target.join(' ');
    const match = ACCEPTED_CONTRAST.find((a) => a.selector.test(target));
    if (!match) return false;
    acceptedSeen.add(`${match.selector.source}  ${match.ratio}\n      would be fixed by ${match.fix}`);
    return true;
  });
}


/* DECORATIVE MOTION MUST STOP WHEN IT IS OFF SCREEN.
 *
 * The landing page is 5862px tall and had thirty eight elements animating at
 * once, every one infinite, whether or not anybody could see them. A desktop
 * compositor absorbs that; a phone pays for it in frames and in battery, and
 * this is what "the landing page lags a little" was.
 *
 * The check is not "is it fast here", because here is not a phone. It is
 * "is anything still moving that nobody is looking at", which is the same
 * answer on every machine. */
async function assertOffscreenMotionStops(page: Page, vpName: string) {
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);

  /* THE RULE, WITH NO MAGIC NUMBER IN IT.
     Not "fewer than N animations", which is a different N on every viewport
     and tells you nothing when it changes. The property that matters is that
     nothing infinite is running for an element you cannot see, and that is
     the same sentence at 360 and at 1440. */
  const strays = () => page.evaluate(() => {
    const out: { name: string; cls: string; top: number }[] = [];
    for (const el of Array.from(document.querySelectorAll<HTMLElement>('.ph *'))) {
      const c = getComputedStyle(el);
      if (c.animationName === 'none') continue;
      if (c.animationPlayState !== 'running') continue;
      if (c.animationIterationCount !== 'infinite') continue;
      const r = el.getBoundingClientRect();
      const seen = r.bottom > 0 && r.top < window.innerHeight && r.width > 0 && r.height > 0;
      if (!seen) out.push({ name: c.animationName, cls: String(el.className).slice(0, 24), top: Math.round(r.top) });
    }
    return out;
  });

  const atTop = await strays();
  if (atTop.length) {
    note(vpName + ' motion',
      atTop.length + ' infinite animations run off screen at the top of the landing page: ' +
      [...new Set(atTop.map((a) => a.name))].join(', '));
  }

  /* `scroll-behavior:smooth` turns one assignment into an animation, so the
     measurement would race it. Jumped instantly instead, and both scrollers
     are moved because which one is live depends on the width. */
  await page.evaluate(() => {
    const body = document.querySelector('.body') as HTMLElement;
    body.style.scrollBehavior = 'auto';
    document.documentElement.style.scrollBehavior = 'auto';
    body.scrollTop = body.scrollHeight;
    window.scrollTo(0, document.documentElement.scrollHeight);
  });
  await page.waitForTimeout(1400);

  const atBottom = await strays();
  if (atBottom.length) {
    note(vpName + ' motion',
      atBottom.length + ' infinite animations still run off screen with the page scrolled to the bottom: ' +
      [...new Set(atBottom.map((a) => a.name))].join(', '));
  }

  const paused = await page.evaluate(() => document.querySelector('.lhero')?.classList.contains('offscreen'));
  if (!paused) note(vpName + ' motion', 'the hero is scrolled away and has not been marked off screen');
}

/* THE BOTTOM TAB BAR IS ANCHORED TO THE VIEWPORT.
 *
 * It was absolutely positioned inside a 100svh box, which looks identical to
 * fixed on a desktop and puts the bar behind Safari's bottom address bar on
 * an iPhone. Position is checkable; the address bar is not, so this checks
 * the property that caused it. */
async function assertTabBarIsAnchored(page: Page, vpName: string) {
  if (Number(vpName) >= 1000) return;   // it is a sidebar at that width

  await page.goto(BASE + '/app', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(600);

  const bar = await page.evaluate(() => {
    const el = document.querySelector('.navbar') as HTMLElement | null;
    if (!el) return null;
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    return {
      position: cs.position,
      bottom: Math.round(window.innerHeight - r.bottom),
      paddingBottom: cs.paddingBottom,
      height: Math.round(r.height),
    };
  });
  if (!bar) { note(vpName + ' tab bar', 'there is no tab bar'); return; }
  if (bar.position !== 'fixed') {
    note(vpName + ' tab bar', `is ${bar.position}, not fixed, so it scrolls with the page and lands behind the browser chrome on iOS`);
  }
  if (bar.bottom !== 0) note(vpName + ' tab bar', `sits ${bar.bottom}px above the bottom of the viewport`);

  /* The last card has to be reachable rather than tucked under the bar. */
  /* Which element scrolls depends on the width: below 1000px `.body` is the
     scroll container, at and above it `.body` is `overflow:visible` and the
     document scrolls. Scrolling the wrong one moves nothing and the check
     passes for the wrong reason. */
  const reachable = await page.evaluate(() => {
    const body = document.querySelector('.body') as HTMLElement;
    body.style.scrollBehavior = 'auto';
    const scroller = body.scrollHeight > body.clientHeight + 1
      ? body
      : document.scrollingElement as HTMLElement;
    scroller.scrollTop = scroller.scrollHeight;
    return new Promise<boolean>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => {
      const bar = (document.querySelector('.navbar') as HTMLElement).getBoundingClientRect();
      const last = body.lastElementChild?.lastElementChild as HTMLElement | undefined;
      if (!last) return resolve(true);
      const r = last.getBoundingClientRect();
      /* A sidebar beside the content cannot cover anything. */
      const covers = bar.left < r.right && bar.right > r.left;
      resolve(!covers || r.bottom <= bar.top + 1);
    })));
  });
  if (!reachable) note(vpName + ' tab bar', 'the last card is still underneath the bar at full scroll');
}

/* Audited on a page that has finished arriving.
 *
 * The landing page reveals its sections on scroll, so a contrast check run
 * against the page as it loads measures text at six percent opacity and
 * reports thirty one failures that are the animation, not the design. Under
 * reduced motion every section is present and still, which is both the
 * settled state and a state a real person can be in. */

/* ---------------- the behaviours the spec names by name ----------------
 *
 * Each of these is a sentence in the definition of done. They are checked in
 * the running product rather than in a unit test, because every one of them
 * is a setting whose whole job is to change what is on screen, and a unit
 * test of the conversion function proves nothing about whether the screen
 * uses it.
 */

async function assertOddsConvert(page: Page, vpName: string) {
  await page.goto(BASE + '/app/ledger', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(500);

  const read = () => page.evaluate(() =>
    (document.querySelector('.ph .body') as HTMLElement)?.innerText ?? '');

  const set = async (format: string) => {
    await page.evaluate((f) => {
      const api = (window as any).__slippery;
      api.cur.oddsFmt = f;
      api.repaint();
    }, format);
    await page.waitForTimeout(250);
    return read();
  };

  /* 1.90 is on the first row of the ledger in every state of the product. */
  const decimal = await set('Decimal');
  if (!decimal.includes('1.90')) note(vpName + ' odds', 'decimal does not show 1.90');

  const fractional = await set('Fractional');
  if (!fractional.includes('9/10')) {
    note(vpName + ' odds', '1.90 did not convert to 9/10 in fractional');
  }

  const american = await set('American');
  if (!american.includes('-111')) {
    note(vpName + ' odds', '1.90 did not convert to -111 in American');
  }

  await set('Decimal');
}

async function assertProfitDisplaySwitches(page: Page, vpName: string) {
  await page.goto(BASE + '/app/ledger', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(500);

  const set = async (mode: string) => {
    await page.evaluate((m) => {
      const api = (window as any).__slippery;
      api.cur.showIn = m;
      api.repaint();
    }, mode);
    await page.waitForTimeout(250);
    return page.evaluate(() => (document.querySelector('.ph .body') as HTMLElement)?.innerText ?? '');
  };

  const currency = await set('Currency');
  if (!currency.includes('+£9.00')) note(vpName + ' profit display', 'currency does not show +£9.00');

  const units = await set('Units');
  if (!units.includes('+0.36u')) note(vpName + ' profit display', 'units does not show +0.36u');
  if (units.includes('+£9.00')) note(vpName + ' profit display', 'units still shows the money figure');

  await set('Currency');
}

async function assertWeekStartReorders(page: Page, vpName: string) {
  await page.goto(BASE + '/app', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(600);

  const letters = async (start: number) => {
    await page.evaluate((w) => {
      const api = (window as any).__slippery;
      api.cur.weekStart = w;
      document.querySelectorAll('[data-cal]').forEach((c) => c.removeAttribute('data-d'));
      api.repaint();
    }, start);
    await page.waitForTimeout(350);
    return page.evaluate(() =>
      Array.from(document.querySelectorAll('.cal .dow')).slice(0, 7).map((d) => d.textContent).join(''));
  };

  const monday = await letters(1);
  const sunday = await letters(0);
  if (monday !== 'MTWTFSS') note(vpName + ' week start', 'Monday start reads "' + monday + '"');
  if (sunday !== 'SMTWTFS') note(vpName + ' week start', 'Sunday start reads "' + sunday + '"');
  await letters(1);
}

/* NO FUTURE DAY CARRIES A VALUE.
   A calendar square showing a profit for a day that has not happened is the
   single most damaging thing this product could draw. */
async function assertCalendarIsHonest(page: Page, vpName: string) {
  await page.goto(BASE + '/app', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(600);

  await page.evaluate(() => {
    const card = document.querySelector('[data-cardid=cal]');
    const toggle = card?.querySelector('[data-calexpand]') as HTMLElement | null;
    /* The control toggles, so clicking blind would collapse a month that is
       already open at desktop widths. Click only when it offers to expand. */
    if (toggle && /expand/i.test(toggle.textContent ?? '')) toggle.click();
  });
  await page.waitForTimeout(700);

  const bad = await page.evaluate(() =>
    Array.from(document.querySelectorAll('.cal .c.fut'))
      .filter((c) => /[+−-]?\d/.test((c.querySelector('span:not(.dn)')?.textContent ?? '')))
      .map((c) => c.textContent?.trim() ?? ''));
  if (bad.length) note(vpName + ' calendar', 'future days carry a figure: ' + bad.join(', '));

  /* August 2026 has 31 days, and the grid must show all of them. */
  const days = await page.evaluate(() =>
    document.querySelectorAll('.cal .c:not(.pad)').length);
  if (days !== 31) note(vpName + ' calendar', 'the expanded month draws ' + days + ' days, not 31');
}

/* THE EIGHTHS SLIDER IS OF REMAINING STAKE, NOT OF THE ORIGINAL.
   Two consecutive half cash outs leave a quarter running. This is the rule
   the old data model could not represent at all. */
async function assertEighthsSlider(page: Page, vpName: string) {
  await page.goto(BASE + '/app', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(500);

  const pull = async (eighths: number) => {
    await page.evaluate(() => (window as any).__slippery.sheet('cashout'));
    await page.waitForTimeout(300);
    const moved = await page.evaluate((e) => {
      const slider = document.querySelector('[data-cashslider]') as HTMLInputElement | null;
      if (!slider) return false;
      slider.value = String(e);
      slider.dispatchEvent(new Event('input', { bubbles: true }));
      return true;
    }, eighths);
    if (!moved) { note(vpName + ' cash out', 'the eighths slider is not in the sheet'); return null; }
    await page.waitForTimeout(250);
    const before = await page.evaluate(() => (window as any).__slippery.cur.cashRem);
    await page.evaluate(() => (document.querySelector('[data-cashdo]') as HTMLElement)?.click());
    await page.waitForTimeout(300);
    const after = await page.evaluate(() => (window as any).__slippery.cur.cashRem);
    return { before, after };
  };

  await page.evaluate(() => { (window as any).__slippery.cur.cashRem = 100; });

  const first = await pull(4);
  if (!first) return;
  if (Math.abs(Number(first.after) - 50) > 0.01) {
    note(vpName + ' cash out', 'four eighths of £100 left £' + first.after + ', not £50');
  }

  const second = await pull(4);
  if (!second) return;
  if (Math.abs(Number(second.after) - 25) > 0.01) {
    note(vpName + ' cash out',
      'a second four eighths left £' + second.after + ', not £25: the slider is reading the ' +
      'original stake rather than what is still running');
  }
}

/* THE TUTORIAL WALKS EVERY STEP IT DECLARES, WITH SOMETHING TO POINT AT.
   A step whose spotlight has no size is a step pointing at nothing, which is
   how a tour quietly becomes a stack of modals over a dimmed screen. The
   count is read from the tour rather than written here, so shortening the
   tour is a product decision and not a test failure. */
async function assertTutorialCompletes(page: Page, vpName: string) {
  await page.goto(BASE + '/app', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(500);

  const started = await page.evaluate(() => {
    const fn = (window as any).__slippery?.startTutorial;
    if (typeof fn !== 'function') return false;
    fn();
    return true;
  });
  if (!started) { note(vpName + ' tutorial', 'there is no way to start it'); return; }

  const declared = await page.evaluate(() => (window as any).__slippery.tutorialSteps ?? 0);
  if (declared < 3) {
    note(vpName + ' tutorial', 'declares ' + declared + ' steps, which is not a tour');
    return;
  }

  for (let step = 1; step <= declared; step++) {
    await page.waitForTimeout(650);
    const spot = await page.evaluate(() => {
      const el = document.querySelector('.tut .spot') as HTMLElement | null;
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { w: Math.round(r.width), h: Math.round(r.height), opacity: Number(getComputedStyle(el).opacity) };
    });
    if (!spot) { note(vpName + ' tutorial', 'step ' + step + ' has no spotlight element'); return; }
    if (!spot.w || !spot.h || !spot.opacity) {
      note(vpName + ' tutorial', 'step ' + step + ' points at nothing: ' + spot.w + 'x' + spot.h + ' at opacity ' + spot.opacity);
    }
    const advanced = await page.evaluate(() => {
      const next = document.querySelector('[data-tutnext]') as HTMLElement | null;
      if (!next) return false;
      next.click();
      return true;
    });
    if (!advanced) { note(vpName + ' tutorial', 'step ' + step + ' has no way forward'); return; }
  }

  await page.waitForTimeout(600);
  const stillOpen = await page.evaluate(() => Boolean(document.querySelector('.tut.on')));
  if (stillOpen) note(vpName + ' tutorial', 'it did not finish after its ' + declared + ' steps');
}

async function auditAccessibility(page: Page, path: string, vpName: string) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(BASE + path, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(600);
  await page.addScriptTag({ content: axeSource });
  const result = await page.evaluate(async () => {
    // @ts-expect-error injected
    return await window.axe.run(document, { resultTypes: ['violations'] });
  });
  const violations = (result as { violations: { id: string; impact: string; nodes: { html: string; target: string[] }[] }[] }).violations
    .filter((v) => !isAcceptedContrast(v));
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

  /* Reduced motion means no MOVEMENT and nothing that never stops. A short
     opacity fade is not movement, and removing it leaves content appearing
     from nothing, which is worse. So the test names what is actually
     forbidden: a keyframe that touches transform, or an animation that
     repeats forever. */
  const moving = await page.evaluate(() =>
    document.getAnimations()
      .filter((a) => {
        const eff = a.effect as KeyframeEffect | null;
        if (!eff || !(eff.target instanceof Element)) return false;
        if (!eff.target.closest('.ph')) return false;
        if ((eff.getTiming().iterations ?? 1) === Infinity) return true;
        return eff.getKeyframes().some((k) =>
          Object.keys(k).some((prop) => /^(transform|translate|scale|rotate)$/.test(prop)));
      })
      .map((a) => (a as any).animationName ?? 'animation'));
  if (moving.length) {
    note(vpName + ' reduced motion',
      moving.length + ' animations still move or repeat forever: ' + [...new Set(moving)].join(', '));
  }
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

/* Printed whether the run passes or fails, so an accepted finding cannot
   quietly become an invisible one. */
function reportAcceptedContrast() {
  if (!acceptedSeen.size) return;
  console.log('\nACCEPTED, because the prototype draws them this way and the spec asks for it exactly:');
  for (const line of acceptedSeen) console.log('  ' + line);
  console.log('  Each is one line to change if the owner wants it changed.');
}

main().catch((err) => { console.error(err); process.exit(1); });
