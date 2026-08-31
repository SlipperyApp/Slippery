import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { THEME_NAMES } from '@/lib/themes';

/** The calendar ramp, measured rather than argued about.
 *
 *  Laying the semantic colour over the cell at an opacity that tracks the size
 *  of the day sweeps the cell through mid luminance, where nothing is
 *  readable. The fill therefore varies CHROMA rather than lightness: the
 *  semantic colour is mixed 45% into --bg, and that dark saturated anchor is
 *  what fades in.
 *
 *  Test three keeps the naive version from coming back. Without it somebody
 *  simplifies the fill in six months and every cell in the middle of the
 *  range goes unreadable again. */

const CSS = readFileSync(new URL('../app/styles/tokens.css', import.meta.url), 'utf8');

const POS = '#86EFAC';
const NEG = '#FCA5A5';
/** The mix that keeps lightness almost still. Raising it drops --ink under
 *  4.5:1 at the top of the ramp. */
const ANCHOR_MIX = 0.45;
const FLOOR = 0.14;

type RGB = [number, number, number];

function rgb(hex: string): RGB {
  const n = hex.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16)) as RGB;
}

/** color-mix(in srgb, a P%, b) */
function mix(a: RGB, b: RGB, p: number): RGB {
  return [0, 1, 2].map((i) => a[i] * p + b[i] * (1 - p)) as RGB;
}

function luminance([r, g, b]: RGB) {
  const lin = (c: number) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function contrast(a: RGB, b: RGB) {
  const l1 = luminance(a);
  const l2 = luminance(b);
  const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
}

function palette(theme: string): Record<string, RGB> {
  const re = theme === 'carbon'
    ? /:root,\s*\[data-theme='carbon'\]\s*\{([\s\S]*?)\n\}/
    : new RegExp(`\\[data-theme='${theme}'\\]\\s*\\{([\\s\\S]*?)\\n\\}`);
  const body = re.exec(CSS)?.[1] ?? '';
  const out: Record<string, RGB> = {};
  for (const m of body.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-fA-F]{6})/g)) out[m[1]] = rgb(m[2]);
  return out;
}

/** The step of the ramp: the anchor, at alpha, over the unfilled cell. */
function cellAt(anchor: RGB, cell: RGB, alpha: number): RGB {
  return mix(anchor, cell, alpha);
}

test('one text colour is readable at every step of the ramp, in all eight themes', () => {
  const failures: string[] = [];
  let worst = { ratio: 99, where: '' };

  for (const theme of THEME_NAMES) {
    const t = palette(theme);
    const cell = t['surface-2'];
    for (const [name, hex] of [['pos', POS], ['neg', NEG]] as const) {
      const anchor = mix(rgb(hex), t.bg, ANCHOR_MIX);
      for (let a = FLOOR; a <= 1.0001; a += 0.02) {
        const filled = cellAt(anchor, cell, Math.min(1, a));
        const ratio = contrast(t.ink, filled);
        if (ratio < worst.ratio) worst = { ratio, where: `${theme} --cal-${name} at ${a.toFixed(2)}` };
        if (ratio < 4.5) failures.push(`${theme} --cal-${name} at alpha ${a.toFixed(2)}: --ink is ${ratio.toFixed(2)}:1`);
      }
    }
  }
  assert.deepEqual(failures.slice(0, 6), [], `worst was ${worst.ratio.toFixed(2)}:1 at ${worst.where}`);
  assert.ok(worst.ratio >= 4.5, `worst ${worst.ratio.toFixed(2)}:1 at ${worst.where}`);
});

test('a full strength cell is plainly a fill, not a whisper', () => {
  const failures: string[] = [];
  let weakest = { ratio: 99, where: '' };

  for (const theme of THEME_NAMES) {
    const t = palette(theme);
    const cell = t['surface-2'];
    for (const [name, hex] of [['pos', POS], ['neg', NEG]] as const) {
      const anchor = mix(rgb(hex), t.bg, ANCHOR_MIX);
      const ratio = contrast(anchor, cell);
      if (ratio < weakest.ratio) weakest = { ratio, where: `${theme} --cal-${name}` };
      if (ratio < 1.3) failures.push(`${theme} --cal-${name} against an empty cell is ${ratio.toFixed(2)}:1`);
    }
  }
  assert.deepEqual(failures, [], `weakest was ${weakest.ratio.toFixed(2)}:1 at ${weakest.where}`);
});

test('the naive ramp is still unreadable, which is why the chroma ramp exists', () => {
  // A plain blend of the semantic colour over the cell, at the middle of the
  // range. If this ever starts passing, the palette changed and the chroma
  // ramp can be revisited. Until then, it is the reason for all of the above.
  const t = palette('graphite');
  const naive = mix(rgb(POS), t['surface-2'], 0.42);
  const inkRatio = contrast(t.ink, naive);
  const bgRatio = contrast(t.bg, naive);

  assert.ok(
    inkRatio < 4.5 && bgRatio < 4.5,
    `the naive ramp now passes: --ink ${inkRatio.toFixed(2)}:1, --bg ${bgRatio.toFixed(2)}:1. `
    + 'The palette has changed, so the chroma ramp can be revisited deliberately.',
  );
});

test('the ramp floor keeps the smallest winning day visible', () => {
  for (const theme of THEME_NAMES) {
    const t = palette(theme);
    const anchor = mix(rgb(POS), t.bg, ANCHOR_MIX);
    const smallest = cellAt(anchor, t['surface-2'], FLOOR);
    const ratio = contrast(smallest, t['surface-2']);
    assert.ok(ratio > 1.0, `${theme}: the floor is invisible against an empty cell`);
  }
});
