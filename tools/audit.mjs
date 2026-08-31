/** The real browser sweep.
 *
 *  jsdom has no layout engine: offsetWidth is 0 and CSS is never applied. A
 *  previous build passed every jsdom test while scrolling sideways on a phone
 *  with 79 backdrop-filter elements causing scroll stutter. This drives real
 *  Chromium.
 *
 *  FIVE RULES THIS HARNESS GOT WRONG FIRST, each of which produced a page of
 *  findings that were not real:
 *
 *  1. A dead control is NOT "no element with aria-pressed changed". That
 *     cannot tell "£5 selected" from "£25 selected", because one goes false as
 *     another goes true, and it reported 44 working controls as dead. The
 *     signature is body text length + location + the ORDERED list of
 *     aria-pressed, aria-expanded, aria-current, hidden, value and checked.
 *  2. Reading `display` on the element measures every link in a sidebar that
 *     is display:none at that width. Use checkVisibility, which walks
 *     ancestors, and skip anything parked off screen.
 *  3. A link inside a sentence is exempt from the tap floor, and a standalone
 *     text link is measured on HEIGHT only. Padding a four letter link out to
 *     44px wide makes the layout worse without making the target easier to hit.
 *  4. A submit button on a form with an empty required field is SUPPOSED to do
 *     nothing. Check form.checkValidity() first, or the harness punishes a
 *     form for validating.
 *  5. A route that redirects lands somewhere else, so compare against the
 *     LANDED url. Returning to the requested address after each click undoes
 *     what the click did.
 *
 *  And two more: a prefetch 404 for an unbuilt route is reported once under
 *  its own heading rather than as a console error on forty other pages, and
 *  the server is restarted before any of this is believed, because replacing
 *  .next under a running `next start` serves a mixture of both builds.
 */
import { chromium } from 'playwright-core';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { ALL } from './routes.mjs';

const BASE = (process.env.E2E_BASE || 'http://127.0.0.1:3100').replace(/\/$/, '');
const EXEC = process.env.CHROME_PATH || '/opt/pw-browsers/chromium';
const OUT = process.env.SHOT_DIR || 'test-results';
const ORIGIN = new URL(BASE).origin;
const THEMES = ['carbon', 'periwinkle', 'ink', 'graphite', 'slate', 'bronze', 'cinnabar', 'liquid'];
const AXE = readFileSync('node_modules/axe-core/axe.min.js', 'utf8');

const VIEWPORTS = [
  { w: 320, h: 720, mobile: true },
  { w: 390, h: 844, mobile: true },
  { w: 430, h: 932, mobile: true },
  { w: 1024, h: 800, mobile: false },
  { w: 1440, h: 900, mobile: false },
];

mkdirSync(OUT, { recursive: true });

const problems = [];
const missingRoutes = new Map();   // rule six: reported once, under its own heading
const note = (route, viewport, kind, detail) => problems.push({ route, viewport, kind, detail });

const browser = await chromium.launch({
  executablePath: EXEC,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--font-render-hinting=none'],
});

