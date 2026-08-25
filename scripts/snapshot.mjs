/* ═══════════════════════════════════════════════════════════════════════════
 * ONE FILE THAT SHOWS THE WHOLE PRODUCT, OFFLINE
 *
 * `node scripts/snapshot.mjs` produces snapshot.html: every route and every
 * interactive state, at both breakpoints, in one document that opens with no
 * repository, no server and no network.
 *
 * WHY IT IS BUILT THE WAY IT IS
 *
 * Each capture lives in its own `<iframe srcdoc>` because the app's stylesheet
 * styles `html` and `body` and sets `data-t` on the root. Dropped into one
 * document, forty of those would fight each other. An iframe is the only
 * isolation a static file can have.
 *
 * That isolation has a price: an iframe cannot share the parent's stylesheet
 * or fonts, so each one carries its own. Naively that is 80KB of CSS and
 * 190KB of woff2 per capture, times about a hundred and eighty captures —
 * nineteen megabytes before a single line of markup. Two things bring it back
 * under the ten megabyte budget:
 *
 *   PRUNING. Every rule in the stylesheet is tested against the captured DOM
 *   and dropped if nothing matches. A settings screen does not need the
 *   landing page's hero animation.
 *
 *   SUBSETTING. The three faces are cut down to the characters that actually
 *   appear anywhere in the snapshot, which takes 190KB of woff2 to about ten.
 *
 * The icon sprite is pruned the same way: only the symbols a capture's
 * `<use href="#...">` references travel with it.
 *
 * Scripts are stripped from every capture, so nothing rehydrates and nothing
 * can reach the network. Iframe heights are measured at capture time and
 * written as attributes, because a static iframe cannot size itself.
 * ═══════════════════════════════════════════════════════════════════════════ */

import { chromium } from 'playwright-core';
import { execFileSync, spawn } from 'node:child_process';
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { ROUTES, SECTIONS } from '../lib/proto/routes.ts';

const PORT = Number(process.env.SNAPSHOT_PORT || 3199);
const BASE = `http://localhost:${PORT}`;
const CHROME = process.env.SNAPSHOT_CHROME
  || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const BUDGET = 10 * 1024 * 1024;

const VIEWPORTS = [
  { name: 'desktop', label: '1440 × 900', width: 1440, height: 900, mobile: false },
  { name: 'mobile', label: '390 × 844', width: 390, height: 844, mobile: true },
];

/* Marketing pages are the first thing dropped if the file runs over, because
   they are the one part a reader can also just look at on the web. */
const MARKETING = new Set(['/', '/how', '/pricing', '/themes', '/social', '/import', '/faq', '/demo']);

/* ── seeded demo data ──────────────────────────────────────────────────────
 * Every API is answered locally so nothing 503s and no screen renders empty.
 * `/api/me` reports nobody signed in, which is what leaves the product's own
 * worked example on screen: twelve bets, a full August, every breakdown
 * populated. Signed in, the app replaces all of it with the account's real
 * figures — and an account created for a snapshot has none. */
const STUBS = {
  '/api/me': { user: null },
  '/api/sources': { sources: [], secrets: [] },
};

