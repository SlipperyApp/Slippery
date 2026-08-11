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

const root = path.dirname(path.dirname(new URL(import.meta.url).pathname));
const CHROME = process.env.CHROME_BIN || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const WIDTHS = [320, 390, 430];
const SHOT_DIR = path.join(root, 'tools', 'screens');

const VIEWS = ['landing', 'setup', 'howto', 'pricing', 'dash', 'imp', 'settings', 'bot', 'help', 'terms', 'privacy'];
const THEMES = ['periwinkle', 'graphite', 'ink', 'tide', 'chalk'];

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
    await page.goto(base, { waitUntil: 'networkidle' });
    for (const v of VIEWS) {
      await page.evaluate(id => {
        const b = document.querySelector('[data-nav="' + id + '"]');
        if (b) b.click();
        else document.querySelectorAll('.view').forEach(x => x.classList.toggle('on', x.id === id));
      }, v);
      await page.waitForTimeout(120);
    }
    /* exercise the interactive paths that broke before */
    await page.evaluate(() => {
      document.querySelector('[data-nav="dash"]').click();
      document.querySelector('#runToggle').click();
      document.querySelector('#checkResults').click();
    });
    await page.waitForTimeout(1400);
    await page.evaluate(() => {
      document.querySelector('#moreToggle').click();
      document.querySelector('#viewAllBets').click();
      const cell = document.querySelector('.cell[data-day]');
      if (cell) cell.click();
    });
    await page.waitForTimeout(400);
    await page.evaluate(() => document.querySelector('#dayClose').click());
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
      document.querySelector('#calMode [data-cal="y"]').click();
      document.querySelector('[data-pane="ledger"]').click();
      document.querySelector('#ledgerSeg [data-ledger="ledgerAnalysis"]').click();
      document.querySelector('[data-pane="social"]').click();
      const p = document.querySelector('[data-profile]');
      if (p) p.click();
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
    await page.close();
  }

  /* ── horizontal overflow at every width, on every view ───────── */
  for (const width of WIDTHS) {
    const page = await browser.newPage({ viewport: { width, height: 844 }, deviceScaleFactor: 2 });
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
        fail('h-overflow', width + 'px / ' + v + ': ' + res.over + 'px — ' + (res.culprits.join(' | ') || 'no element found'));
      }
    }
    await page.close();
  }

  /* ── axe-core, per view ──────────────────────────────────────── */
  {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
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
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await page.goto(base, { waitUntil: 'networkidle' });
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
       become visible when focused — an invisible skip link is no skip link.
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
    await page.goto(base, { waitUntil: 'networkidle' });
    const running = await page.evaluate(() => {
      return document.getAnimations().filter(a => a.playState === 'running').length;
    });
    if (running > 0) fail('reduced-motion', running + ' animations still running under prefers-reduced-motion');

    /* The pinned sequence must not merely animate less — it must stop
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

  /* ── the scroll-jacked sequence, beat by beat ────────────────── */
  {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
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
    await page.goto(base, { waitUntil: 'networkidle' });
    await page.waitForTimeout(600);
    for (const v of ['landing', 'dash', 'setup', 'howto', 'settings', 'imp', 'bot']) {
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
  console.log('  audit   clean: no overflow, no axe violations, no console errors, no duplicate ids');
  console.log('  shots   tools/screens/');
}

main().catch(e => { console.error(e); process.exit(1); });
