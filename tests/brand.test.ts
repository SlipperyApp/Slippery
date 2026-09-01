import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { MARK_CLIP, MARK_PATH, MARK_TILE, MARK_INK, MARK_ACCENT } from '@/lib/brand';

/*  Three surfaces draw the mark and only one of them can load the file.
 *
 *  Everywhere the browser renders HTML it is inlined by components/Mark.tsx,
 *  which is why it takes the theme colour: through an <img src> a custom
 *  property never resolves and the mark renders the same shade in all eight
 *  themes. /api/share and /og go through Satori, which loads no external file
 *  either, so both draw the paths from lib/brand.ts.
 *
 *  Nothing stops those from drifting away from the icon except this: the icon
 *  is parsed and compared. They had drifted before, into two different
 *  approximations of a mark that no longer exists. */

const ICON = readFileSync('public/app-icon.svg', 'utf8');
const THEMED = readFileSync('components/Mark.tsx', 'utf8');

test('the generated images draw the paths the icon file actually contains', () => {
  assert.ok(ICON.includes(MARK_PATH), 'lib/brand.ts and public/app-icon.svg draw different outlines');
  assert.ok(ICON.includes(MARK_CLIP), 'the diagonal cut has drifted from the icon');
  for (const c of [MARK_TILE, MARK_INK, MARK_ACCENT]) {
    assert.ok(ICON.includes(c), `${c} is not a colour in the icon`);
  }
});

test('the in-app mark is the same outline, and takes the theme', () => {
  /*  The themed file draws the same glyph with fill="currentColor" and
   *  fill="var(--s, ...)" instead of two fixed colours. Same outline, or the
   *  app and its own share card are different logos. */
  assert.ok(THEMED.includes(MARK_PATH.slice(0, 120)), 'components/Mark.tsx draws a different outline');
  assert.ok(THEMED.includes('currentColor'), 'the mark does not follow the text colour');
  assert.ok(/var\(--s/.test(THEMED), 'the mark does not follow the accent');
  /*  #A8C2E8 appears once, as the fallback inside var(--s, ...), which is
   *  what a fallback is for. A bare fill of either colour is a baked in
   *  logo that ignores seven of the eight themes. */
  assert.ok(!/fill="#(E6EBF3|A8C2E8)"/.test(THEMED), 'the in-app mark has a colour baked into it');
  assert.equal((THEMED.match(/#A8C2E8/g) ?? []).length, 1, 'more than a single var() fallback');
});

test('the mark is drawn inline, never through an img or a background', () => {
  /*  The specific failure this prevents: through <img src="/icon.svg"> the
   *  custom properties do not resolve, and the mark renders uncoloured and
   *  identical in all eight themes. */
  /*  Every header goes through <Brand>, which is the one place a lockup size
   *  is chosen; the assertion follows that indirection rather than demanding
   *  <Mark> literally, which would only force the six call sites to inline
   *  the thing again. */
  for (const f of ['components/MarketingChrome.tsx', 'components/AppShell.tsx', 'app/(auth)/layout.tsx',
    'components/Brand.tsx', 'components/Mark.tsx', 'components/Wordmark.tsx']) {
    const src = readFileSync(f, 'utf8');
    assert.ok(!/<img[^>]*(icon|wordmark|lockup)\.svg/.test(src), `${f} loads the mark through an img`);
    assert.ok(!/background(-image)?:\s*url\([^)]*(icon|wordmark)/.test(src), `${f} loads the mark as a background`);
  }
  for (const f of ['components/MarketingChrome.tsx', 'components/AppShell.tsx', 'app/(auth)/layout.tsx']) {
    const src = readFileSync(f, 'utf8');
    assert.ok(/<(Brand|Mark)\b/.test(src), `${f} does not render the inline mark`);
  }
  assert.ok(readFileSync('components/Brand.tsx', 'utf8').includes('<Mark'), 'Brand does not render the inline mark');
});

/*  Both marks are drawn twice and the second copy is cut by a diagonal, and
 *  both cuts were broken at once in different ways. The mark's <g> carried
 *  clip-path="url(#__ID__)", a placeholder that was never substituted and
 *  named a clipPath that did not exist: an invalid reference does not clip
 *  in Chromium, it renders unclipped, so the accent copy covered the ink one
 *  and the whole S came out a flat accent blue. The wordmark's cut worked
 *  and was then thrown away by an inline style setting --s to currentColor,
 *  which painted both halves the same colour. */
test('the two tone cut survives in both marks', () => {
  for (const f of ['components/Mark.tsx', 'components/Wordmark.tsx']) {
    const whole = readFileSync(f, 'utf8');
    // Comments in these files DISCUSS url(#id) at length, because that is the
    // bug they exist to remember. Measure the code.
    const src = whole.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    assert.ok(!whole.includes('__ID__'), `${f} still has an unsubstituted id placeholder`);
    assert.ok(!/url\(#/.test(src), `${f} clips by id, which cannot be unique on a page with two marks`);
    assert.ok(/clip-path:\s*path\(/.test(src), `${f} has no diagonal cut`);
    assert.ok(/var\(--s[,)]/.test(src), `${f} does not take the theme accent for its cut half`);
    assert.ok(!/'--s'[^)]*:\s*'currentColor'/.test(src), `${f} forces its accent half to the ink colour`);
  }
});

test('the mark does not use the two locked result colours', () => {
  /*  #7FE3A6 and #F5A3A3 mean profit and loss and nothing else. A logo drawn
   *  in them would be a third meaning on two colours the product keeps to one
   *  each. */
  for (const c of [MARK_TILE, MARK_INK, MARK_ACCENT]) {
    assert.notEqual(c.toUpperCase(), '#7FE3A6');
    assert.notEqual(c.toUpperCase(), '#F5A3A3');
  }
});