/** Everything that needs a real layout engine, measured in one pass. */
const MEASURE = () => {
  const visible = (el) => {
    if (typeof el.checkVisibility === 'function' && !el.checkVisibility({ checkOpacity: false, checkVisibilityCSS: true })) return false;
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) return false;
    // Parked off screen: a skip link, an sr-only label.
    if (r.bottom < -200 || r.right < -200) return false;
    return true;
  };

  const ids = [...document.querySelectorAll('[id]')].map((e) => e.id);
  const dupes = [...new Set(ids.filter((id, i) => ids.indexOf(id) !== i))];

  const probe = document.createElement('span');
  probe.style.cssText = 'position:absolute;left:-9999px;font-size:14px;white-space:pre';
  probe.className = 'tnum';
  document.body.appendChild(probe);
  probe.textContent = '111111'; const w1 = probe.getBoundingClientRect().width;
  probe.textContent = '000000'; const w0 = probe.getBoundingClientRect().width;
  probe.className = 'mono tnum';
  probe.textContent = '111111'; const m1 = probe.getBoundingClientRect().width;
  probe.textContent = '000000'; const m0 = probe.getBoundingClientRect().width;
  probe.remove();

  const backdrop = [...document.querySelectorAll('*')].filter((el) => {
    const s = getComputedStyle(el);
    return (s.backdropFilter && s.backdropFilter !== 'none')
      || (s.webkitBackdropFilter && s.webkitBackdropFilter !== 'none');
  }).length;

  const bg = document.querySelector('.bgfield');
  const liveBlur = bg
    ? [bg, ...bg.querySelectorAll('*')].filter((el) => (getComputedStyle(el).filter || '').includes('blur')).length
    : 0;

  // Rule two: only what is actually visible at this width.
  const CONTROLS = 'button, a[href], input, select, textarea, [role="button"], [tabindex]:not([tabindex="-1"])';
  const controls = [...document.querySelectorAll(CONTROLS)].filter(visible);

  const named = (el) => {
    const label = el.getAttribute('aria-label')
      || (el.getAttribute('aria-labelledby') ? document.getElementById(el.getAttribute('aria-labelledby'))?.textContent : '')
      || (el.id ? document.querySelector(`label[for="${CSS.escape(el.id)}"]`)?.textContent : '')
      || el.closest('label')?.textContent
      || el.getAttribute('title')
      || el.textContent
      || el.getAttribute('placeholder')
      || el.getAttribute('value')
      || '';
    return String(label).trim();
  };

  const unnamed = controls.filter((el) => named(el).length === 0)
    .map((el) => `${el.tagName}.${el.className}`.slice(0, 60));

  // Rule three: a link inside a sentence is exempt, and a standalone text
  // link is measured on height only.
  const inSentence = (el) => {
    if (el.tagName !== 'A') return false;
    const p = el.parentElement;
    if (!p) return false;
    if (/^(P|SPAN|LI|TD|LABEL|LEGEND|SMALL|STRONG|EM)$/.test(p.tagName)) {
      const own = (el.textContent || '').trim().length;
      const all = (p.textContent || '').trim().length;
      return all > own + 8;
    }
    return false;
  };

  const small = controls.filter((el) => {
    if (inSentence(el)) return false;
    if (el.type === 'range' || el.type === 'checkbox') return false;
    const r = el.getBoundingClientRect();
    const textLink = el.tagName === 'A' && !el.className.includes('btn') && !el.className.includes('tab');
    if (textLink) return r.height < 43.5;
    return r.height < 43.5;
  }).map((el) => `${el.tagName}.${String(el.className).slice(0, 34)} ${Math.round(el.getBoundingClientRect().height)}px`);

  // Anything with cursor:pointer must be a button or an anchor with an href.
  // A descendant of one inherits the cursor and is not itself a control, so
  // only the outermost pointer element counts.
  const clickable = [...document.querySelectorAll('div,span,li,p')].filter((el) => {
    if (getComputedStyle(el).cursor !== 'pointer') return false;
    if (el.closest('button, a[href], label, [role="button"]')) return false;
    return visible(el);
  }).map((el) => `${el.tagName}.${String(el.className).slice(0, 40)}`);

  const smallInputs = [...document.querySelectorAll('input,select,textarea')]
    .filter((el) => visible(el) && parseFloat(getComputedStyle(el).fontSize) < 16).length;

  return {
    scrollWidth: document.body.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
    h1: document.querySelectorAll('h1').length,
    title: document.title,
    chars: (document.body.innerText || '').trim().length,
    dupes,
    tnumEqual: Math.abs(w1 - w0) < 0.5,
    monoEqual: Math.abs(m1 - m0) < 0.5,
    backdrop,
    liveBlur,
    clickable,
    unnamed,
    small,
    smallInputs,
    hasMain: Boolean(document.querySelector('main#main')),
    hasSkip: Boolean(document.querySelector('a.skip')),
  };
};

/** Rule six: a prefetch 404 for a route that does not exist is one finding,
 *  not one per page that links to it. */
function watch(page) {
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error' && !/status of 4\d\d/.test(m.text())) errors.push(m.text().slice(0, 180)); });
  page.on('pageerror', (e) => errors.push(`pageerror ${String(e).slice(0, 180)}`));
  page.on('response', (r) => {
    if (r.status() < 400) return;
    const url = new URL(r.url());
    if (url.origin !== ORIGIN) return;
    const path = url.pathname;
    if (r.request().resourceType() === 'fetch' || url.searchParams.has('_rsc')) {
      missingRoutes.set(path, (missingRoutes.get(path) ?? 0) + 1);
      return;
    }
    errors.push(`${r.status()} ${path}`);
  });
  return errors;
}

