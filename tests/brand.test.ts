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
  for (const f of ['components/MarketingChrome.tsx', 'components/AppShell.tsx', 'app/(auth)/layout.tsx']) {
    const src = readFileSync(f, 'utf8');
    assert.ok(!/<img[^>]*icon\.svg/.test(src), `${f} loads the mark through an img`);
    assert.ok(src.includes('<Mark'), `${f} does not render the inline mark`);
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
