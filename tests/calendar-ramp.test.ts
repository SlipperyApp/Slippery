import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { THEME_NAMES } from '@/lib/themes';
import { rampStep, RAMP } from '@/lib/calendar-ramp';

/** The calendar ramp, measured rather than argued about.
 *
 *  Fill opacity tracks the size of a day. As it rises, the result colour on it
 *  gets LESS legible before the page ground becomes legible, and there is a
 *  dead band in the middle where neither ink clears 4.5:1. The natural
 *  implementation, one threshold on alpha, lands inside it. The ramp is
 *  therefore two bands that skip the hole, and these tests measure every step
 *  of both, in all eight themes, for a profit and for a loss, for the figure
 *  AND for the date.
 *
 *  Test four proves the dead band is real: if it ever starts passing, the
 *  palette has changed and the two bands can be revisited deliberately rather
 *  than by accident. */

const CSS = readFileSync(new URL('../app/styles/tokens.css', import.meta.url), 'utf8');

type RGB = [number, number, number];

function rgb(hex: string): RGB {
  const n = hex.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16)) as RGB;
}

/** color-mix(in srgb, a P%, b), and equally `a` at opacity P over `b`. */
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

/** :root carries the text and semantic colours; a theme block carries the
 *  surfaces. Both are needed to composite a cell. */
const ROOT: Record<string, RGB> = (() => {
  const body = /:root \{([\s\S]*?)\n\}/.exec(CSS)?.[1] ?? '';
  const out: Record<string, RGB> = {};
  for (const m of body.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-fA-F]{6})/g)) out[m[1]] = rgb(m[2]);
  return out;
})();

function palette(theme: string): Record<string, RGB> {
  const re = theme === 'carbon'
    ? /:root,\s*\[data-theme='carbon'\]\s*\{([\s\S]*?)\n\}/
    : new RegExp(`\\[data-theme='${theme}'\\]\\s*\\{([\\s\\S]*?)\\n\\}`);
  const body = re.exec(CSS)?.[1] ?? '';
  const out: Record<string, RGB> = { ...ROOT };
  for (const m of body.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-fA-F]{6})/g)) out[m[1]] = rgb(m[2]);
  return out;
}

/** One cell, exactly as the browser composites it: the result colour at the
 *  step's alpha, over --elev. */
function cell(t: Record<string, RGB>, positive: boolean, alpha: number): RGB {
  return mix(positive ? t.pos : t.neg, t.elev, alpha);
}

/** The two inks a cell hands out, which are always the same decision. */
function inks(t: Record<string, RGB>, positive: boolean, ink: 'result' | 'ground', ground: RGB) {
  return ink === 'result'
    ? { figure: positive ? t.pos : t.neg, date: t.t1 }
    : { figure: t.bg, date: mix(t.bg, ground, RAMP.DATE_ON_HIGH) };
}

test('the figure and the date both clear 4.5:1 at every step, in all eight themes', () => {
  const failures: string[] = [];
  let worst = { ratio: 99, where: '' };

  for (const theme of THEME_NAMES) {
    const t = palette(theme);
    for (const positive of [true, false]) {
      // Every magnitude from an empty day to the biggest day of the month.
      for (let mag = 0.001; mag <= 1.0001; mag += 0.01) {
        const step = rampStep(Math.round(mag * 10000), 10000);
        const ground = cell(t, positive, step.alpha);
        const { figure, date } = inks(t, positive, step.ink, ground);
        for (const [what, ink] of [['figure', figure], ['date', date]] as const) {
          const ratio = contrast(ink, ground);
          const where = `${theme} ${positive ? 'profit' : 'loss'} ${what} at mag ${mag.toFixed(2)} (${step.band}, alpha ${step.alpha.toFixed(3)})`;
          if (ratio < worst.ratio) worst = { ratio, where };
          if (ratio < 4.5) failures.push(`${where}: ${ratio.toFixed(2)}:1`);
        }
      }
    }
  }
  assert.deepEqual(failures.slice(0, 8), [], `worst was ${worst.ratio.toFixed(2)}:1 at ${worst.where}`);
  assert.ok(worst.ratio >= 4.5, `worst ${worst.ratio.toFixed(2)}:1 at ${worst.where}`);
});

test('the two bands skip the dead zone rather than crossing it', () => {
  /*  The gap between where the low band ends and the high band begins is not
   *  a style choice: it is the hole. Nothing may be drawn inside it. */
  const alphas = new Set<number>();
  for (let mag = 0; mag <= 1.0001; mag += 0.001) {
    const s = rampStep(Math.round(mag * 100000), 100000);
    if (s.alpha > 0) alphas.add(Number(s.alpha.toFixed(4)));
  }
  const inside = [...alphas].filter((a) => a > RAMP.LOW_TO + 1e-6 && a < RAMP.HIGH_FROM - 1e-6);
  assert.deepEqual(inside, [], `the ramp emits ${inside.length} alphas inside the dead zone`);
});

test('the figure and the date can never take different inks', () => {
  // One call decides both. This is the specific bug the shape prevents.
  for (let mag = 0; mag <= 1.0001; mag += 0.005) {
    const s = rampStep(Math.round(mag * 10000), 10000);
    assert.ok(s.ink === 'result' || s.ink === 'ground');
    assert.equal(s.ink === 'ground', s.band === 'high');
  }
});

test('the dead zone is real, which is why there are two bands', () => {
  /*  A single continuous ramp at the middle of the range, which is what
   *  anybody writes first. Neither ink clears 4.5:1 on it. If this ever
   *  starts passing, the palette changed. */
  const bad: string[] = [];
  for (const theme of THEME_NAMES) {
    const t = palette(theme);
    for (const positive of [true, false]) {
      const naive = cell(t, positive, 0.46);
      const result = contrast(positive ? t.pos : t.neg, naive);
      const ground = contrast(t.bg, naive);
      if (result >= 4.5 || ground >= 4.5) {
        bad.push(`${theme} ${positive ? 'profit' : 'loss'}: result ${result.toFixed(2)}, ground ${ground.toFixed(2)}`);
      }
    }
  }
  assert.deepEqual(bad, [], `a naive mid ramp now passes:\n${bad.join('\n')}`);
});

test('the floor keeps the smallest day visible, and the ceiling is a fill', () => {
  for (const theme of THEME_NAMES) {
    const t = palette(theme);
    for (const positive of [true, false]) {
      const faintest = cell(t, positive, RAMP.LOW_FROM);
      const strongest = cell(t, positive, RAMP.HIGH_TO);
      assert.ok(contrast(faintest, t.elev) > 1.02,
        `${theme}: the smallest day is invisible against an empty cell`);
      assert.ok(contrast(strongest, t.elev) > 1.5,
        `${theme}: a full strength cell is a whisper, not a fill`);
    }
  }
});
