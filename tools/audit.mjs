/* Real-browser audit.
 *
 * jsdom has no layout engine: offsetWidth is 0 and CSS never applies. A
 * previous build passed every jsdom test while scrolling sideways on
 * mobile. Everything here runs in Chromium against the built page, and it
 * writes screenshots for a human to LOOK at.
 *
 *   node tools/audit.mjs            all checks
 *   node tools/audit.mjs --shots    screenshots only
 */
import { chromium } from 'playwright-core';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createServer } from 'node:http';
import { installStub } from './apistub.mjs';

const root = path.dirname(path.dirname(new URL(import.meta.url).pathname));
const CHROME = process.env.CHROME_BIN || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const WIDTHS = [320, 390, 430];
const SHOT_DIR = path.join(root, 'tools', 'screens');

const VIEWS = ['landing', 'setup', 'howto', 'demo', 'pricing', 'dash', 'imp', 'settings', 'help', 'terms', 'privacy'];
/* Graphite first, matching data.js: it is the default. */
const THEMES = ['graphite', 'periwinkle', 'ink', 'tide', 'chalk'];

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.woff2': 'font/woff2', '.png': 'image/png', '.svg': 'image/svg+xml',
  '.webmanifest': 'application/manifest+json' };

function serve(dir) {
  return new Promise(resolve => {
    const server = createServer(async (req, res) => {
      let p = decodeURIComponent(req.url.split('?')[0]);
      if (p === '/') p = '/index.html';
      try {
        const buf = await readFile(path.join(dir, p));
        res.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' });
        res.end(buf);
      } catch {
        res.writeHead(404, { 'content-type': 'text/plain' });
        res.end('not found');
      }
    });
    server.listen(0, () => resolve({ server, port: server.address().port }));
  });
}

const problems = [];
const fail = (area, msg) => problems.push({ area, msg });

