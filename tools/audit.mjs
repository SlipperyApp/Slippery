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
 *
 *  SIX MORE, and three new checks. The checks are module-overflows,
 *  text-clipped and text-collision; between them they found a module whose
 *  last line landed on top of its own footer, a figure that lost its last
 *  digit to overflow:hidden and therefore READ AS A DIFFERENT NUMBER, and a
 *  settings list on the live site rendering "AccountWho you are, how to reach
 *  you". None of the three is visible to axe, to the type checker, or to a
 *  build.
 *
 *   7. The tap floor is 24px on a mouse (WCAG 2.5.8) and 44px on a thumb
 *      (2.5.5, and the platform guidance). Skipping the check entirely on a
 *      fine pointer misses a 14px link in a list row, which is a real target
 *      and a real failure.
 *   8. An sr-only input is not the target: it is 1px by design and its LABEL
 *      is what you press, whether the label wraps it or points at it with a
 *      for attribute.
 *   9. A collision check that measures raw rectangles reports the fixed
 *      bottom bar as overlapping the page under it, on every route, at every
 *      width. Skip anything with a positioned ANCESTOR, not just a positioned
 *      self.
 *  10. Clip every rectangle to its scroll containers first. A row scrolled
 *      out of a module still has coordinates, and they sit on top of whatever
 *      the module is above.
 *  11. Only block level boxes can be compared. An inline element's rectangle
 *      is the union of its line boxes, so two spans two words apart on the
 *      same wrapped line overlap almost entirely and no glyph touches.
 *  12. A 503 no_store from an /api route is one fact about an environment
 *      with no DATABASE_URL. It gets one heading, like the 404s.
 *
 *  Rules nine through eleven cost 93 of the 95 collision findings on the
 *  first run. The two that survived were both real.
 */
import { chromium } from 'playwright-core';
import { readFileSync, mkdirSync, writeFileSync, readdirSync } from 'node:fs';
import { ALL } from './routes.mjs';

const BASE = (process.env.E2E_BASE || 'http://127.0.0.1:3100').replace(/\/$/, '');
const EXEC = process.env.CHROME_PATH || '/opt/pw-browsers/chromium';
const OUT = process.env.SHOT_DIR || 'test-results';
const ORIGIN = new URL(BASE).origin;
const THEMES = ['carbon', 'periwinkle', 'ink', 'graphite', 'slate', 'bronze', 'cinnabar', 'liquid'];
const AXE = readFileSync('node_modules/axe-core/axe.min.js', 'utf8');

/** Against a remote origin every page load is a network round trip, so the
 *  full sweep takes hours and stops being a gate anybody runs. LIVE mode
 *  checks that the deployed build really is the one that was audited: status,
 *  overflow, one h1, a real title, console errors and axe at two widths. The
 *  control sweep and the eight themes are not repeated, because they were
 *  measured locally against this exact commit. */
const LIVE = process.env.AUDIT_MODE === 'live';

const VIEWPORTS = LIVE
  ? [
    { w: 390, h: 844, mobile: true },
    { w: 1440, h: 900, mobile: false },
  ]
  : [
    { w: 320, h: 720, mobile: true },
    { w: 390, h: 844, mobile: true },
    { w: 430, h: 932, mobile: true },
    { w: 1024, h: 800, mobile: false },
    { w: 1440, h: 900, mobile: false },
  ];

mkdirSync(OUT, { recursive: true });

