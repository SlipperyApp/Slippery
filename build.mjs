/* Build: src/ -> public/index.html
 *
 * One self-contained HTML file, plus fonts and PWA assets as siblings.
 * Vercel runs this on every push; there is no manual step.
 */
import { build as esbuild } from 'esbuild';
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const root = path.dirname(new URL(import.meta.url).pathname);
const src = p => path.join(root, 'src', p);
const out = p => path.join(root, 'public', p);

/* ────────────────────────────────────────────────────────────────
   CSS class ownership check.

   Two production bugs came from class collisions: a sparkline reusing
   .bar inherited the sticky header's backdrop-filter and position:sticky
   and pushed 69px of overflow, and a text line using .sel rendered as a
   dropdown. Both were a new component quietly adopting an existing name.

   The rule enforced here: a class introduced at the top level of a
   stylesheet is OWNED by that file. If two files both introduce it, the
   build fails. Classes nested inside a parent rule are scoped already and
   are not checked.
   ──────────────────────────────────────────────────────────────── */
const SHARED = new Set([
  /* deliberate cross-cutting state and utility classes */
  'on', 'shown', 'reveal', 'pos', 'neg', 'mut', 'dim', 'm', 'num', 'tnum',
  'sr', 'wrap', 'nar', 'card', 'pad', 'flush', 'snap', 'snap-point',
  'collapsing', 'hidden', 'small', 'full', 'tight', 'compact', 'large'
]);

function topLevelClasses(css) {
  const found = new Set();
  let depth = 0, i = 0, buf = '';
  while (i < css.length) {
    const ch = css[i];
    if (ch === '/' && css[i + 1] === '*') { i = css.indexOf('*/', i) + 2; continue; }
    if (ch === '{') {
      if (depth === 0) {
        const sel = buf.trim();
        if (!sel.startsWith('@')) {
          /* Only the element actually being styled counts as an
             introduction. In ".hero h1" the owner is h1, not .hero — an
             ancestor is a reference, not a definition, or every layout
             wrapper would look like a collision. */
          for (const one of sel.split(',')) {
            const compounds = one.trim().split(/\s*[>+~]\s*|\s+/).filter(Boolean);
            const last = compounds[compounds.length - 1] || '';
            for (const m of last.matchAll(/\.([A-Za-z_][\w-]*)/g)) found.add(m[1]);
          }
        }
        /* @media / @supports bodies hold top-level rules too, so do not
           count them as a nesting level */
        depth += sel.startsWith('@') && /@(media|supports|layer|container)/.test(sel) ? 0 : 1;
      } else depth++;
      buf = '';
      i++;
      continue;
    }
    if (ch === '}') { depth = Math.max(0, depth - 1); buf = ''; i++; continue; }
    buf += ch;
    i++;
  }
  return found;
}

async function collectCss() {
  const dir = src('styles');
  const files = (await readdir(dir)).filter(f => f.endsWith('.css')).sort();
  const owners = new Map();
  const parts = [];
  for (const f of files) {
    const css = await readFile(path.join(dir, f), 'utf8');
    parts.push('/* ===== ' + f + ' ===== */\n' + css);
    for (const cls of topLevelClasses(css)) {
      if (SHARED.has(cls)) continue;
      if (owners.has(cls) && owners.get(cls) !== f) {
        throw new Error(
          'CSS class collision: ".' + cls + '" is introduced at the top level of both ' +
          owners.get(cls) + ' and ' + f + '.\n' +
          'Two production bugs came from exactly this. Rename one, or add it to SHARED ' +
          'in build.mjs if it is genuinely a shared utility.'
        );
      }
      owners.set(cls, f);
    }
  }
  return { css: parts.join('\n\n'), classCount: owners.size, fileCount: files.length };
}

function minifyCss(css) {
  return css
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\s*\n\s*/g, '\n')
    .replace(/\n{2,}/g, '\n')
    .replace(/\s*([{}:;,>])\s*/g, '$1')
    .replace(/;}/g, '}')
    .trim();
}

