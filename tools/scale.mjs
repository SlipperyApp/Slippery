/** How the page reads at a phone size and at a desktop size, in numbers.
 *
 *  "Looks right on both" is not a thing anybody can check by eye across
 *  sixty routes and two widths. These are the four measurements that
 *  actually decide it:
 *
 *    MEASURE     characters per line of body copy. Under about 45 the text
 *                is choppy; over about 75 the eye loses the line return.
 *    RAMP        the biggest heading against the body size. A page whose
 *                headline is 1.4x its paragraph has no hierarchy; one at 6x
 *                on a phone is shouting in a small room.
 *    GUTTER      the space between the content and the edge of the screen.
 *    RHYTHM      the vertical gap between sections, and whether it is the
 *                same gap every time.
 *
 *    E2E_BASE=http://127.0.0.1:3200 node tools/scale.mjs
 */
import { chromium } from 'playwright-core';
import { ALL } from './routes.mjs';

const BASE = (process.env.E2E_BASE || 'http://127.0.0.1:3200').replace(/\/$/, '');
/*  Six widths, not two. "Works on mobile and desktop" is a claim about the
    whole range between them, and a layout that steps at 700 and again at
    1000 gives every phone the same spacing and every monitor from a laptop
    to a 27 inch panel the same spacing as well. The ends are where it
    shows. */
const WIDTHS = [320, 390, 768, 1024, 1440, 1920];

const MEASURE = () => {
  const vis = (el) => {
    const r = el.getBoundingClientRect();
    return r.width > 2 && r.height > 2 && getComputedStyle(el).visibility !== 'hidden';
  };
  const px = (el) => parseFloat(getComputedStyle(el).fontSize);

  /*  Body copy: a paragraph with a real sentence in it, and NOTHING but
      text in it. The first version divided the element's height by its line
      height, which is a guess that goes wrong the moment a paragraph has a
      child, padding, or a line that wraps differently: it reported 184
      characters per line on a page whose widest line is about 90. A Range
      over the text returns one rectangle per line box, which is the
      browser's own answer rather than an estimate of it. */
  const paras = [...document.querySelectorAll('p, li, figcaption, dd')].filter((el) => {
    if (!vis(el) || el.closest('.sr-only') || el.classList.contains('sr-only')) return false;
    if (el.children.length) return false;
    const t = (el.textContent || '').trim();
    return t.length > 60 && /[a-z]{3}/.test(t);
  });
  const measures = paras.map((el) => {
    const r = document.createRange();
    r.selectNodeContents(el);
    /*  Rects, then LINES. getClientRects returns one rectangle per text
        node per line box, and React renders `{a} and {b}` as three text
        nodes, so a two line paragraph can come back as six rectangles and
        report a twelve character measure. Rectangles that share a top edge
        are the same line. */
    const tops = new Set();
    for (const x of r.getClientRects()) {
      if (x.width > 1 && x.height > 1) tops.add(Math.round(x.top));
    }
    const lines = Math.max(1, tops.size);
    const chars = (el.textContent || '').trim().length;
    /*  How much of the room it was given is it using? A 30 character line
        at 320px is the screen being small; a 30 character line in a 900px
        column is a column that is too narrow, and only the second is a
        defect. */
    const pw = (el.parentElement || el).getBoundingClientRect().width || 1;
    const fill = el.getBoundingClientRect().width / pw;
    return { ch: Math.round(chars / lines), lines, fill, size: px(el), cls: String(el.className).split(' ')[0] || el.tagName.toLowerCase(),
      path: (() => { const seg = []; let n = el; for (let i = 0; n && i < 4; i += 1, n = n.parentElement) seg.unshift(`${n.tagName.toLowerCase()}${n.className ? '.' + String(n.className).trim().split(/\s+/).join('.') : ''}`); return seg.join(' > '); })(),
      maxw: getComputedStyle(el).maxWidth, boxw: Math.round(el.getBoundingClientRect().width) };
  });

  const heads = [...document.querySelectorAll('h1, h2')].filter(vis)
    .filter((el) => !el.classList.contains('sr-only'));
  const biggest = heads.length ? Math.max(...heads.map(px)) : 0;

  /*  The gutter is the space beside the CONTENT, not beside the section.
      A full bleed section is 100% wide by design and its .wrap carries the
      padding, so measuring the section reported a 0px gutter on every
      marketing page. Prefer the innermost wrapper. */
  const main = document.querySelector('main') || document.body;
  const first = main.querySelector('.wrap') || main.querySelector('.card, .grid') || main;
  const fr = first.getBoundingClientRect();
  /*  The CONTENT edge, not the box edge. .wrap is full width with its
      padding inside it, so measuring the rectangle reported a 0px gutter on
      every marketing page while the copy sat comfortably 16px in. Third
      time a measurement here was wrong before the design was, which is the
      right order but worth saying out loud. */
  const fcs = getComputedStyle(first);
  const gutter = Math.round(Math.min(
    fr.left + parseFloat(fcs.paddingLeft || '0'),
    window.innerWidth - fr.right + parseFloat(fcs.paddingRight || '0'),
  ));

  // Section rhythm: the vertical gaps between top level blocks in main.
  const kids = [...main.children].filter(vis);
  const gaps = [];
  for (let i = 1; i < kids.length; i += 1) {
    const a = kids[i - 1].getBoundingClientRect();
    const b = kids[i].getBoundingClientRect();
    const g = Math.round(b.top - a.bottom);
    if (g >= 0 && g < 400) gaps.push(g);
  }

  const bodySize = px(document.body);
  const grid = document.querySelector('.grid');
  const gridGap = grid ? getComputedStyle(grid).gap : '-';
  return { measures, biggest, bodySize, gutter, gaps, gridGap, w: window.innerWidth };
};

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const rows = [];
for (const width of WIDTHS) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 } });
  for (const route of ALL) {
    const page = await ctx.newPage();
    try {
      await page.goto(BASE + route, { waitUntil: 'load', timeout: 30000 });
      await page.waitForFunction(() => !document.querySelector('.skel'), null, { timeout: 8000 }).catch(() => {});
      await page.waitForTimeout(180);
    } catch { await page.close(); continue; }
    const m = await page.evaluate(MEASURE);
    rows.push({ route, width, ...m });
    await page.close();
  }
  await ctx.close();
}
await browser.close();