async function seed(context) {
  await context.route('**/api/**', (route) => {
    const path = new URL(route.request().url()).pathname;
    const body = STUBS[path] ?? { ok: true, items: [], bets: [], plEntries: [] };
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
  /* Videos are 24MB and cannot travel in a 10MB file. The poster is what a
     reader sees anyway, since nothing autoplays. */
  await context.route('**/video/*.{mp4,webm}', (route) => route.abort());
}

/* ── the states that are not routes ────────────────────────────────────────
 * Driven by clicking, so what is captured is what a person would actually
 * reach rather than a view function called directly. */
const STATES = [
  { name: 'Social · Groups', path: ROUTES.social, click: '[data-soctab="groups"]' },
  { name: 'Social · People · Connected', path: ROUTES.social, click: '[data-soctab="people"]' },
  {
    name: 'Social · People · Following', path: ROUTES.social,
    click: '[data-soctab="people"]',
    then: async (page) => {
      /* The two are a segmented control, so the second is reached by
         pressing it rather than by a route. */
      const seg = page.locator('.seg button', { hasText: 'Following' }).first();
      if (await seg.count()) await seg.click({ timeout: 4000 }).catch(() => {});
    },
  },
  { name: 'Add a bet · type it in', path: ROUTES.import, click: '[data-go="manual"]' },
  { name: 'Ledger · filters open', path: ROUTES.ledger, sheet: 'filters' },
  { name: 'Ledger · sort', path: ROUTES.ledger, sheet: 'lsort' },
  { name: 'Dashboard · edit overview', path: ROUTES.overview, sheet: 'editov' },
  { name: 'Dashboard · period', path: ROUTES.overview, sheet: 'period' },
  { name: 'Dashboard · a day', path: ROUTES.overview, sheet: 'day' },
  { name: 'Challenges', path: ROUTES.social, sheet: 'challenge' },
  { name: 'New challenge', path: ROUTES.social, sheet: 'newchal' },
  { name: 'Create a group', path: ROUTES.social, sheet: 'creategroup' },
  { name: 'Cash out', path: ROUTES.ledger, sheet: 'cashout' },
  { name: 'Bet detail', path: ROUTES.ledger, sheet: 'betdetail' },
  { name: 'Settle by hand', path: ROUTES.ledger, sheet: 'fix' },
  { name: 'Telegram set-up', path: ROUTES.import, sheet: 'bot' },
  { name: 'Menu', path: '/', sheet: 'menu' },
  { name: 'Terms', path: ROUTES.settings, sheet: 'terms' },
  { name: 'Privacy policy', path: ROUTES.settings, sheet: 'privacypol' },
  { name: 'Export', path: ROUTES.settings, sheet: 'export' },
  { name: 'Delete account', path: ROUTES.settings, sheet: 'delacc' },
];

/* Every remaining sheet, at the narrow width only: a sheet is a bottom drawer
   and the phone is the shape it was drawn for. */
const STATE_SHEETS = new Set(STATES.filter((s) => s.sheet).map((s) => s.sheet));

const log = (...a) => console.log(...a);

/* ── capture ───────────────────────────────────────────────────────────── */

async function settle(page) {
  await page.waitForLoadState('domcontentloaded');
  await page.waitForFunction(() => Boolean(window.__slippery), null, { timeout: 15000 }).catch(() => {});
  await page.waitForLoadState('networkidle').catch(() => {});
  /* The reveal observer and the card stagger both run on timers. */
  await page.waitForTimeout(900);
  await page.evaluate(() => {
    /* Everything on screen at once: the snapshot is a still, so a section
       waiting to be scrolled into view would be captured invisible. */
    document.querySelectorAll('.reveal').forEach((el) => {
      el.classList.add('in'); el.classList.remove('offscreen');
    });
    document.querySelectorAll('[data-bar]').forEach((el) => {
      const w = el.style.getPropertyValue('--tw');
      if (w) el.style.width = w; else el.style.height = el.style.getPropertyValue('--th');
    });
    document.querySelectorAll('.fill,.pacebar .f').forEach((el) => {
      if (el.dataset.w) el.style.width = el.dataset.w + '%';
    });
    document.querySelectorAll('.cal .c').forEach((el) => el.classList.add('in'));
  });
  await page.waitForTimeout(350);
}

async function grab(page, { route, viewport, state }) {
  await settle(page);

  /* RE-SETTLE IF THE PAGE HAS NOT PAINTED YET.
     `repaint()` replaces the whole of `.body`, so a capture taken in the
     frame between the old subtree going and the new one arriving measures a
     height of nothing and records a blank iframe. It showed up as two empty
     `/app/social` captures at 390 — the two that follow a tab click — on a
     page that is perfectly fine when you load it. One retry is enough,
     because the race is a single frame wide. */
  for (let i = 0; i < 3; i++) {
    const painted = await page.evaluate(() =>
      (document.querySelector('.body')?.innerText || '').trim().length > 0);
    if (painted) break;
    await page.waitForTimeout(250);
    await settle(page);
  }

  const { html, height, sprite } = await page.evaluate(() => {
    const doc = document.documentElement;
    /* Measured here because a static iframe cannot size itself. */
    const height = Math.ceil(Math.max(
      doc.scrollHeight, document.body.scrollHeight,
      ...[...document.querySelectorAll('.body,.ph')].map((el) => el.scrollHeight || 0),
    ));
    const sprite = [...new Set(
      [...document.querySelectorAll('use')].map((u) => (u.getAttribute('href') || '').replace('#', '')),
    )].filter(Boolean);
    return { html: doc.outerHTML, height, sprite };
  });
  /* Capped only against a runaway measurement, not against real content:
     the landing page is over six thousand pixels tall and a 6000 ceiling was
     quietly cutting the last 480px off it. */
  return { route, viewport, state, html, height: Math.min(height + 24, 20000), sprite };
}

/* ── the page's own stylesheet, once ───────────────────────────────────── */

function builtCss() {
  const dir = '.next/static/css';
  if (!existsSync(dir)) throw new Error('No built CSS. Run `npm run build` first.');
  return readdirSync(dir).filter((f) => f.endsWith('.css'))
    .map((f) => readFileSync(join(dir, f), 'utf8')).join('\n');
}

/* Rules whose selectors match nothing in this capture are dropped. A settings
   screen does not need the landing page's hero keyframes. Anything that
   cannot be tested — @font-face, @keyframes, :root, custom properties — is
   always kept, because a false drop is a broken snapshot and a false keep is
   only a few bytes. */
async function pruneCss(page, css) {
  return page.evaluate((source) => {
    const keepAt = /^@(font-face|keyframes|-webkit-keyframes|property|charset|supports|layer|counter-style)/i;
    const sheet = new CSSStyleSheet();
    try { sheet.replaceSync(source); } catch { return source; }

    const used = (sel) => {
      /* Split on commas outside brackets, keep any selector that matches. */
      const parts = sel.split(/,(?![^(]*\))/).map((s) => s.trim()).filter(Boolean);
      const kept = parts.filter((s) => {
        const bare = s
          .replace(/::?(before|after|first-line|first-letter|placeholder|selection|marker|backdrop|-webkit-[a-z-]+)/g, '')
          .replace(/:(hover|focus|focus-visible|focus-within|active|visited|target|disabled|enabled|checked|indeterminate|default|valid|invalid|required|optional|read-only|read-write|autofill|user-invalid)\b/g, '')
          .replace(/:where\(([^)]*)\)/g, '$1')
          .trim();
        if (!bare || bare === '*') return true;
        try { return document.querySelector(bare) !== null; } catch { return true; }
      });
      return kept.length ? kept.join(',') : null;
    };

    const walk = (rules) => {
      const out = [];
      for (const rule of rules) {
        if (rule.type === CSSRule.STYLE_RULE) {
          const sel = used(rule.selectorText);
          if (sel) out.push(sel + '{' + rule.style.cssText + '}');
        } else if (rule.cssRules && !keepAt.test(rule.cssText)) {
          const inner = walk(rule.cssRules);
          if (inner) out.push(rule.cssText.slice(0, rule.cssText.indexOf('{') + 1) + inner + '}');
        } else {
          out.push(rule.cssText);
        }
      }
      return out.join('');
    };
    return walk(sheet.cssRules);
  }, css);
}

/* ── fonts ─────────────────────────────────────────────────────────────── */

/* Cut to the characters that actually appear. 190KB of woff2 becomes about
   ten, which is the difference between this file fitting and not. */
function subsetFonts(text) {
  const chars = [...new Set(text)].filter((c) => c.codePointAt(0) > 31).join('');
  const dir = mkdtempSync(join(tmpdir(), 'slip-fonts-'));
  const faces = [
    ['SourceSerif4-400-latin.woff2', 'Source Serif 4'],
    ['SchibstedGrotesk-400-latin.woff2', 'Schibsted Grotesk'],
    ['GeistMono-400-latin.woff2', 'Geist Mono'],
  ];
  const out = [];
  for (const [file, family] of faces) {
    const src = join('public/fonts', file);
    if (!existsSync(src)) { log('  ! missing', file, '— dropping it rather than leaving a broken URL'); continue; }

    /* ALL THREE ARE VARIABLE FONTS, and a subset of a variable font keeps the
     * whole design space: Source Serif came out at 67KB for about a hundred
     * and twenty glyphs, because it carries a weight axis from 200 to 900 and
     * an optical size axis from 8 to 60. Pinning optical size and narrowing
     * the weight range to what the product actually uses takes the same
     * glyphs to eighteen, with every weight on the page still correct. */
    const pinned = join(dir, 'pin-' + file);
    const subset = join(dir, file);
    try {
      execFileSync('python3', ['-c', `
import sys
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer
t = TTFont(sys.argv[1])
if 'fvar' in t:
    axes = {a.axisTag: a for a in t['fvar'].axes}
    limits = {}
    for tag, a in axes.items():
        if tag == 'wght':
            limits[tag] = (max(a.minValue, 400), min(a.maxValue, 800))
        else:
            limits[tag] = a.defaultValue
    t = instancer.instantiateVariableFont(t, limits, inplace=True, updateFontNames=False)
t.flavor = 'woff2'
t.save(sys.argv[2])
`, src, pinned], { stdio: 'pipe' });
    } catch {
      log('  ! could not pin the axes on', file, '— subsetting it as it is');
    }

    const input = existsSync(pinned) ? pinned : src;
    try {
      execFileSync('pyftsubset', [input,
        '--output-file=' + subset, '--flavor=woff2',
        '--text=' + chars,
        /* Kerning, ligatures and tabular figures are the only features a
           snapshot needs; everything else is table weight. */
        '--layout-features=kern,liga,tnum,lnum',
        '--no-hinting', '--drop-tables+=DSIG,MVAR,STAT,HVAR',
      ], { stdio: 'pipe' });
    } catch {
      log('  ! could not subset', file, '— using it whole');
      out.push([family, readFileSync(input)]);
      continue;
    }
    out.push([family, readFileSync(subset)]);
  }
  const total = out.reduce((t, [, b]) => t + b.length, 0);
  log(`  ${(total / 1024).toFixed(1)}KB of woff2, carried by every capture`);
  return out.map(([family, buf]) => {
    log(`    ${family}: ${(buf.length / 1024).toFixed(1)}KB`);
    return `@font-face{font-family:'${family}';font-style:normal;font-weight:400 800;` +
      `font-display:block;src:url(data:font/woff2;base64,${buf.toString('base64')}) format('woff2')}`;
  }).join('');
}

/* ── cleaning a captured document ──────────────────────────────────────── */

function clean(html, spriteIds) {
  let out = html;

  /* Nothing may rehydrate, and nothing may reach the network. */
  out = out.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
  out = out.replace(/<script\b[^>]*\/>/gi, '');
  out = out.replace(/<link\b[^>]*rel=["']?(stylesheet|preload|prefetch|icon|manifest|apple-touch-icon)["']?[^>]*>/gi, '');
  out = out.replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, '');
  /* A video with no source is a grey box; the poster is the frame anyway. */
  out = out.replace(/<source\b[^>]*>/gi, '');
  out = out.replace(/\son(?:load|error|click|change|scroll|input)="[^"]*"/gi, '');

  /* Only the symbols this capture actually points at. */
  out = out.replace(/<symbol\b([^>]*)id="([^"]+)"([\s\S]*?)<\/symbol>/gi,
    (m, a, id) => (spriteIds.includes(id) ? m : ''));

  /* THE SUBSET FACES REPLACE THE APP'S OWN.
   * The pruner always keeps @font-face — it cannot test one against the DOM
   * — so the original six rules survived, still pointing at /fonts/*.woff2,
   * and the asset inliner then dutifully embedded all six full files in
   * every capture on top of the three subsets. Six hundred and thirteen
   * fonts in a forty megabyte sample. They go before the CSS is written. */
  if (!out.includes('</head>')) out = out.replace(/<html([^>]*)>/i, '<html$1><head></head>');
  return out;
}