async function visit(ctx, route, vp, { runAxe = false, theme = null } = {}) {
  const page = await ctx.newPage();
  const errors = watch(page);
  if (theme) await ctx.addCookies([{ name: 'slip_theme', value: theme, url: BASE }]);

  let status = 0;
  try {
    const res = await page.goto(BASE + route, { waitUntil: 'domcontentloaded', timeout: 45000 });
    status = res ? res.status() : 0;
    await page.waitForLoadState('load').catch(() => {});
    await page.waitForTimeout(600);
  } catch (err) {
    note(route, `${vp.w}`, 'navigation', String(err).slice(0, 140));
    await page.close();
    return;
  }

  const m = await page.evaluate(MEASURE);
  const label = `${vp.w}${theme ? ` ${theme}` : ''}`;

  if (status !== 200) note(route, label, 'status', String(status));
  if (errors.length) note(route, label, 'console', errors.slice(0, 2).join(' | '));
  if (vp.mobile && m.scrollWidth > m.clientWidth) note(route, label, 'overflow', `${m.scrollWidth - m.clientWidth}px`);
  if (m.h1 !== 1) note(route, label, 'h1', `${m.h1} h1 elements`);
  if (!m.title || m.title.length < 10) note(route, label, 'title', `"${m.title}"`);
  if (m.chars <= 40) note(route, label, 'thin', `${m.chars} characters`);
  if (m.dupes.length) note(route, label, 'duplicate-id', m.dupes.join(', '));
  if (!m.tnumEqual && !m.monoEqual) note(route, label, 'tabular-figures', 'digits are not the same width');
  if (m.backdrop > 3) note(route, label, 'backdrop-filter', `${m.backdrop} elements`);
  if (m.liveBlur > 0) note(route, label, 'live-blur', `${m.liveBlur} in the background layer`);
  if (m.clickable.length) note(route, label, 'clickable-div', `${m.clickable.length}: ${m.clickable[0]}`);
  if (m.unnamed.length) note(route, label, 'unnamed-control', `${m.unnamed.length}: ${m.unnamed[0]}`);
  if (m.small.length) note(route, label, 'tap-target', `${m.small.length}: ${m.small[0]}`);
  if (m.smallInputs > 0) note(route, label, 'input-size', `${m.smallInputs} under 16px`);
  if (!m.hasMain) note(route, label, 'landmark', 'no main#main');
  if (!m.hasSkip) note(route, label, 'skip-link', 'no skip link');

  if (runAxe) {
    try {
      await page.addScriptTag({ content: AXE });
      const results = await page.evaluate(async () => window.axe.run(document, { resultTypes: ['violations'] }));
      for (const v of results.violations) {
        if (v.impact === 'minor') continue;
        note(route, label, `axe:${v.id}`, `${v.impact} on ${v.nodes.length}: ${v.nodes[0]?.target?.join(' ') ?? ''}`);
      }
    } catch (err) {
      note(route, label, 'axe-failed', String(err).slice(0, 120));
    }
  }

  await page.close();
}

// ------------------------------------------------------------- the sweep
console.log(`Auditing ${ALL.length} routes at ${VIEWPORTS.length} widths against ${BASE}\n`);

for (const vp of VIEWPORTS) {
  const ctx = await browser.newContext({
    viewport: { width: vp.w, height: vp.h },
    isMobile: vp.mobile, hasTouch: vp.mobile, deviceScaleFactor: 1,
  });
  for (const route of ALL) {
    const runAxe = vp.w === 390 || (vp.w === 1440 && !route.startsWith('/app'));
    await visit(ctx, route, vp, { runAxe });
  }
  console.log(`  ${vp.w}px  ${ALL.length} routes`);
  await ctx.close();
}

// ------------------------------------------------------------ the themes
const THEME_ROUTES = ['/', '/app', '/app/ledger', '/app/social', '/pricing', '/app/settings', '/app/import/review'];
console.log('\nThemes');
for (const theme of THEMES) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  for (const route of THEME_ROUTES) await visit(ctx, route, { w: 1280, mobile: false }, { theme, runAxe: route === '/app' });
  await ctx.close();
  console.log(`  ${theme}`);
}

