/* Motion that earns its place, and cannot cost what this product cannot pay.
 *
 * The brief is specific and every line of it came from a real device
 * failure: transform and opacity only, decorative layers contained, at
 * most about three backdrop-filter elements, prefers-reduced-motion
 * honoured, and scrolling that stays smooth on a real iPhone.
 *
 * These check the rules a later edit is most likely to break, and one of
 * them is a bug that shipped during this very pass: a transform on every
 * direct child of the dashboard pane made each one a containing block and
 * put a pixel of horizontal scroll on the page at 320px. The audit caught
 * it in a real browser; this catches the shape of it in source.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';

const dir = new URL('../src/styles/', import.meta.url);
const read = f => readFile(new URL(f, dir), 'utf8');
const names = (await readdir(dir)).filter(n => n.endsWith('.css'));
const all = (await Promise.all(names.map(read))).join('\n');

test('nothing animates a property that costs layout', async () => {
  /* width, height, top, left, margin and padding all force layout and
     paint on every frame. The rule is in CLAUDE.md and it is locked. */
  const banned = /transition:[^;}]*\b(width|height|top|left|margin|padding)\b/g;
  const hits = [];
  for (const n of names) {
    const css = await read(n);
    for (const m of css.matchAll(banned)) {
      /* A transition on the tutorial's cut-out is the one exception and it
         is deliberate: it is a single empty element with nothing inside it
         to lay out, and the alternative is four scrim panels. */
      if (/tour-hole/.test(css.slice(Math.max(0, m.index - 400), m.index))) continue;
      hits.push(n + ': ' + m[0].slice(0, 70));
    }
  }
  assert.deepEqual(hits, [], 'these animate layout:\n  ' + hits.join('\n  '));
});

test('no animation starts from scale(0)', () => {
  /* Nothing in the real world appears from nothing. It reads as a glitch
     rather than an arrival. */
  assert.doesNotMatch(all, /from\{[^}]*scale\(0\)/);
  assert.doesNotMatch(all, /transform:\s*scale\(0\)\s*[;}]/);
});

test('ease-in is never used on an interface animation', () => {
  /* It starts slow, which delays the exact moment the user is watching
     most closely. There is no --ease-in token for this reason. */
  assert.doesNotMatch(all, /transition:[^;}]*\bease-in\b(?!-out)/);
  assert.doesNotMatch(all, /--ease-in:/);
});

test('every keyframe animation has a reduced-motion answer', () => {
  /* The global switch in 02-base.css collapses durations to 1ms, which
     handles most of it. What it does not handle is a delay: a 280ms delay
     in front of a 1ms animation is an element that appears late for no
     reason, so anything staggered names itself explicitly. */
  const base = all.slice(all.indexOf('@media (prefers-reduced-motion:reduce)'));
  assert.match(base, /animation-duration:1ms!important/);
  for (const staggered of ['.pane.on > *', '.irow']) {
    assert.ok(all.includes(staggered + '{animation:none!important;animation-delay:0ms!important}'),
      staggered + ' staggers without cancelling its delay under reduced motion');
  }
});

test('the backdrop-filter budget is not spent on decoration', async () => {
  /* Roughly three is the iPhone limit before scrolling stutters. A
     previous build had 79. */
  const uses = (all.match(/backdrop-filter:/g) || []).length;
  /* Each one ships prefixed and standard, so the count is doubled. */
  assert.ok(uses <= 10, 'backdrop-filter used ' + uses + ' times, which is past the budget');
  /* And the new surfaces added in this pass use none of it. */
  const flows = await read('08-flows.css');
  const bot = flows.slice(flows.indexOf('.botsheet{'), flows.indexOf('.botwait{'));
  assert.doesNotMatch(bot, /backdrop-filter/);
});

test('the tutorial scrim is one element, not four panels', async () => {
  const flows = await read('08-flows.css');
  const tour = flows.slice(flows.indexOf('.tour{'), flows.indexOf('@keyframes tourin'));
  assert.match(tour, /box-shadow:0 0 0 9999px/);
  /* And it does not take the tap it is asking for. */
  assert.match(tour, /pointer-events:none/);
});

test('the count-up refuses to run when it would be noise', async () => {
  const motion = await readFile(new URL('../src/js/motion.js', import.meta.url), 'utf8');
  const fn = motion.slice(motion.indexOf('export function countTo'));
  const body = fn.slice(0, fn.indexOf('\n}\n'));
  /* Reduced motion, no previous value, and changes under a pound: three
     cases where counting is a twitch rather than information. */
  assert.match(body, /RM \|\| from == null \|\| Math\.abs\(pence - from\) < 100/);
  /* The last frame writes the formatter's exact string rather than a
     reconstruction of it, or the figure settles on the wrong pence. */
  assert.match(body, /if \(t >= 1\) \{ el\.innerHTML = text; return; \}/);
});

test('scroll work stays inside the one rAF-batched listener', async () => {
  const js = await readdir(new URL('../src/js/', import.meta.url));
  const sources = await Promise.all(js.filter(n => n.endsWith('.js'))
    .map(n => readFile(new URL('../src/js/' + n, import.meta.url), 'utf8')));
  const listeners = sources.join('\n').match(/addEventListener\('scroll'/g) || [];
  /* motion.js owns two: the parallax and the header shadow, both batched.
     Reading layout inside a third is how a compositor animation ends up
     back on the main thread. */
  assert.ok(listeners.length <= 2,
    'found ' + listeners.length + " scroll listeners; motion.js owns them");
});