async function main() {
  const shotsOnly = process.argv.includes('--shots');
  await mkdir(SHOT_DIR, { recursive: true });
  const { server, port } = await serve(path.join(root, 'public'));
  const base = 'http://127.0.0.1:' + port;
  const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
  const axe = await readFile(path.join(root, 'node_modules', 'axe-core', 'axe.min.js'), 'utf8');

  /* ── console errors, across every view ───────────────────────── */
  {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const errors = [];
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', e => errors.push('pageerror: ' + e.message));
    await installStub(page);
    await page.goto(base, { waitUntil: 'networkidle' });
    await page.waitForTimeout(500);            // let the session and ledger land
    for (const v of VIEWS) {
      await page.evaluate(id => {
        const b = document.querySelector('[data-nav="' + id + '"]');
        if (b) b.click();
        else document.querySelectorAll('.view').forEach(x => x.classList.toggle('on', x.id === id));
      }, v);
      await page.waitForTimeout(120);
    }
    /* exercise the interactive paths that broke before */
    /* Which controls exist now depends on what the ledger holds, so every
       click is guarded. A missing control is reported rather than throwing
       mid-sweep and skipping the rest of the checks. */
    await page.evaluate(() => {
      const hit = sel => { const e = document.querySelector(sel); if (e) e.click(); return !!e; };
      hit('[data-nav="dash"]');
      hit('#runToggle');
      hit('#checkResults');
    });
    await page.waitForTimeout(1400);
    await page.evaluate(() => {
      const hit = sel => { const e = document.querySelector(sel); if (e) e.click(); };
      hit('#moreToggle');
      hit('#viewAllBets');
      hit('.cell[data-day]');
    });
    await page.waitForTimeout(400);
    await page.evaluate(() => { const e = document.querySelector('#dayClose'); if (e) e.click(); });
    await page.waitForTimeout(200);
    /* every period, both calendar modes, both other panes */
    for (const p of ['a', 'm', 'w', 'd', 'm']) {
      await page.evaluate(x => {
        const b = document.querySelector('#periodSeg [data-period="' + x + '"]');
        if (b && !b.disabled) b.click();
      }, p);
      await page.waitForTimeout(120);
    }
    await page.evaluate(() => {
      const hit = sel => { const e = document.querySelector(sel); if (e) e.click(); };
      hit('#calMode [data-cal="y"]');
      hit('[data-pane="ledger"]');
      hit('#ledgerSeg [data-ledger="ledgerAnalysis"]');
      hit('[data-pane="social"]');
      hit('[data-profile]');
    });
    await page.waitForTimeout(300);
    for (const t of THEMES) {
      await page.evaluate(x => {
        const b = document.querySelector('#swatchesSettings [data-theme="' + x + '"]');
        if (b) b.click();
      }, t);
      await page.waitForTimeout(80);
    }
    if (errors.length) errors.forEach(e => fail('console', e));
    await page.close();
  }

  /* ── duplicate ids ───────────────────────────────────────────── */
  {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await installStub(page);
    await page.goto(base, { waitUntil: 'networkidle' });
    /* render everything that builds DOM lazily first */
    await page.evaluate(() => {
      document.querySelectorAll('.view').forEach(v => v.classList.add('on'));
      const b = document.querySelector('#runToggle'); if (b) b.click();
    });
    await page.waitForTimeout(300);
    const dupes = await page.evaluate(() => {
      const seen = new Map();
      document.querySelectorAll('[id]').forEach(el => {
        seen.set(el.id, (seen.get(el.id) || 0) + 1);
      });
      return [...seen.entries()].filter(([, n]) => n > 1).map(([id, n]) => id + ' x' + n);
    });
    dupes.forEach(d => fail('duplicate-id', d));

    /* ── no em dashes in anything anyone reads ──────────────────
       The owner asked for them gone sitewide. Copy gets edited, so a
       one-off find and replace does not hold; this reads the rendered
       text of every view, with every list built, and names the offender.
       Only rendered text: settlement.js and csv.js still MATCH an em dash
       on the way in, because other people's slips and spreadsheets are
       full of them. */
    const emdash = await page.evaluate(() => {
      const found = [];
      const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      for (let n = walk.nextNode(); n; n = walk.nextNode()) {
        /* Script and style are not read by anyone. The bundle legitimately
           contains an em dash: settlement.js normalises one out of a
           selection string, and csv.js treats a lone one as an empty cell. */
        const tag = n.parentElement && n.parentElement.tagName;
        if (tag === 'SCRIPT' || tag === 'STYLE') continue;
        if (n.nodeValue.includes('\u2014')) found.push(n.nodeValue.trim().slice(0, 70));
      }
      document.querySelectorAll('[placeholder],[aria-label],[title]').forEach(el => {
        for (const a of ['placeholder', 'aria-label', 'title']) {
          const v = el.getAttribute(a);
          if (v && v.includes('\u2014')) found.push(a + '="' + v.slice(0, 60) + '"');
        }
      });
      return found;
    });
    emdash.slice(0, 12).forEach(t => fail('em-dash', t));
    await page.close();
  }

  /* ── horizontal overflow at every width, on every view ───────── */
  for (const width of WIDTHS) {
    const page = await browser.newPage({ viewport: { width, height: 844 }, deviceScaleFactor: 2 });
    await installStub(page);
    await page.goto(base, { waitUntil: 'networkidle' });
    for (const v of VIEWS) {
      await page.evaluate(id => {
        const b = document.querySelector('[data-nav="' + id + '"]');
        if (b) b.click();
        else document.querySelectorAll('.view').forEach(x => x.classList.toggle('on', x.id === id));
        window.scrollTo(0, 0);
      }, v);
      await page.waitForTimeout(160);
      const res = await page.evaluate(() => {
        const doc = document.documentElement;
        const over = doc.scrollWidth - doc.clientWidth;
        if (over <= 0) return { over: 0, culprits: [] };
        const culprits = [];
        document.querySelectorAll('body *').forEach(el => {
          const r = el.getBoundingClientRect();
          if (r.width === 0 && r.height === 0) return;
          if (r.right > doc.clientWidth + 1 || r.left < -1) {
            culprits.push(
              (el.tagName.toLowerCase()) +
              (el.id ? '#' + el.id : '') +
              (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).join('.') : '') +
              ' [' + Math.round(r.left) + '..' + Math.round(r.right) + ']'
            );
          }
        });
        return { over, culprits: culprits.slice(0, 6) };
      });
      if (res.over > 0) {
        fail('h-overflow', width + 'px / ' + v + ': ' + res.over + 'px, ' + (res.culprits.join(' | ') || 'no element found'));
      }
    }
    await page.close();
  }

  /* ── axe-core, per view ──────────────────────────────────────── */
  {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await installStub(page);
    await page.goto(base, { waitUntil: 'networkidle' });
    await page.addScriptTag({ content: axe });
    for (const v of VIEWS) {
      await page.evaluate(id => {
        const b = document.querySelector('[data-nav="' + id + '"]');
        if (b) b.click();
        else document.querySelectorAll('.view').forEach(x => x.classList.toggle('on', x.id === id));
      }, v);
      /* longer than the 420ms view fade and the 360ms scene fade: sampling
         mid-transition reads blended colours and reports false contrast
         failures for states no user ever settles on */
      await page.waitForTimeout(650);
      const results = await page.evaluate(async () => {
        const r = await window.axe.run(document, {
          runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'] },
          resultTypes: ['violations']
        });
        return r.violations.map(v => ({
          id: v.id, impact: v.impact, help: v.help,
          nodes: v.nodes.slice(0, 3).map(n => n.target.join(' ') + (n.failureSummary ? ' :: ' + n.failureSummary.replace(/\n/g, ' ') : ''))
        }));
      });
      results.forEach(r => fail('axe/' + v, r.id + ' (' + r.impact + ') ' + r.help + ' → ' + r.nodes.join(' ; ')));
    }
    await page.close();
  }

  /* ── contrast in every theme, over the real background ───────── */
  {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await installStub(page);
    await page.goto(base, { waitUntil: 'networkidle' });
    await page.addScriptTag({ content: axe });
    for (const theme of THEMES) {
      await page.evaluate(t => {
        document.documentElement.setAttribute('data-theme', t);
        document.querySelector('[data-nav="dash"]').click();
      }, theme);
      await page.waitForTimeout(650);
      const v = await page.evaluate(async () => {
        const r = await window.axe.run(document, { runOnly: ['color-contrast'], resultTypes: ['violations'] });
        return r.violations.flatMap(x => x.nodes.slice(0, 4).map(n =>
          n.target.join(' ') + ' :: ' + (n.any[0] && n.any[0].message || '')));
      });
      v.forEach(x => fail('contrast/' + theme, x));
    }
    await page.close();
  }

  /* ── keyboard reachability ───────────────────────────────────── */
  {
    /* Signed out: a session lands on the dashboard, and the landing page is
       what a first-time visitor actually gets. */
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await installStub(page, { signedIn: false });
    await page.goto(base, { waitUntil: 'networkidle' });
    await page.waitForTimeout(400);
    const reach = await page.evaluate(() => {
      const focusable = [...document.querySelectorAll(
        '#landing button, #landing a[href], #landing input, #landing select')]
        .filter(el => el.offsetParent !== null && !el.disabled);
      let noFocus = 0;
      for (const el of focusable) {
        el.focus();
        if (document.activeElement !== el) noFocus++;
      }
      return { total: focusable.length, noFocus };
    });
    if (reach.noFocus > 0) fail('keyboard', reach.noFocus + ' of ' + reach.total + ' landing controls could not take focus');
    if (reach.total < 5) fail('keyboard', 'only ' + reach.total + ' focusable controls found on the landing page');

    /* The skip link must be the first thing a keyboard reaches, and it must
       become visible when focused, an invisible skip link is no skip link.
       Driven through the DOM rather than a synthetic Tab, because a headless
       page may not hold window focus and the press then goes nowhere. */
    const skip = await page.evaluate(() => {
      const all = [...document.querySelectorAll(
        'a[href],button,input,select,textarea,[tabindex]:not([tabindex="-1"])')]
        .filter(el => !el.disabled && el.getAttribute('aria-hidden') !== 'true');
      const first = all[0];
      if (!first) return { ok: false, why: 'no focusable elements at all' };
      if (!first.classList.contains('skip')) {
        return { ok: false, why: 'first focusable is ' + first.tagName + '.' + first.className };
      }
      const before = first.getBoundingClientRect().left;
      first.focus();
      const focused = document.activeElement === first;
      const after = first.getBoundingClientRect().left;
      return {
        ok: focused && after > before && after >= 0,
        why: !focused ? 'skip link cannot take focus'
          : after <= before ? 'skip link stays offscreen when focused (left ' + after + ')' : ''
      };
    });
    if (!skip.ok) fail('keyboard', skip.why);
    await page.close();
  }

  /* ── touch target sizes ──────────────────────────────────────── */
  {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await installStub(page);
    await page.goto(base, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.querySelector('[data-nav="dash"]').click());
    await page.waitForTimeout(300);
    const small = await page.evaluate(() => {
      const out = [];
      document.querySelectorAll('button, [role=button], a[href], input, select').forEach(el => {
        if (el.offsetParent === null) return;
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) return;
        if (r.height < 24 || r.width < 24) {
          out.push((el.id ? '#' + el.id : el.tagName.toLowerCase() + '.' +
            String(el.className).trim().split(/\s+/)[0]) +
            ' ' + Math.round(r.width) + 'x' + Math.round(r.height));
        }
      });
      return [...new Set(out)].slice(0, 10);
    });
    small.forEach(s => fail('touch-target', s + ' is under 24x24'));
    await page.close();
  }

  /* ── backdrop-filter budget ──────────────────────────────────── */
  {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await installStub(page);
    await page.goto(base, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.querySelector('[data-nav="dash"]').click());
    await page.waitForTimeout(250);
    const count = await page.evaluate(() => {
      let n = 0;
      const seen = [];
      document.querySelectorAll('*').forEach(el => {
        if (el.offsetParent === null && getComputedStyle(el).position !== 'fixed') return;
        const s = getComputedStyle(el);
        const bf = s.backdropFilter || s.webkitBackdropFilter;
        if (bf && bf !== 'none') { n++; seen.push(el.id || el.className); }
      });
      return { n, seen };
    });
    if (count.n > 3) fail('backdrop-filter', count.n + ' elements have one (budget is 3): ' + count.seen.join(', '));
    await page.close();
  }

  /* ── scroll smoothness with the background running ───────────── */
  {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await installStub(page);
    await page.goto(base, { waitUntil: 'networkidle' });
    const client = await page.context().newCDPSession(page);
    await client.send('Overlay.setShowFPSCounter', { show: false }).catch(() => {});
    const frames = await page.evaluate(async () => {
      const times = [];
      let last = performance.now();
      let stop = false;
      function tick(now) { times.push(now - last); last = now; if (!stop) requestAnimationFrame(tick); }
      requestAnimationFrame(tick);
      for (let i = 0; i < 40; i++) {
        window.scrollBy(0, 40);
        await new Promise(r => setTimeout(r, 16));
      }
      stop = true;
      await new Promise(r => setTimeout(r, 60));
      return times;
    });
    const sorted = frames.slice(2).sort((a, b) => a - b);
    const p95 = sorted[Math.floor(sorted.length * 0.95)] || 0;
    const long = frames.filter(f => f > 50).length;
    console.log('  scroll  p95 frame ' + p95.toFixed(1) + 'ms, ' + long + ' frames over 50ms');
    if (p95 > 34) fail('scroll', 'p95 frame time ' + p95.toFixed(1) + 'ms while scrolling with motion running');
    await page.close();
  }

  /* ── reduced motion actually stops the motion ────────────────── */
  {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
    await installStub(page, { signedIn: false });
    await page.goto(base, { waitUntil: 'networkidle' });
    const running = await page.evaluate(() => {
      return document.getAnimations().filter(a => a.playState === 'running').length;
    });
    if (running > 0) fail('reduced-motion', running + ' animations still running under prefers-reduced-motion');

    /* The pinned sequence must not merely animate less, it must stop
       pinning. Someone who asked the OS for less motion should not be
       made to scroll three viewport heights through a stuck stage. */
    const jack = await page.evaluate(() => {
      const track = document.querySelector('.jack-track');
      const stage = document.querySelector('.jack-stage');
      if (!track || !stage) return null;
      return {
        track: getComputedStyle(track).display,
        stage: getComputedStyle(stage).position,
        scenes: [...document.querySelectorAll('.jk-scene')]
          .map(s => Math.round(parseFloat(getComputedStyle(s).opacity) * 100)),
        summary: getComputedStyle(document.querySelector('.jack-sum')).display
      };
    });
    if (jack) {
      if (jack.track !== 'none') fail('reduced-motion', 'the scroll-jack track still occupies ' + jack.track);
      if (jack.stage !== 'static') fail('reduced-motion', 'the scroll-jack stage is still ' + jack.stage);
      if (jack.scenes.some(o => o !== 100))
        fail('reduced-motion', 'scenes are still progress-driven: opacities ' + jack.scenes.join(', '));
      if (jack.summary !== 'block') fail('reduced-motion', 'no static summary replaces the sequence copy');
    }
    await page.screenshot({ path: path.join(SHOT_DIR, 'jack-reduced.png'), fullPage: false });
    await page.close();
  }

  /* ── delegated selectors cannot match <html> or <body> ────────
     One bare attribute selector in the click handler, [data-theme],
     matched every click in the document, because the theme lives on
     <html data-theme>. closest() walked up to it, the branch returned, and
     every branch declared after it became dead code: the signup wizard's
     Continue button, the unit row, the import tabs, both dropzones and
     Confirm on an imported slip. It is a silent failure, nothing throws,
     the click just quietly does the wrong thing.

     This reads the source rather than the page, because that is where the
     mistake is: a selector loose enough to reach the root element. */
  {
    const main = await readFile(path.join(root, 'src', 'js', 'main.js'), 'utf8');
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await installStub(page);
    await page.goto(base, { waitUntil: 'networkidle' });

    const selectors = [...main.matchAll(/\bc\('([^']+)'\)/g)].map(m => m[1]);
    const reachesRoot = await page.evaluate(list => {
      const bad = [];
      for (const sel of list) {
        try {
          if (document.documentElement.matches(sel)) bad.push(sel + ' matches <html>');
          else if (document.body.matches(sel)) bad.push(sel + ' matches <body>');
        } catch { bad.push(sel + ' is not a valid selector'); }
      }
      return bad;
    }, selectors);
    for (const b of reachesRoot) {
      fail('delegation', b + ', closest() will match it for every click, ' +
        'and this branch returns, so every branch after it is dead');
    }
    await page.close();
  }

  /* ── the app survives an opaque origin ────────────────────────
     WebKit throws SecurityError from pushState whenever the page has an
     opaque origin, a file:// URL, a sandboxed iframe, and the capacitor://
     scheme an App Store wrapper would use. Chromium tolerates it, which is
     exactly why this shipped: the routing threw inside go(), after the view
     classes were toggled but before reveal(), so the page half-rendered into
     a mostly blank screen with every .reveal still at opacity 0, and init
     aborted. It looked like "the app is broken" and logged nothing a normal
     audit would catch.

     Reproduced by making pushState throw the way WebKit does, since a real
     opaque origin cannot be simulated any other way here. */
  {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await installStub(page);
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.addInitScript(() => {
      const boom = () => { throw new DOMException('The operation is insecure.', 'SecurityError'); };
      history.pushState = boom;
      history.replaceState = boom;
    });
    await page.goto(base, { waitUntil: 'networkidle' });
    await page.waitForTimeout(700);

    const state = await page.evaluate(() => {
      const on = document.querySelector('.view.on');
      const reveals = [...document.querySelectorAll('.view.on .reveal')];
      return {
        view: on ? on.id : null,
        rows: document.querySelectorAll('#recentBets .betrow').length,
        hidden: reveals.filter(e => getComputedStyle(e).opacity === '0').length,
        reveals: reveals.length
      };
    });
    if (errors.length) fail('opaque-origin', 'threw where the URL cannot be changed: ' + errors[0]);
    if (state.view !== 'dash') fail('opaque-origin', 'did not reach the dashboard, stopped on ' + state.view);
    if (!state.rows) fail('opaque-origin', 'the ledger rendered no rows, init aborted');

    /* And navigation still works without the URL following it. */
    await page.evaluate(() => { const b = document.querySelector('[data-nav="imp"]'); if (b) b.click(); });
    await page.waitForTimeout(250);
    const moved = await page.evaluate(() => (document.querySelector('.view.on') || {}).id);
    if (moved !== 'imp') fail('opaque-origin', 'navigation stopped working, stuck on ' + moved);
    await page.close();
  }

  /* ── views are addressable and back works ─────────────────────
     Nothing wrote to history, so the back button did nothing: on an
     installed PWA that means Android's hardware back exits the app from the
     middle of signup, and no screen could be linked to. */
  {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await installStub(page);
    await page.goto(base, { waitUntil: 'networkidle' });
    await page.waitForTimeout(500);
    const view = () => page.evaluate(() => {
      const on = document.querySelector('.view.on');
      return { id: on ? on.id : null, hash: location.hash };
    });

    await page.evaluate(() => document.querySelector('[data-nav="imp"]').click());
    await page.waitForTimeout(200);
    let v = await view();
    if (v.id !== 'imp') fail('routing', 'navigating to import landed on ' + v.id);
    if (v.hash !== '#imp') fail('routing', 'the URL did not follow the view: "' + v.hash + '"');

    await page.evaluate(() => document.querySelector('[data-nav="settings"]').click());
    await page.waitForTimeout(200);
    await page.goBack();
    await page.waitForTimeout(300);
    v = await view();
    if (v.id !== 'imp') fail('routing', 'back from settings landed on ' + v.id + ', expected imp');

    await page.goForward();
    await page.waitForTimeout(300);
    v = await view();
    if (v.id !== 'settings') fail('routing', 'forward landed on ' + v.id + ', expected settings');

    /* And a cold load of a deep link. */
    const deep = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await installStub(deep);
    await deep.goto(base + '#settings', { waitUntil: 'networkidle' });
    await deep.waitForTimeout(600);
    const landed = await deep.evaluate(() => {
      const on = document.querySelector('.view.on');
      return on ? on.id : null;
    });
    if (landed !== 'settings') fail('routing', 'a cold load of #settings opened ' + landed);
    await deep.close();
    await page.close();
  }

  /* ── the signup wizard advances ───────────────────────────────
     It sits below the broken [data-theme] branch, so Continue did nothing
     at all: filling the form and pressing it applied a colour scheme. A
     signup flow that cannot advance is the whole product, so it is worth a
     check that presses the real button and watches the step change. */
  {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await installStub(page, { signedIn: false });
    await page.goto(base, { waitUntil: 'networkidle' });
    await page.waitForTimeout(400);
    await page.evaluate(() => document.querySelector('[data-nav="setup"]').click());
    await page.waitForTimeout(250);

    const step = () => page.evaluate(() => {
      const on = document.querySelector('#setup .step.on');
      return on ? on.getAttribute('data-step') : null;
    });
    if (await step() !== '0') fail('signup', 'setup did not open on the first step');

    /* Continue with an empty form must NOT advance, that is the validation
       working, and it is also how we know the click is being handled at
       all rather than silently swallowed. */
    await page.evaluate(() => document.getElementById('authGo').click());
    await page.waitForTimeout(250);
    if (await step() !== '0') fail('signup', 'an empty form advanced past step 0');
    const flagged = await page.evaluate(() =>
      !document.getElementById('suEmailErr').hidden);
    if (!flagged) fail('signup', 'Continue on an empty form neither advanced nor complained, ' +
      'the click is being swallowed before it reaches the handler');

    await page.evaluate(() => {
      const set = (id, v) => {
        const el = document.getElementById(id);
        el.value = v;
        el.dispatchEvent(new Event('input', { bubbles: true }));
      };
      set('suEmail', 'darius@example.com');
      set('suPw', 'Correct-Horse-9');
      set('suPw2', 'Correct-Horse-9');
      set('suName', 'DariusOdds');
      const age = document.getElementById('ageOk');
      age.checked = true;
      age.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await page.evaluate(() => document.getElementById('authGo').click());
    await page.waitForTimeout(700);
    if (await step() !== '1') fail('signup', 'a valid form did not advance to the verify step');

    /* The history step used to be three buttons that chose a format and
       imported nothing. It is the real drop zone now, so a slip dropped
       during signup has to reach the reader and produce a card you can
       confirm, exactly as it does on the Import screen. */
    await page.evaluate(() => {
      /* Straight to the step rather than through verification, which needs
         a code this stub does not model. */
      document.querySelectorAll('#setup .step').forEach(s => s.classList.remove('on'));
      document.querySelector('#setup .step[data-step="4"]').classList.add('on');
    });
    await page.waitForTimeout(150);
    await page.setInputFiles('#setupFile', {
      name: 'slip.jpg', mimeType: 'image/jpeg', buffer: Buffer.from('a-slip')
    });
    await page.waitForTimeout(800);
    const wizardCard = await page.evaluate(() => {
      const c = document.querySelector('#setupResults .slipcard');
      if (!c) return null;
      const btn = c.querySelector('[data-confirm-slip]');
      return { ready: c.dataset.ready, stake: c.dataset.stake, disabled: btn ? btn.disabled : null };
    });
    if (!wizardCard) fail('signup', 'a slip dropped during signup produced no review card');
    else if (wizardCard.ready !== '1' || wizardCard.disabled)
      fail('signup', 'the signup import produced a card that cannot be confirmed');
    await page.close();
  }

  /* ── logging in actually opens the app ────────────────────────
     "Won't let me sign in after making an account." The password was
     right and the session cookie was set; the client simply never asked
     again who it was, so go() still held the signed-out user it read at
     boot and refused every app view. The symptom was being thrown back to
     the signup screen with "create an account, or log in".

     The check is deliberately end to end: fill the real fields, press the
     real button, and require the dashboard. Anything less would have
     passed while the bug was live. */
  {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await installStub(page, { signedIn: false });
    await page.goto(base, { waitUntil: 'networkidle' });
    await page.waitForTimeout(400);
    await page.evaluate(() => document.querySelector('[data-nav="setup"]').click());
    await page.waitForTimeout(250);
    await page.evaluate(() => document.querySelector('#authSeg [data-auth="in"]').click());
    await page.waitForTimeout(200);

    const loginVisible = await page.evaluate(() => {
      const el = document.getElementById('liUser');
      return Boolean(el) && !document.getElementById('authLogin').hidden;
    });
    if (!loginVisible) fail('login', 'the log in panel did not open, or has no username field');

    /* A username, not an email. The account is found by either, and the
       display name is the one people remember. */
    await page.evaluate(() => {
      const set = (id, v) => {
        const el = document.getElementById(id);
        el.value = v;
        el.dispatchEvent(new Event('input', { bubbles: true }));
      };
      set('liUser', 'DariusOdds');
      set('liPw', 'Correct-Horse-9');
    });
    await page.evaluate(() => document.getElementById('authGo').click());
    await page.waitForTimeout(900);

    const view = await page.evaluate(() => {
      const on = document.querySelector('.view.on');
      return on ? on.id : null;
    });
    if (view !== 'dash') {
      fail('login', 'a correct username and password landed on "' + view +
        '" rather than the dashboard');
    }
    await page.close();
  }

  /* ── a promo code changes the plan ────────────────────────────
     Redemption is a server act; what is checked here is that the client
     sends the code and repaints the plan from the answer rather than
     believing its own optimism. */
  {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await installStub(page);
    await page.goto(base, { waitUntil: 'networkidle' });
    await page.waitForTimeout(500);
    await page.evaluate(() => document.querySelector('[data-pay="promo"]').click());
    await page.waitForTimeout(300);
    await page.evaluate(() => {
      const el = document.getElementById('payPromo');
      el.value = 'ak5-wrd';
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });
    const folded = await page.evaluate(() => document.getElementById('payPromo').value);
    if (folded !== 'AK5WRD') {
      fail('promo', 'the code field did not fold "ak5-wrd" to AK5WRD, so a code typed ' +
        'off a screenshot would be rejected');
    }
    await page.evaluate(() => document.getElementById('payPromoGo').click());
    await page.waitForTimeout(600);
    const limit = await page.evaluate(() => {
      const el = document.getElementById('planLimit');
      return el ? el.textContent : '';
    });
    if (!/permanently/i.test(limit)) {
      fail('promo', 'redeeming a lifetime code left the plan row saying "' + limit + '"');
    }
    await page.close();
  }

  /* ── import actually imports ──────────────────────────────────
     The complaint that started this was "I can't import". Confirm used to
     be a toast and a fade, the card collapsed, the counters moved, and
     nothing was ever stored. So the check is not that the UI reacts, it is
     that a POST leaves the browser with the right body. */
  {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await installStub(page);
    const posted = [];
    page.on('request', r => {
      if (r.url().includes('/api/bets') && r.method() === 'POST') {
        try { posted.push(JSON.parse(r.postData() || '{}')); } catch { posted.push({}); }
      }
    });
    await page.goto(base, { waitUntil: 'networkidle' });
    await page.waitForTimeout(500);
    await page.evaluate(() => { const e = document.querySelector('[data-nav="imp"]'); if (e) e.click(); });
    await page.waitForTimeout(200);

    /* A slip the reader can fully make out. */
    await page.setInputFiles('#slipFile', {
      name: 'slip.jpg', mimeType: 'image/jpeg', buffer: Buffer.from('not-a-real-jpeg')
    });
    await page.waitForTimeout(700);

    const card = await page.evaluate(() => {
      const c = document.querySelector('#uploadResults .card');
      if (!c) return null;
      const btn = c.querySelector('[data-confirm-slip]');
      return { ready: c.dataset.ready, stake: c.dataset.stake, odds: c.dataset.odds,
               selection: c.dataset.selection, disabled: btn ? btn.disabled : null };
    });
    if (!card) fail('import', 'uploading a slip produced no review card');
    else {
      if (card.ready !== '1') fail('import', 'a fully-read slip was not marked ready');
      if (card.stake !== '2500') fail('import', 'stake read as ' + card.stake + ', expected 2500 pence');
      if (card.disabled) fail('import', 'Confirm was disabled on a complete slip');
    }

    await page.evaluate(() => { const b = document.querySelector('[data-confirm-slip]'); if (b) b.click(); });
    await page.waitForTimeout(600);
    if (!posted.length) fail('import', 'Confirm did not POST the bet, the slip was never saved');
    else {
      const b = posted[0];
      if (b.stakePence !== 2500) fail('import', 'POSTed stakePence ' + b.stakePence + ', expected 2500');
      if (Number(b.odds) !== 1.85) fail('import', 'POSTed odds ' + b.odds + ', expected 1.85');
      if (!b.selection) fail('import', 'POSTed a bet with no selection');
    }

    /* A slip the reader could only partly make out: Confirm must stay shut
       until the missing field is typed, then work. */
    await page.setInputFiles('#slipFile', {
      name: 'blurry.jpg', mimeType: 'image/jpeg', buffer: Buffer.from('also-not-a-jpeg')
    });
    await page.waitForTimeout(700);
    const gated = await page.evaluate(() => {
      const cards = document.querySelectorAll('#uploadResults .slipcard');
      const c = cards[cards.length - 1];
      const btn = c && c.querySelector('[data-confirm-slip]');
      return { disabled: btn ? btn.disabled : null, ready: c && c.dataset.ready };
    });
    if (gated.disabled !== true) fail('import', 'Confirm was enabled on a slip with no stake');

    await page.evaluate(() => {
      const cards = document.querySelectorAll('#uploadResults .slipcard');
      const c = cards[cards.length - 1];
      const input = c.querySelector('[data-slip="stake"]');
      input.value = '40.00';
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await page.waitForTimeout(200);
    const fixed = await page.evaluate(() => {
      const cards = document.querySelectorAll('#uploadResults .slipcard');
      const c = cards[cards.length - 1];
      return { ready: c.dataset.ready, stake: c.dataset.stake,
               disabled: c.querySelector('[data-confirm-slip]').disabled };
    });
    if (fixed.ready !== '1' || fixed.disabled)
      fail('import', 'typing the missing stake did not unlock Confirm');
    if (fixed.stake !== '4000') fail('import', 'typed stake became ' + fixed.stake + ', expected 4000 pence');

    /* And the spreadsheet path, through the SAME drop zone. Upload and
       Other were two tabs asking the same question in two places; a CSV now
       goes into the one input and is recognised by its own extension. */
    await page.setInputFiles('#slipFile', {
      name: 'history.csv', mimeType: 'text/csv',
      buffer: Buffer.from(
        'Date,Event,Selection,Bookmaker,Odds,Stake,Profit\n' +
        '09/08/2026,Arsenal v Chelsea,Over 2.5 Goals,bet365,1.85,20.00,17.00\n' +
        '08/08/2026,Molde v Bodo/Glimt,Molde -1,Paddy Power,2.10,12.00,-12.00\n' +
        '07/08/2026,Broken row,,,,\n')
    });
    await page.waitForTimeout(500);
    const csv = await page.evaluate(() => {
      const go = document.getElementById('csvGo');
      return { hasButton: !!go, label: go ? go.textContent : '',
               report: document.getElementById('csvReport').textContent.slice(0, 200) };
    });
    if (!csv.hasButton) fail('import', 'a valid CSV produced no import button: ' + csv.report);
    else if (!/Import 2 bets/.test(csv.label))
      fail('import', 'CSV preview offered "' + csv.label + '", expected 2 importable bets');

    /* A slip that arrived already settled must carry its result through,
       computed from the returns the slip printed rather than from the odds:
       on a partially cashed-out or each-way slip the printed figure is right
       and the arithmetic is not. */
    await page.evaluate(() => { const b = document.querySelector('[data-import="importUpload"]'); if (b) b.click(); });
    await page.setInputFiles('#slipFile', {
      name: 'settled.jpg', mimeType: 'image/jpeg', buffer: Buffer.from('settled-slip')
    });
    await page.waitForTimeout(700);
    const settledCard = await page.evaluate(() => {
      const cards = document.querySelectorAll('#uploadResults .slipcard');
      const c = cards[cards.length - 1];
      return { stage: c.dataset.stage, result: c.dataset.result, returns: c.dataset.returns,
               note: (c.querySelector('.slipstage') || {}).textContent };
    });
    if (settledCard.stage !== 'settled' || settledCard.result !== 'won')
      fail('import', 'a settled slip read as stage=' + settledCard.stage + ' result=' + settledCard.result);
    if (!/settled/i.test(settledCard.note || ''))
      fail('import', 'the review card did not say the slip was already settled');

    const beforeSettled = posted.length;
    await page.evaluate(() => {
      const cards = document.querySelectorAll('#uploadResults .slipcard');
      const b = cards[cards.length - 1].querySelector('[data-confirm-slip]');
      if (b) b.click();
    });
    await page.waitForTimeout(600);
    const sent = posted.slice(beforeSettled)[0];
    if (!sent) fail('import', 'confirming a settled slip did not POST');
    else {
      if (sent.outcome !== 'won') fail('import', 'settled slip POSTed outcome ' + sent.outcome);
      /* 38273 returned minus 30618 staked. */
      if (sent.profitPence !== 7655)
        fail('import', 'settled slip POSTed profit ' + sent.profitPence + ' pence, expected 7655');
    }

    /* A double, with a price on each leg AND a combined price.
       The old card had one Selection box and one Odds box, so a two-leg
       slip lost the leg prices entirely and the user had to decide which of
       the two selections to type. Both legs are editable, and correcting
       one recomputes what the ledger will be told. */
    await page.setInputFiles('#slipFile', {
      name: 'double.jpg', mimeType: 'image/jpeg', buffer: Buffer.from('a-double')
    });
    await page.waitForTimeout(700);
    const double = await page.evaluate(() => {
      const cards = document.querySelectorAll('#uploadResults .slipcard');
      const c = cards[cards.length - 1];
      return {
        legs: c.querySelectorAll('.slipleg').length,
        legOdds: [...c.querySelectorAll('[data-leg-field="odds"]')].map(i => i.value),
        total: c.querySelector('[data-slip="odds"]').value,
        selection: c.dataset.selection,
        count: (c.querySelector('.slipcount') || {}).textContent
      };
    });
    if (double.legs !== 2) fail('import', 'a two-leg slip rendered ' + double.legs + ' legs');
    if (double.legOdds.join(',') !== '1.20,1.17')
      fail('import', 'leg prices came through as ' + double.legOdds.join(','));
    if (double.total !== '1.40') fail('import', 'the combined price came through as ' + double.total);
    if (!/&/.test(double.selection || ''))
      fail('import', 'the legs were not joined into one selection: ' + double.selection);
    if (double.count !== '1') fail('import', 'bet count in the corner read ' + double.count);

    /* Correcting a leg price must be noticed. The legs multiplying to
       something other than the combined price is how a mistyped leg shows
       itself, and it is a note rather than a block because bookmakers round
       and system bets do not multiply at all. */
    await page.evaluate(() => {
      const cards = document.querySelectorAll('#uploadResults .slipcard');
      const i = cards[cards.length - 1].querySelector('[data-leg-field="odds"]');
      i.value = '3.50';
      i.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await page.waitForTimeout(200);
    const drifted = await page.evaluate(() => {
      const cards = document.querySelectorAll('#uploadResults .slipcard');
      const h = cards[cards.length - 1].querySelector('.sliphint');
      return h && !h.hidden ? h.textContent : '';
    });
    if (!/multiply/.test(drifted))
      fail('import', 'a leg price that disagrees with the combined price was not flagged');

    const before = posted.length;
    await page.evaluate(() => { const b = document.getElementById('csvGo'); if (b) b.click(); });
    await page.waitForTimeout(600);
    const bulk = posted.slice(before).find(b => Array.isArray(b.bets));
    if (!bulk) fail('import', 'the CSV import button did not POST the bets');
    else if (bulk.bets.length !== 2) fail('import', 'POSTed ' + bulk.bets.length + ' bets, expected 2');
    else if (bulk.bets[0].stakePence !== 2000)
      fail('import', 'CSV stake became ' + bulk.bets[0].stakePence + ' pence, expected 2000');

    await page.close();
  }

  /* ── social: the three-dot menu and the directory ─────────────
     The join code and Leave used to sit open across the top of the board.
     They are behind a menu now, and the two things worth asserting are
     that the menu actually hides them until it is opened, and that the
     directory never carries a join code, because a code in a public
     listing would make "private group" meaningless the moment a group
     changed visibility. */
  {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
    await installStub(page);
    await page.goto(base, { waitUntil: 'networkidle' });
    await page.evaluate(() => {
      document.querySelector('[data-nav="dash"]').click();
      document.getElementById('tabSocial').click();
    });
    await page.waitForTimeout(500);

    const closed = await page.evaluate(() => {
      const d = document.querySelector('.gmenu');
      if (!d) return null;
      const code = document.getElementById('groupShare');
      const leave = document.getElementById('groupLeave');
      /* checkVisibility, not offsetParent. A closed <details> hides its
         content with content-visibility on the UA's ::details-content,
         which leaves offsetParent set and would pass a test that only
         looked at that. checkVisibility accounts for it. */
      const shown = el => Boolean(el && el.checkVisibility({
        contentVisibilityAuto: true, visibilityProperty: true, opacityProperty: true
      }));
      return {
        open: d.hasAttribute('open'),
        codeVisible: shown(code),
        leaveVisible: shown(leave)
      };
    });
    if (!closed) fail('social', 'the group board has no three-dot menu');
    else {
      if (closed.open) fail('social', 'the group menu starts open');
      if (closed.codeVisible) fail('social', 'the join code is on the board rather than in the menu');
      if (closed.leaveVisible) fail('social', 'Leave group is on the board rather than in the menu');
    }

    /* Opening it must actually reveal both, or they are unreachable. */
    const opened = await page.evaluate(() => {
      const d = document.querySelector('.gmenu');
      d.querySelector('summary').click();
      return {
        code: Boolean(document.getElementById('groupShare')),
        leave: Boolean(document.getElementById('groupLeave'))
      };
    });
    await page.waitForTimeout(250);
    if (opened && (!opened.code || !opened.leave))
      fail('social', 'opening the group menu did not reveal the code and Leave');
    await page.screenshot({ path: path.join(SHOT_DIR, 'social-menu.png') });

    /* The directory. Alphabetical, no codes, and a Join on anything not
       already joined or full. */
    await page.evaluate(() => {
      const d = document.querySelector('.gmenu');
      if (d) d.removeAttribute('open');
      document.querySelector('[data-social="socialBrowse"]').click();
    });
    await page.waitForTimeout(600);
    const dir = await page.evaluate(() => {
      const rows = [...document.querySelectorAll('.browserow')];
      return {
        n: rows.length,
        names: rows.map(r => r.querySelector('.bname').textContent),
        joins: rows.filter(r => r.querySelector('[data-browse-join]')).length,
        html: document.getElementById('browseList').innerHTML
      };
    });
    if (!dir.n) fail('social', 'the group directory rendered no rows');
    else {
      const sorted = [...dir.names].sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
      if (dir.names.join('|') !== sorted.join('|'))
        fail('social', 'the directory is not alphabetical: ' + dir.names.join(', '));
      if (!dir.joins) fail('social', 'no row in the directory offers a way to join');
      /* Six upper-case characters with no vowel-free giveaway is what a
         join code looks like; the stub uses QT9WFB. Nothing of that shape
         belongs in a public listing. */
      if (/\b[A-Z0-9]{6}\b/.test(dir.html.replace(/<[^>]+>/g, ' ')))
        fail('social', 'something shaped like a join code is in the public directory');
    }
    await page.screenshot({ path: path.join(SHOT_DIR, 'social-browse.png') });
    await page.close();
  }

  /* ── the scroll-jacked sequence, beat by beat ────────────────── */
  {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
    await installStub(page, { signedIn: false });   // the sequence lives on the landing page
    await page.goto(base, { waitUntil: 'networkidle' });
    await page.waitForTimeout(600);
    const geo = await page.evaluate(() => {
      const t = document.querySelector('.jack-track');
      if (!t) return null;
      return { top: t.getBoundingClientRect().top + scrollY, span: t.offsetHeight - innerHeight };
    });
    if (geo) {
      for (const [i, frac] of [[1, 0], [2, 0.5], [3, 1]]) {
        /* html.snap sets scroll-behavior:smooth, so a plain scrollTo
           animates and the screenshot lands mid-flight. Jump instead. */
        await page.evaluate(y => { document.documentElement.style.scrollBehavior = 'auto'; scrollTo(0, y); },
          geo.top + geo.span * frac);
        await page.waitForTimeout(650);
        const beat = await page.evaluate(n => {
          const el = document.getElementById('jack');
          const a = getComputedStyle(el).getPropertyValue('--a' + n).trim();
          return { lead: parseFloat(a), scene: el.dataset.scene, h: document.getElementById('jackH').textContent };
        }, i);
        if (!(beat.lead > 0.95))
          fail('scroll-jack', 'beat ' + i + ' should be fully present at its own snap point, measured ' + beat.lead);
        if (beat.scene !== String(i - 1))
          fail('scroll-jack', 'beat ' + i + ' reports scene ' + beat.scene);
        await page.screenshot({ path: path.join(SHOT_DIR, 'jack-' + i + '.png') });
      }
    }
    await page.close();
  }

  /* ── screenshots ─────────────────────────────────────────────── */
  {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
    await installStub(page);
    await page.goto(base, { waitUntil: 'networkidle' });
    await page.waitForTimeout(600);
    for (const v of ['landing', 'dash', 'setup', 'howto', 'settings', 'imp']) {
      await page.evaluate(id => {
        const b = document.querySelector('[data-nav="' + id + '"]');
        if (b) b.click();
        window.scrollTo(0, 0);
      }, v);
      await page.waitForTimeout(500);
      await page.screenshot({ path: path.join(SHOT_DIR, v + '-390.png') });
    }
    /* the ledger and social panes, and a dark theme, for a look */
    await page.evaluate(() => {
      document.querySelector('[data-nav="dash"]').click();
      document.querySelector('[data-pane="ledger"]').click();
    });
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(SHOT_DIR, 'ledger-390.png') });
    await page.evaluate(() => document.querySelector('[data-pane="social"]').click());
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(SHOT_DIR, 'social-390.png') });
    await page.evaluate(() => {
      document.documentElement.setAttribute('data-theme', 'ink');
      document.querySelector('[data-pane="overview"]').click();
    });
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(SHOT_DIR, 'dash-ink-390.png') });
    await page.close();
  }

  await browser.close();
  server.close();

  if (problems.length) {
    console.log('\n' + problems.length + ' problem' + (problems.length === 1 ? '' : 's') + ':\n');
    const byArea = {};
    problems.forEach(p => (byArea[p.area] = byArea[p.area] || []).push(p.msg));
    for (const [area, msgs] of Object.entries(byArea)) {
      console.log('  ' + area + ' (' + msgs.length + ')');
      [...new Set(msgs)].slice(0, 8).forEach(m => console.log('    · ' + m));
    }
    console.log('');
    process.exit(1);
  }
  console.log('  audit   clean: no overflow, no axe violations, no console errors,\n          no duplicate ids, no em dashes');
  console.log('  shots   tools/screens/');
}

main().catch(e => { console.error(e); process.exit(1); });