/*  THE STALE SERVER GUARD.
 *
 *  Replacing .next under a running `next start` serves a mixture of two
 *  builds: chunks 404, pages lose their stylesheet entirely, and every
 *  finding after that is a ghost. It has cost this project two full rounds of
 *  chasing fixes that were already applied, and while it is happening it
 *  looks exactly like a real regression.
 *
 *  So the CSS filename on disk is compared with the one the server links,
 *  before anything else runs. */
{
  let onDisk = [];
  try { onDisk = readdirSync('.next/static/css').filter((f) => f.endsWith('.css')); } catch { /* not built */ }
  const html = await fetch(BASE + '/').then((r) => r.text()).catch(() => '');
  const served = [...html.matchAll(/\/_next\/static\/css\/([^"']+\.css)/g)].map((m) => m[1]);
  const missing = served.filter((f) => onDisk.length && !onDisk.includes(f));
  if (missing.length) {
    console.error(`\nThe server is serving ${missing.join(', ')}, which is not in .next/static/css.`);
    console.error('That is a `next start` left running across a rebuild. Restart it: every finding');
    console.error('from a mixed build is a ghost.\n');
    process.exit(2);
  }
}

const problems = [];
const missingRoutes = new Map();   // rule six: reported once, under its own heading
/*  Rule twelve. Endpoints that answer 503 no_store because this run has no
 *  DATABASE_URL: not defects, and not forty console errors either. */
const noStore = new Map();
const note = (route, viewport, kind, detail) => {
  problems.push({ route, viewport, kind, detail });
  // Written as they are found. A dropped connection in a later phase used to
  // take the whole report with it.
  try { writeFileSync(`${OUT}/audit.json`, JSON.stringify({ problems, missingRoutes: [...missingRoutes] }, null, 2)); }
  catch { /* the report is a convenience, not the gate */ }
};

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

  /*  Rules seven and eight. 24 on a mouse, 44 on a thumb; and an sr-only
   *  input is not the target, whether its label wraps it or points at it. */
  const touch = window.matchMedia('(pointer: coarse)').matches || window.innerWidth < 700;
  const floor = touch ? 43.5 : 23.5;
  const small = controls.filter((el) => {
    if (inSentence(el)) return false;
    if (el.type === 'range' || el.type === 'checkbox') return false;
    if (el.classList.contains('sr-only')
      && (el.closest('label') || (el.id && document.querySelector(`label[for="${el.id}"]`)))) return false;
    return el.getBoundingClientRect().height < floor;
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

  /*  THREE FAULTS NOTHING ELSE HERE CATCHES. Every one of them renders,
      passes the type check, passes axe, and looks like a design choice in a
      screenshot until you read the words.

      spill    a module with a fixed height whose content is taller than it.
               The overflow is neither scrollable nor clipped, so the last
               line lands ON TOP of the footer of the card.
      clipped  a box that hides its overflow and holds more text than fits, so
               a figure silently loses its last digit and READS AS A DIFFERENT
               NUMBER. GBP 1,350 rendered as GBP 1,35 is a defect an eye
               scanning a dashboard will never catch.
      collide  two pieces of text drawn over each other. Neither is hidden, so
               both are in the accessibility tree and the screenshot is the
               only place the fault exists. This is the one that found
               "AccountWho you are, how to reach you" on the live settings
               page: .rowcard__t is a <p> in half the product and a <span> in
               the other half, and margin-top on an inline element does
               nothing. */
  const spill = [];
  for (const card of document.querySelectorAll('[class*="h-"]')) {
    if (!/(^|\s)h-(s|m|l|xl)(\s|$)/.test(card.className) || !visible(card)) continue;
    const over = card.scrollHeight - card.clientHeight;
    if (over > 2 && getComputedStyle(card).overflowY === 'visible') {
      spill.push(`${card.id || card.className.split(' ')[0]} +${over}px`);
    }
  }

  const clipped = [];
  for (const el of document.querySelectorAll('body *')) {
    if (!visible(el) || el.getAttribute('aria-hidden') === 'true') continue;
    const cs = getComputedStyle(el);
    if (cs.overflowX !== 'hidden' && cs.overflow !== 'hidden') continue;
    if (cs.textOverflow === 'ellipsis' || cs.whiteSpace === 'nowrap') continue;   // deliberate
    const txt = (el.textContent || '').trim();
    if (!txt || el.children.length > 2) continue;
    if (el.scrollWidth - el.clientWidth > 1) {
      clipped.push(`${el.tagName.toLowerCase()}.${String(el.className).split(' ')[0]} "${txt.slice(0, 24)}"`);
    }
    if (clipped.length > 4) break;
  }

  const collide = [];
  const leaves = [...document.querySelectorAll('p,h1,h2,h3,h4,span,li,td,th,dd,dt,a,button,label')]
    .filter((el) => {
      if (!visible(el) || el.getAttribute('aria-hidden') === 'true') return false;
      if (el.closest('.sr-only') || el.classList.contains('sr-only')) return false;
      // Rule eleven: an inline box's rectangle is the union of its line boxes.
      if (/^inline/.test(getComputedStyle(el).display)) return false;
      // Rule nine: a positioned ancestor, not just a positioned self.
      for (let p = el; p && p !== document.body; p = p.parentElement) {
        const pos = getComputedStyle(p).position;
        if (pos === 'fixed' || pos === 'sticky' || pos === 'absolute') return false;
      }
      return [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length > 1);
    })
    // Rule ten: clip to every scroll container on the way up.
    .map((el) => {
      let r = el.getBoundingClientRect();
      for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
        const cs = getComputedStyle(p);
        if (cs.overflow === 'visible' && cs.overflowX === 'visible' && cs.overflowY === 'visible') continue;
        const pr = p.getBoundingClientRect();
        const top = Math.max(r.top, pr.top);
        const left = Math.max(r.left, pr.left);
        const bottom = Math.min(r.bottom, pr.bottom);
        const right = Math.min(r.right, pr.right);
        r = { top, left, bottom, right, width: right - left, height: bottom - top };
      }
      return { el, r };
    })
    .filter((x) => x.r.width > 4 && x.r.height > 4);

  for (let i = 0; i < leaves.length && collide.length < 4; i++) {
    for (let j = i + 1; j < leaves.length && collide.length < 4; j++) {
      const a = leaves[i]; const b = leaves[j];
      if (a.el.contains(b.el) || b.el.contains(a.el)) continue;
      const ox = Math.min(a.r.right, b.r.right) - Math.max(a.r.left, b.r.left);
      const oy = Math.min(a.r.bottom, b.r.bottom) - Math.max(a.r.top, b.r.top);
      if (ox <= 1 || oy <= 1) continue;
      const smaller = Math.min(a.r.width * a.r.height, b.r.width * b.r.height);
      if ((ox * oy) / smaller > 0.3) {
        collide.push(`"${(a.el.textContent || '').trim().slice(0, 20)}" over "${(b.el.textContent || '').trim().slice(0, 20)}"`);
      }
    }
  }

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
    spill,
    clipped,
    collide,
  };
};

/** Rule six: a prefetch 404 for a route that does not exist is one finding,
 *  not one per page that links to it. */
function watch(page) {
  const errors = [];
  // "Failed to load resource" duplicates what the response listener already
  // sees, and an honest 503 from an API route with no database behind it is
  // the designed behaviour, not a page error.
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    if (/Failed to load resource/i.test(m.text())) return;
    errors.push(m.text().slice(0, 180));
  });
  page.on('pageerror', (e) => errors.push(`pageerror ${String(e).slice(0, 180)}`));
  page.on('response', (r) => {
    if (r.status() < 400) return;
    const url = new URL(r.url());
    if (url.origin !== ORIGIN) return;
    const path = url.pathname;
    if (r.status() === 503 && path.startsWith('/api/')) {
      noStore.set(path, (noStore.get(path) ?? 0) + 1);
      return;                               // degrading honestly is not a defect
    }
    if (path.startsWith('/api/')) return;
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
  if (m.spill.length) note(route, label, 'module-overflows', m.spill.join(', '));
  if (m.clipped.length) note(route, label, 'text-clipped', m.clipped.join(' | '));
  if (m.collide.length) note(route, label, 'text-collision', m.collide.join(' | '));

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
if (!LIVE) {
const THEME_ROUTES = ['/', '/app', '/app/ledger', '/app/social', '/pricing', '/app/settings', '/app/import/review'];
console.log('\nThemes');
for (const theme of THEMES) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  for (const route of THEME_ROUTES) await visit(ctx, route, { w: 1280, mobile: false }, { theme, runAxe: route === '/app' });
  await ctx.close();
  console.log(`  ${theme}`);
}

}

// ------------------------------------------- every button, clicked twice
if (!LIVE) {
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

      // Rule four's sibling: pressing the option that is already chosen in a
      // radio-like group is supposed to do nothing, and every segmented
      // control in the product has one.
      const alreadyChosen = await b.evaluate((el) => el.getAttribute('aria-pressed') === 'true'
        || el.getAttribute('aria-current') === 'page').catch(() => false);
      if (alreadyChosen) continue;

      const before = await page.evaluate(SIGNATURE).catch(() => null);
      if (!before) break;

      // Clicked TWICE, because a toggle that only works once is a defect too.
      // But a radio-like control clicked twice ENDS where it started, so the
      // comparison is against the state after the first click as well: it
      // passes if either click moved the page. Comparing only the second
      // reported every segmented control in the product as dead.
      let mid = null;
      try {
        await b.click({ timeout: 2500 });
        await page.waitForTimeout(200);
        mid = await page.evaluate(SIGNATURE).catch(() => null);
        if (mid && mid.url !== landed) { clicked += 1; break; }
        await b.click({ timeout: 2500 }).catch(() => {});
        await page.waitForTimeout(200);
      } catch { continue; }
      clicked += 1;

      const after = await page.evaluate(SIGNATURE).catch(() => null);
      if (!after) break;
      if (after.url !== landed) break;   // it navigated: the next page is not this test
      const moved = (x) => x && (x.text !== before.text || x.state !== before.state);
      if (!moved(mid) && !moved(after)) {
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

}

// ----------------------------------------------------------- keyboard
console.log('\nKeyboard');
try {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  for (const route of ['/app', '/', '/signup', '/app/ledger']) {
    const page = await ctx.newPage();
    try {
      await page.goto(BASE + route, { waitUntil: 'domcontentloaded', timeout: 45000 });
      await page.waitForTimeout(600);
    } catch {
      console.log(`  ${route}: could not be opened, skipped`);
      await page.close();
      continue;
    }
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
} catch (err) {
  console.log('  keyboard phase stopped early:', String(err).slice(0, 90));
}

// ---------------------------------------------------------- screenshots
console.log('\nScreenshots');
try {
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
} catch (err) {
  console.log('  screenshot phase stopped early:', String(err).slice(0, 90));
}

await browser.close().catch(() => {});

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

if (noStore.size) {
  console.log('\nEndpoints that need a database, and this run has none (503 no_store):');
  for (const [path, n] of [...noStore].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(n).padStart(4)}x  ${path}`);
  }
  console.log('  Not defects. Set DATABASE_URL to exercise them.');
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