const HEAD = ({ css, js, html, sprite }) => `<!DOCTYPE html>
<html lang="en-GB" data-theme="periwinkle">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#0B1020">
<meta name="description" content="Slippery reads your bet slips and tracks your real profit and loss. Capture a bet when you place it, not when it wins.">
<meta name="color-scheme" content="dark">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="Slippery">
<meta name="format-detection" content="telephone=no">
<title>Slippery, bet slip tracker</title>
<link rel="manifest" href="/manifest.webmanifest">
<link rel="icon" href="/icon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/icon-180.png">
<link rel="preload" href="/fonts/schibsted-grotesk.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/fonts/spline-sans-mono.woff2" as="font" type="font/woff2" crossorigin>
<meta property="og:title" content="Slippery, bet slip tracker">
<meta property="og:description" content="Send a slip when you place it. Slippery reads it, tracks it, and settles it into your profit and loss.">
<meta property="og:type" content="website">
<meta property="og:image" content="/og.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="Slippery. Don't let your profit slip.">
<meta name="twitter:card" content="summary_large_image">
<style>${css}</style>
</head>
<body>
${sprite}
${html}
<script>${js}</script>
</body>
</html>
`;

const MANIFEST = {
  name: 'Slippery, bet slip tracker',
  short_name: 'Slippery',
  description: 'Send a slip when you place it. Slippery reads it, tracks it, and settles it.',
  start_url: '/',
  scope: '/',
  display: 'standalone',
  orientation: 'portrait',
  background_color: '#0B1020',
  theme_color: '#0B1020',
  categories: ['finance', 'utilities'],
  icons: [
    { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
    { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
    { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    { src: '/icon-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
  ]
};

/* Cache the shell so the app opens offline. Never cache /api. */
const SW = `const CACHE='slippery-v__BUILD__';
const SHELL=['/','/index.html','/manifest.webmanifest','/icon.svg',
  '/fonts/fraunces.woff2','/fonts/schibsted-grotesk.woff2','/fonts/spline-sans-mono.woff2'];
self.addEventListener('install',e=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',e=>{
  e.waitUntil(caches.keys().then(ks=>Promise.all(
    ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch',e=>{
  const u=new URL(e.request.url);
  if(e.request.method!=='GET'||u.pathname.startsWith('/api/'))return;
  if(u.origin!==location.origin)return;
  e.respondWith(
    fetch(e.request).then(r=>{
      const copy=r.clone();
      caches.open(CACHE).then(c=>c.put(e.request,copy)).catch(()=>{});
      return r;
    }).catch(()=>caches.match(e.request).then(r=>r||caches.match('/index.html')))
  );
});
`;

const ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
<stop offset="0" stop-color="#5D76CB"/><stop offset="1" stop-color="#7DD3FC"/></linearGradient></defs>
<rect width="512" height="512" rx="112" fill="#0B1020"/>
<rect x="56" y="56" width="400" height="400" rx="84" fill="url(#g)"/>
<path d="M170 300c0 34 30 56 78 56s84-20 84-58c0-38-32-50-78-60-38-8-58-16-58-38 0-24 24-40 60-40 34 0 58 16 62 42"
 fill="none" stroke="#0B1020" stroke-width="34" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

async function main() {
  const started = Date.now();
  await mkdir(out(''), { recursive: true });

  const { css, classCount, fileCount } = await collectCss();
  const html = await readFile(src('app.html'), 'utf8');
  /* The sprite has to be a real, rendered element — `display:none` on an
     SVG stops Safari resolving <use> into it. Hence the 0x0 clip instead. */
  const sprite = (await readFile(src('icons.svg'), 'utf8'))
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\n\s*/g, '')
    .replace('class="sprite"', 'style="position:absolute;width:0;height:0;overflow:hidden"')
    .trim();

  const bundle = await esbuild({
    entryPoints: [src('js/main.js')],
    bundle: true,
    format: 'iife',
    target: ['safari15', 'chrome100', 'firefox100'],
    minify: true,
    write: false,
    legalComments: 'none'
  });
  const js = bundle.outputFiles[0].text;

  const buildId = Date.now().toString(36);
  const page = HEAD({ css: minifyCss(css), js, html, sprite });

  await writeFile(out('index.html'), page);
  await writeFile(out('manifest.webmanifest'), JSON.stringify(MANIFEST, null, 2));
  await writeFile(out('sw.js'), SW.replace('__BUILD__', buildId));
  await writeFile(out('icon.svg'), ICON_SVG);

  const kb = n => (n / 1024).toFixed(1) + 'kB';
  console.log('  css     ' + kb(css.length) + ' from ' + fileCount + ' files, ' + classCount + ' owned classes');
  console.log('  js      ' + kb(js.length) + ' bundled and minified');
  console.log('  html    ' + kb(page.length) + ' total, self-contained');
  console.log('  built   public/index.html in ' + (Date.now() - started) + 'ms');

  if (!existsSync(out('icon-192.png'))) {
    console.log('  note    PNG icons missing — run: node tools/icons.mjs');
  }
}

main().catch(err => {
  console.error('\nBUILD FAILED\n' + err.message + '\n');
  process.exit(1);
});