/* Anything still pointing at a URL is inlined, or dropped — never left to
   fail. A broken image in a file somebody opens offline is the one thing
   this whole script exists to avoid. */
async function inlineAssets(html, fetchAsset) {
  const urls = new Set();
  for (const m of html.matchAll(/(?:src|poster|href)="(\/[^"?#]+\.(?:png|jpe?g|gif|webp|avif|svg|ico))"/gi)) urls.add(m[1]);
  for (const m of html.matchAll(/url\((["']?)(\/[^)"']+)\1\)/gi)) urls.add(m[2]);
  /* Fonts are embedded once as subsets; anything still pointing at
     /fonts is a duplicate of one of them. */
  for (const u of [...urls]) if (u.startsWith('/fonts/')) urls.delete(u);
  let out = html;
  for (const url of urls) {
    const data = await fetchAsset(url);
    if (!data) {
      out = out.split(`"${url}"`).join('""').split(`url(${url})`).join('none');
      continue;
    }
    out = out.split(url).join(data);
  }
  return out;
}

/* ── the wrapper ───────────────────────────────────────────────────────── */

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
const escText = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const jsonEmbed = (v) => JSON.stringify(v)
  .replace(/</g, '\\u003c').replace(/>/g, '\\u003e')
  .replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');

/* ═══ WHY THE PARENT ASSEMBLES THE SRCDOC ══════════════════════════════════
 *
 * Written literally into the file, `srcdoc` cannot share anything: each of a
 * hundred and nineteen captures carries its own copy of the fonts, its own
 * stylesheet and its own copy of every poster. Measured, that was 7.8MB of
 * woff2 and 2.6MB of JPEG — fifty two and seventeen per cent of a file with
 * a ten megabyte budget, and all of it the same handful of bytes over and
 * over.
 *
 * So the shared parts are stored once and the parent stitches each capture
 * together as it scrolls into view. What ends up in the browser is exactly
 * what was asked for — an `<iframe srcdoc>` per capture, fully isolated —
 * and the captured DOM inside it still has every script stripped, so nothing
 * rehydrates and nothing can reach the network. The only script in the file
 * is the ten lines below, in the wrapper, doing string concatenation.
 *
 * Everything renders from `file://` with the network off. Each capture's
 * label, route and dimensions are plain markup, so the structure of the file
 * is readable even where the frames are not.
 * ═══════════════════════════════════════════════════════════════════════ */
function assemble(captures, fontFaces) {
  /* Identical pruned stylesheets and repeated assets are stored once and
     referenced. Most captures of the same screen share both exactly. */
  const cssTable = [];
  const cssIndex = new Map();
  const assetTable = [];
  const assetIndex = new Map();

  const intern = (table, index, value) => {
    if (index.has(value)) return index.get(value);
    const i = table.length;
    table.push(value); index.set(value, i);
    return i;
  };

  const bodies = captures.map((c) => {
    let html = c.body;
    /* Any data URI that appears more than once anywhere becomes a token. */
    html = html.replace(/data:(?:image|font)\/[a-z0-9+.-]+;base64,[A-Za-z0-9+/=]+/g,
      (uri) => '%%SNAPASSET' + intern(assetTable, assetIndex, uri) + '%%');
    return { c: intern(cssTable, cssIndex, c.css), h: html };
  });

  const groups = new Map();
  captures.forEach((c, i) => {
    if (!groups.has(c.route)) groups.set(c.route, []);
    groups.get(c.route).push(i);
  });

  const nav = [...groups.keys()].map((r, i) => `<a href="#s${i}">${escText(r)}</a>`).join('');

  const sections = [...groups.entries()].map(([route, idxs], gi) => `
<section id="s${gi}">
  <h2 class="route">${escText(route)}</h2>
  ${idxs.map((i) => {
    const c = captures[i];
    return `
  <figure class="cap">
    <figcaption class="lab">
      <b>${escText(c.route)}</b>
      <span class="vp">${escText(c.viewport)}</span>
      ${c.state ? `<span class="st">${escText(c.state)}</span>` : ''}
    </figcaption>
    <div class="frame" style="--w:${c.width}px">
      <iframe data-i="${i}" width="${c.width}" height="${c.height}"
        title="${esc(c.route + ' — ' + c.viewport + (c.state ? ' — ' + c.state : ''))}"
        sandbox="allow-same-origin"></iframe>
    </div>
  </figure>`;
  }).join('')}
</section>`).join('');

  return `<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Slippery — every screen</title>
<style>
  :root{color-scheme:dark;--ink:#E6EBF3;--dim:#8A94A6;--line:#242833;--bg:#0A0C10;--card:#12151C;--accent:#A8C2E8}
  *{box-sizing:border-box}
  body{margin:0;background:var(--bg);color:var(--ink);
   font:15px/1.5 ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
  header{position:sticky;top:0;z-index:9;background:rgba(10,12,16,.94);
   border-bottom:1px solid var(--line);padding:14px 22px}
  h1{margin:0 0 3px;font-size:17px;letter-spacing:-.01em}
  .sub{color:var(--dim);font-size:12.5px}
  nav{display:flex;flex-wrap:wrap;gap:5px;margin-top:11px;max-height:96px;overflow:auto}
  nav a{color:var(--dim);text-decoration:none;font-size:11.5px;padding:3px 8px;
   border:1px solid var(--line);border-radius:999px;white-space:nowrap}
  nav a:hover{color:var(--ink);border-color:var(--accent)}
  section{padding:26px 22px 6px;border-top:1px solid var(--line)}
  .route{margin:0 0 14px;font-size:13px;letter-spacing:.1em;text-transform:uppercase;color:var(--accent)}
  .cap{margin:0 0 30px}
  /* The label stays put while a tall capture scrolls past it. */
  .lab{position:sticky;top:104px;z-index:5;display:flex;flex-wrap:wrap;gap:8px;align-items:baseline;
   background:var(--card);border:1px solid var(--line);border-radius:9px 9px 0 0;
   border-bottom:0;padding:9px 13px}
  .lab b{font-size:13px;font-weight:600}
  .lab .vp{font-size:11.5px;color:var(--dim);font-variant-numeric:tabular-nums}
  .lab .st{font-size:11.5px;color:var(--accent)}
  .frame{border:1px solid var(--line);border-radius:0 0 9px 9px;overflow:hidden;
   background:#0C0E13;max-width:100%;width:var(--w)}
  iframe{display:block;border:0;max-width:100%;background:#0C0E13}
  footer{padding:24px 22px 60px;color:var(--dim);font-size:12px;border-top:1px solid var(--line)}
  noscript p{margin:12px 22px;padding:12px 14px;border:1px solid var(--accent);border-radius:9px}
</style>
</head>
<body>
<header>
  <h1>Slippery — every screen</h1>
  <div class="sub">${captures.length} captures · no network required · the captured pages have their scripts stripped, so nothing here is interactive</div>
  <nav>${nav}</nav>
</header>
<noscript><p>The captures are assembled in the page, so this file needs JavaScript
enabled — not to fetch anything, only to join strings that are stored once instead
of a hundred and nineteen times.</p></noscript>
${sections}
<footer>Generated by scripts/snapshot.mjs. Each capture is the real DOM the app rendered,
isolated in an iframe carrying only the CSS rules and icon symbols it uses.</footer>
<script>
/* Shared once: the three subset faces, every distinct pruned stylesheet, and
   every asset that appears in more than one capture.
   NOTE the doubled backslash in the pattern below: this whole block is inside
   a template literal in the generator, where a lone \\d is not an escape and
   collapses to a bare d. The emitted regex then matched nothing and ninety
   six placeholders went out as literal text. */
const F=${jsonEmbed(fontFaces)},C=${jsonEmbed(cssTable)},A=${jsonEmbed(assetTable)},B=${jsonEmbed(bodies)};
const build=(i)=>{const b=B[i];
  return b.h.replace(/%%SNAPASSET(\\d+)%%/g,(m,n)=>A[+n])
    .replace('</head>','<style>'+F+C[b.c]+'</style></head>');};
const io=new IntersectionObserver((es)=>{for(const e of es){if(!e.isIntersecting)continue;
  const f=e.target;io.unobserve(f);f.srcdoc=build(+f.dataset.i);}},{rootMargin:'900px 0px'});
document.querySelectorAll('iframe[data-i]').forEach((f)=>io.observe(f));
</script>
</body>
</html>`;
}

/* ── main ──────────────────────────────────────────────────────────────── */

async function main() {
  const server = await ensureServer();
  const browser = await chromium.launch({ executablePath: CHROME });
  const rawCss = builtCss();
  log(`stylesheet: ${(rawCss.length / 1024).toFixed(0)}KB before pruning`);

  const captures = [];
  const paths = [...Object.values(ROUTES), ...Object.keys(SECTIONS)];

  for (const vp of VIEWPORTS) {
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      isMobile: vp.mobile, hasTouch: vp.mobile, deviceScaleFactor: 1,
    });
    await seed(context);
    const page = await context.newPage();
    const failures = [];
    page.on('requestfailed', (r) => { if (!/\.(mp4|webm)$/.test(r.url())) failures.push(r.url()); });

    for (const path of paths) {
      await page.goto(BASE + path, { waitUntil: 'domcontentloaded' });
      captures.push({ ...(await grab(page, { route: path, viewport: vp.label })), width: vp.width, rawCss, page: null, marketing: MARKETING.has(path) });
      log(`  ${vp.name} ${path}`);
    }

    for (const st of STATES) {
      await page.goto(BASE + st.path, { waitUntil: 'domcontentloaded' });
      await settle(page);
      if (st.click) {
        const el = page.locator(st.click).first();
        if (await el.count()) { await el.click({ timeout: 4000 }).catch(() => {}); }
      }
      if (st.then) await st.then(page);
      if (st.sheet) await page.evaluate((k) => window.__slippery.sheet(k), st.sheet).catch(() => {});
      await page.waitForTimeout(650);
      captures.push({ ...(await grab(page, { route: st.path, viewport: vp.label, state: st.name })), width: vp.width, rawCss, marketing: MARKETING.has(st.path) });
      log(`  ${vp.name} ${st.path} — ${st.name}`);
    }

    /* Every remaining sheet, narrow only. */
    if (vp.mobile) {
      const keys = await page.evaluate(() => window.__slippery.sheetKeys);
      for (const k of keys) {
        if (STATE_SHEETS.has(k)) continue;
        await page.goto(BASE + ROUTES.overview, { waitUntil: 'domcontentloaded' });
        await settle(page);
        const opened = await page.evaluate((key) => {
          try { window.__slippery.sheet(key); return true; } catch { return false; }
        }, k);
        if (!opened) { log(`  ! sheet ${k} would not open — skipped`); continue; }
        await page.waitForTimeout(600);
        captures.push({ ...(await grab(page, { route: 'sheet', viewport: vp.label, state: k })), width: vp.width, rawCss, marketing: false });
        log(`  ${vp.name} sheet ${k}`);
      }
    }

    if (failures.length) log(`  ! ${failures.length} failed requests at ${vp.name}:`, [...new Set(failures)].slice(0, 5));
    await context.close();
  }

  /* Prune each capture's CSS against its own DOM, in a throwaway page. */
  log('pruning stylesheets…');
  const pctx = await browser.newContext();
  const ppage = await pctx.newPage();
  for (const c of captures) {
    await ppage.setContent(c.html, { waitUntil: 'domcontentloaded' });
    c.css = (await pruneCss(ppage, rawCss)).replace(/@font-face\s*\{[^}]*\}/gi, '');
  }
  await pctx.close();
  const avg = captures.reduce((t, c) => t + c.css.length, 0) / captures.length / 1024;
  log(`  average ${avg.toFixed(0)}KB per capture, from ${(rawCss.length / 1024).toFixed(0)}KB`);

  /* Subset the faces to the characters the whole snapshot uses. */
  log('subsetting fonts…');
  const allText = captures.map((c) => c.html.replace(/<[^>]+>/g, ' ')).join(' ');
  const fontFaces = subsetFonts(allText + ' 0123456789£$€%+−-–—·×✓✕⋯›‹▾▸◂↑↓⌄');

  /* Inline whatever is left, from the running server. */
  log('inlining assets…');
  const actx = await browser.newContext();
  const apage = await actx.newPage();
  const cache = new Map();
  const fetchAsset = async (url) => {
    if (cache.has(url)) return cache.get(url);
    let value = null;
    try {
      const res = await apage.request.get(BASE + url);
      if (res.ok()) {
        const buf = await res.body();
        /* Anything past a quarter megabyte is not worth carrying. */
        if (buf.length <= 120_000) {
          const type = res.headers()['content-type'] || 'application/octet-stream';
          value = `data:${type.split(';')[0]};base64,${buf.toString('base64')}`;
        }
      }
    } catch { /* dropped below */ }
    if (!value) log('  ! dropped', url);
    cache.set(url, value);
    return value;
  };

  for (const c of captures) {
    c.body = clean(c.html, c.sprite);
    c.body = await inlineAssets(c.body, fetchAsset);
  }
  await actx.close();
  await browser.close();

  /* Budget. Marketing at the narrow width goes first, as instructed. */
  let kept = captures;
  let file = assemble(kept, fontFaces);
  if (file.length > BUDGET) {
    log(`${(file.length / 1048576).toFixed(1)}MB over budget — dropping mobile marketing captures`);
    kept = kept.filter((c) => !(c.marketing && c.viewport.startsWith('390')));
    file = assemble(kept, fontFaces);
  }
  while (file.length > BUDGET && kept.length > 40) {
    kept = kept.filter((c, i) => !(c.route === 'sheet' && i % 2));
    const next = assemble(kept, fontFaces);
    if (next.length === file.length) break;
    file = next;
    log(`  still over — ${kept.length} captures left`);
  }

  writeFileSync('snapshot.html', file);
  log(`\nsnapshot.html — ${(file.length / 1048576).toFixed(2)}MB, ${kept.length} captures`);
  if (server) server.kill();
}

async function ensureServer() {
  try {
    const res = await fetch(BASE + '/', { signal: AbortSignal.timeout(1500) });
    if (res.ok) { log(`using the server already on ${PORT}`); return null; }
  } catch { /* start one */ }
  log(`starting next on ${PORT}…`);
  const proc = spawn('npx', ['next', 'start', '-p', String(PORT)], { stdio: 'ignore', detached: false });
  for (let i = 0; i < 60; i++) {
    try { const r = await fetch(BASE + '/', { signal: AbortSignal.timeout(1000) }); if (r.ok) return proc; } catch {}
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error('the server did not come up');
}

main().catch((err) => { console.error(err); process.exit(1); });