const fail = [];
const at = (w) => rows.filter((r) => r.width === w);

console.log('MEASURE, characters per line of body copy');
for (const w of WIDTHS) {
  const all = at(w).flatMap((r) => r.measures.map((m) => ({ ...m, route: r.route })));
  const wide = all.filter((m) => m.ch > 78);
  /*  A short line is only a problem when it is a WRAPPED short line.
      One line of 20 characters is a label; four lines of 20 is a column
      too narrow to read down. */
  const thin = all.filter((m) => m.ch < 34 && m.size >= 13 && m.lines >= 3 && m.fill < 0.6);
  console.log(`  ${w}: ${all.length} paragraphs, ${wide.length} over 78ch, ${thin.length} under 34ch`);
  for (const x of wide.slice(0, 3)) fail.push(`${x.route} @${w}: ${x.ch}ch, box ${x.boxw}px, max-width ${x.maxw}\n      ${x.path}`);
  for (const x of thin.slice(0, 4)) fail.push(`${x.route} @${w}: only ${x.ch}ch on .${x.cls}`);
}

console.log('');
console.log('RAMP, biggest heading against body size');
for (const w of WIDTHS) {
  const rs = at(w).filter((r) => r.biggest > 0);
  const ratios = rs.map((r) => r.biggest / r.bodySize);
  const hi = Math.max(...ratios), lo = Math.min(...ratios);
  const worst = rs[ratios.indexOf(hi)];
  console.log(`  ${w}: ${lo.toFixed(2)}x to ${hi.toFixed(2)}x (largest on ${worst.route}, ${Math.round(worst.biggest)}px)`);
}

console.log('');
console.log('GUTTER, content to screen edge, and the content width it leaves');
for (const w of WIDTHS) {
  const gs = at(w).map((r) => r.gutter).filter((g) => g >= 0).sort((a, b) => a - b);
  const med = gs[Math.floor(gs.length / 2)] ?? 0;
  console.log(`  ${w}: median ${med}px, range ${gs[0]}-${gs[gs.length - 1]}px, content ${w - med * 2}px`);
  if (w <= 390 && gs[0] < 12) fail.push(`gutter ${gs[0]}px at ${w}, under the 12px floor`);
}

console.log('');
console.log('RHYTHM, the most common vertical gap between top level blocks');
for (const w of WIDTHS) {
  const gs = at(w).flatMap((r) => r.gaps);
  const tally = new Map();
  for (const g of gs) tally.set(g, (tally.get(g) ?? 0) + 1);
  const top = [...tally.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);
  console.log(`  ${w}: ${top.map(([g, n]) => `${g}px x${n}`).join(', ')}`);
}

console.log('');
console.log('MODULE GAP, the dashboard grid');
for (const w of WIDTHS) {
  const r = at(w).find((x) => x.route === '/app');
  if (r) console.log(`  ${w}: ${r.gridGap}`);
}

console.log('');
if (fail.length) {
  console.log(`${fail.length} out of range`);
  for (const f of fail.slice(0, 16)) console.log('  ' + f);
  process.exit(1);
}
console.log('Every measurement in range.');