// ------------------------------------------- every button, clicked twice
console.log('\nControls');
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  let clicked = 0;
  let dead = 0;

  /** Rule one: the whole observable state of the page, ordered. */
  const SIGNATURE = () => ({
    text: document.body.innerText.length,
    url: location.href,
    state: [...document.querySelectorAll('[aria-pressed],[aria-expanded],[aria-current],[hidden],input,select,textarea')]
      .map((e) => [
        e.getAttribute('aria-pressed'), e.getAttribute('aria-expanded'),
        e.getAttribute('aria-current'), e.hasAttribute('hidden') ? 'h' : '',
        'value' in e ? String(e.value) : '', 'checked' in e ? String(e.checked) : '',
      ].join('')).join('|'),
  });

  for (const route of ALL) {
    const page = await ctx.newPage();
    const errors = watch(page);
    try {
      await page.goto(BASE + route, { waitUntil: 'domcontentloaded', timeout: 45000 });
      await page.waitForLoadState('load').catch(() => {});
      await page.waitForTimeout(400);
    } catch { await page.close(); continue; }

    // Rule five: compare against the LANDED url, not the requested one.
    const landed = page.url();
    const buttons = await page.$$('button:not([disabled])');

    for (const b of buttons.slice(0, 26)) {
      // Rule four: a submit on a form with an empty required field is
      // supposed to do nothing.
      const isBlockedSubmit = await b.evaluate((el) => {
        const form = el.closest('form');
        if (!form) return false;
        const type = el.getAttribute('type');
        if (type && type !== 'submit') return false;
        return !form.checkValidity();
      }).catch(() => false);
      if (isBlockedSubmit) continue;

      const before = await page.evaluate(SIGNATURE).catch(() => null);
      if (!before) break;
      try {
        await b.click({ timeout: 2500 });
        await page.waitForTimeout(200);
        await b.click({ timeout: 2500 }).catch(() => {});
        await page.waitForTimeout(200);
      } catch { continue; }
      clicked += 1;

      const after = await page.evaluate(SIGNATURE).catch(() => null);
      if (!after) break;
      if (after.url !== landed) break;   // it navigated: the next page is not this test
      if (after.text === before.text && after.state === before.state) {
        dead += 1;
        const name = await b.evaluate((el) => (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 40)).catch(() => '?');
        note(route, 'controls', 'no-observable-change', name || '(unnamed)');
      }
    }
    if (errors.length) note(route, 'controls', 'pageerror', errors[0]);
    await page.close();
  }
  console.log(`  clicked ${clicked} buttons twice, ${dead} with nothing observable`);
  await ctx.close();
}

// ----------------------------------------------------------- keyboard
console.log('\nKeyboard');
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  for (const route of ['/app', '/', '/signup', '/app/ledger']) {
    const page = await ctx.newPage();
    await page.goto(BASE + route, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(600);
    const reached = new Set();
    let ringless = 0;
    for (let i = 0; i < 40; i++) {
      await page.keyboard.press('Tab');
      const who = await page.evaluate(() => {
        const el = document.activeElement;
        if (!el || el === document.body) return null;
        const s = getComputedStyle(el);
        return {
          key: `${el.tagName}:${(el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 24)}`,
          ring: s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0,
        };
      });
      if (!who) continue;
      reached.add(who.key);
      if (!who.ring) ringless += 1;
    }
    if (reached.size < 6) note(route, 'keyboard', 'tab-order', `only ${reached.size} focusable`);
    if (ringless > 2) note(route, 'keyboard', 'focus-ring', `${ringless} focused with no visible ring`);
    console.log(`  ${route}: ${reached.size} controls, ${ringless} without a ring`);
    await page.close();
  }
  await ctx.close();
}

// ---------------------------------------------------------- screenshots
console.log('\nScreenshots');
{
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
  });
  for (const route of ['/', '/app', '/app/ledger', '/app/import/review', '/app/billing/declined', '/app/social']) {
    const page = await ctx.newPage();
    await page.goto(BASE + route, { waitUntil: 'domcontentloaded' }).catch(() => {});
    await page.waitForTimeout(900);
    const name = route === '/' ? 'home' : route.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '');
    await page.screenshot({ path: `${OUT}/${name}-390.png` }).catch(() => {});
    await page.close();
  }
  console.log(`  written to ${OUT}/`);
  await ctx.close();
}

await browser.close();

// -------------------------------------------------------------- report
const byKind = new Map();
for (const p of problems) byKind.set(p.kind, (byKind.get(p.kind) ?? 0) + 1);

console.log('\n' + '='.repeat(64));
if (missingRoutes.size) {
  console.log('\nPrefetches for routes that do not exist (reported once each):');
  for (const [path, n] of [...missingRoutes].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(n).padStart(4)}x  ${path}`);
  }
}

if (!problems.length) {
  console.log('\nClean. Every route, every viewport, every theme.');
} else {
  console.log(`\n${problems.length} findings across ${byKind.size} classes\n`);
  for (const [kind, n] of [...byKind].sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(4)}  ${kind}`);
  console.log('\nFirst of each class:');
  const seen = new Set();
  for (const p of problems) {
    if (seen.has(p.kind)) continue;
    seen.add(p.kind);
    console.log(`  ${p.kind}\n    ${p.route} @ ${p.viewport}\n    ${p.detail}`);
  }
}
writeFileSync(`${OUT}/audit.json`, JSON.stringify({ problems, missingRoutes: [...missingRoutes] }, null, 2));
console.log(`\nFull findings in ${OUT}/audit.json`);
process.exit(problems.length ? 1 : 0);
