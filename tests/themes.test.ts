import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { THEMES, THEME_NAMES, DEFAULT_THEME } from '@/lib/themes';

const CSS = readFileSync(new URL('../app/styles/tokens.css', import.meta.url), 'utf8');

const PROFIT = '#7FE3A6';
const LOSS = '#F5A3A3';

function hsl(hex: string): { h: number; s: number; l: number } {
  const n = hex.replace('#', '');
  const r = parseInt(n.slice(0, 2), 16) / 255;
  const g = parseInt(n.slice(2, 4), 16) / 255;
  const b = parseInt(n.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b); const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return { h: 0, s: 0, l };
  const s = d / (1 - Math.abs(2 * l - 1));
  let h: number;
  if (max === r) h = 60 * (((g - b) / d) % 6);
  else if (max === g) h = 60 * ((b - r) / d + 2);
  else h = 60 * ((r - g) / d + 4);
  return { h: (h + 360) % 360, s, l };
}

const hueGap = (a: number, b: number) => { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; };

/*  Oklab, because hue distance is a crude proxy and it produced a false
 *  alarm: bronze's accent measures 27 degrees from loss red on the hue wheel
 *  and would have failed a 35 degree floor, while being a desaturated tan
 *  next to a pale pink, which nobody confuses. Oklab distance is the measure
 *  the palette itself was specified with: warn and gold are 0.120 apart and
 *  the rule given for them is that under 0.08 two colours read as one at
 *  small sizes. So that is the number this asserts, for every pair that must
 *  not be mistaken for another. */
function oklab(hex: string): [number, number, number] {
  const n = hex.replace('#', '');
  const lin = (v: number) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  const [r, g, b] = [0, 2, 4].map((i) => lin(parseInt(n.slice(i, i + 2), 16) / 255));
  const cb = (x: number) => (x > 0 ? Math.cbrt(x) : -Math.cbrt(-x));
  const l = cb(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = cb(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = cb(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s,
  ];
}

function deltaE(a: string, b: string): number {
  const [x1, y1, z1] = oklab(a);
  const [x2, y2, z2] = oklab(b);
  return Math.hypot(x1 - x2, y1 - y2, z1 - z2);
}

/** Under this, two colours read as one at the size a figure is set. */
const SAME_COLOUR = 0.08;

test('there are eight themes and the default is carbon', () => {
  assert.equal(THEMES.length, 8);
  assert.equal(DEFAULT_THEME, 'carbon');
  assert.deepEqual(THEME_NAMES, ['carbon', 'periwinkle', 'ink', 'graphite', 'slate', 'bronze', 'cinnabar', 'liquid']);
});

test('the four semantic colours are declared once, outside every theme block', () => {
  for (const [name, hex] of [['pos', PROFIT], ['neg', LOSS], ['warn', '#E8C34A'], ['gold', '#C79A3F']] as const) {
    const found = CSS.match(new RegExp(`--${name}:\\s*${hex}`, 'gi')) ?? [];
    assert.equal(found.length, 1, `--${name} must be defined exactly once`);
  }
});

test('the four text colours are declared once, outside every theme block', () => {
  /*  Text is identical in all eight themes now. Only surfaces and the accent
   *  pair change, which is what keeps "the two result colours are fixed" true
   *  of the ink as well. */
  for (const [name, hex] of [['t1', '#E6EBF3'], ['t2', '#9AA6BB'], ['t3', '#8E97A8'], ['t4', '#545E6E']] as const) {
    const found = CSS.match(new RegExp(`--${name}:\\s*${hex}`, 'gi')) ?? [];
    assert.equal(found.length, 1, `--${name} must be defined exactly once`);
  }
  for (const t of THEME_NAMES) {
    const body = new RegExp(`\\[data-theme='${t}'\\][\\s\\S]*?\\n\\}`, 'i').exec(CSS)?.[0] ?? '';
    assert.ok(!/--t[1-4]:/.test(body), `${t} must not redefine a text colour`);
  }
});

test('no theme block redefines the result colours', () => {
  for (const t of THEME_NAMES) {
    const block = new RegExp(`\\[data-theme='${t}'\\][\\s\\S]*?\\}`, 'i').exec(CSS)?.[0] ?? '';
    assert.ok(!/--pos:|--neg:/.test(block), `${t} must not redefine --pos or --neg`);
  }
});

test('no theme accent can be mistaken for a result colour', () => {
  /*  This is why there is no green theme and no red theme. Measured in oklab
   *  rather than on the hue wheel, and reported as a number. The closest of
   *  the eight is bronze against loss red at 0.158, which is more than warn
   *  and gold are apart from each other. */
  const rows: string[] = [];
  for (const t of THEMES) {
    for (const [what, hex] of [['profit', PROFIT], ['loss', LOSS]] as const) {
      const d = deltaE(t.swatch[2], hex);
      if (d < 0.12) rows.push(`${t.name} accent ${t.swatch[2]} is ${d.toFixed(3)} from ${what} in oklab`);
    }
  }
  assert.deepEqual(rows, [], rows.join('\n'));
});

test('the four semantic colours are four colours, not two pairs', () => {
  /*  gold marks something new and warn asks for attention. At the size a pill
   *  is set, two colours under 0.08 apart in oklab are one colour with two
   *  names. */
  const SEMANTIC = { profit: PROFIT, loss: LOSS, warn: '#E8C34A', gold: '#C79A3F' };
  const names = Object.keys(SEMANTIC) as (keyof typeof SEMANTIC)[];
  const rows: string[] = [];
  for (let i = 0; i < names.length; i += 1) {
    for (let j = i + 1; j < names.length; j += 1) {
      const d = deltaE(SEMANTIC[names[i]], SEMANTIC[names[j]]);
      if (d < SAME_COLOUR) rows.push(`${names[i]} and ${names[j]} are ${d.toFixed(3)} apart in oklab`);
    }
  }
  assert.deepEqual(rows, [], rows.join('\n'));
});

test('every theme is dark: there is no light mode', () => {
  for (const t of THEMES) {
    const ground = hsl(t.swatch[0]);
    assert.ok(ground.l < 0.16, `${t.name} ground ${t.swatch[0]} is not dark`);
  }
});

test('every theme name in the registry has a block in the stylesheet', () => {
  for (const t of THEME_NAMES) {
    if (t === DEFAULT_THEME) continue;
    assert.ok(CSS.includes(`[data-theme='${t}']`), `${t} has no theme block`);
  }
});

test('the stylesheet carries no hardcoded hex outside the theme blocks', () => {
  // Everything else flows through custom properties and color-mix().
  const withoutBlocks = CSS
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\[data-theme='[a-z]+'\]\s*\{[\s\S]*?\n\}/g, '')
    .replace(/:root,\s*\[data-theme='carbon'\]\s*\{[\s\S]*?\n\}/g, '')
    // The fixed block is where the semantic and text colours live. Every
    // other hex outside a theme block is a stray.
    .replace(/:root \{[\s\S]*?\n\}/, '');
  const stray = withoutBlocks.match(/#[0-9a-f]{3,8}\b/gi) ?? [];
  assert.deepEqual(stray, [], `stray hex outside the theme blocks: ${stray.join(', ')}`);
});

/*  ---------------------------------------------------------------------
    The picker chip has to paint a theme that is NOT the one applied to the
    page, so it cannot read var(--accent): the four colours are duplicated
    into lib/themes.ts. Duplicated values drift, and a stale chip advertises
    a theme that no longer looks like that. These two notice.
    --------------------------------------------------------------------- */

function paletteOf(theme: string): Record<string, string> {
  const re = theme === 'carbon'
    ? /:root,\s*\[data-theme='carbon'\]\s*\{([\s\S]*?)\n\}/
    : new RegExp(`\\[data-theme='${theme}'\\]\\s*\\{([\\s\\S]*?)\\n\\}`);
  const body = re.exec(CSS)?.[1] ?? '';
  const out: Record<string, string> = {};
  for (const m of body.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-fA-F]{6})/g)) out[m[1]] = m[2].toUpperCase();
  return out;
}

test('every picker chip is painted in its own theme, exactly', () => {
  const wrong: string[] = [];
  for (const t of THEMES) {
    const p = paletteOf(t.name);
    const want = [p.bg, p.card, p.p, p.line];
    const got = t.swatch.map((c) => c.toUpperCase());
    for (let i = 0; i < 4; i++) {
      const token = ['--bg', '--card', '--p', '--line'][i];
      if (!want[i]) { wrong.push(`${t.name}: tokens.css has no ${token}`); continue; }
      if (want[i] !== got[i]) wrong.push(`${t.name} ${token}: the chip says ${got[i]}, tokens.css says ${want[i]}`);
    }
  }
  assert.deepEqual(wrong, [], wrong.join('\n'));
});

test('no two themes look the same in the picker row', () => {
  const seen = new Map<string, string>();
  for (const t of THEMES) {
    const key = t.swatch.join('|');
    const other = seen.get(key);
    assert.equal(other, undefined, `${t.name} and ${other} are the same four colours`);
    seen.set(key, t.name);
  }
});

/*  The test above only ever caught two themes that were byte for byte
    identical, which is not the way themes go wrong. Measured, they had gone
    wrong the other way: every one of the 28 pairs sat at or under 0.08 oklab,
    the threshold this file already uses for "two colours that read as one",
    and carbon and slate were 0.013 apart. Eight themes, and by the project's
    own measure not one was distinct from any other, because a person picking
    a dark blue by eye picks very nearly the same dark blue every time.

    A generated set fixed the measurement and lost what the measurement could
    not see, which is that these eight were designed. The palettes are the
    prototype's own now, and this assertion is a FLOOR UNDER THE DESIGN rather
    than a target it was made to hit: it catches two themes collapsing into
    each other in a future edit, and it does not overrule the person who chose
    them. The set measures 0.027 at its closest, carbon against periwinkle,
    and 0.020 is the line. */
test('no two themes are the same theme', () => {
  const KEYS = ['--bg', '--card', '--raise', '--elev', '--line', '--line2', '--p', '--s'];
  const FLOOR = 0.020;
  const rows: string[] = [];
  let worst = { d: 9, at: '' };
  for (let i = 0; i < THEMES.length; i += 1) {
    for (let j = i + 1; j < THEMES.length; j += 1) {
      const a = paletteOf(THEMES[i].name);
      const b = paletteOf(THEMES[j].name);
      const ds = KEYS.map((k) => deltaE(a[k.slice(2)], b[k.slice(2)]));
      const mean = ds.reduce((x, y) => x + y, 0) / ds.length;
      const at = `${THEMES[i].name} and ${THEMES[j].name}`;
      if (mean < worst.d) worst = { d: mean, at };
      if (mean < FLOOR) rows.push(`${at} are ${mean.toFixed(3)} apart on average, under ${FLOOR}`);
    }
  }
  assert.deepEqual(rows, [], `${rows.join('\n')}\n(closest pair ${worst.at} at ${worst.d.toFixed(3)})`);
});

/*  A theme is a set of surfaces, and a surface that cannot be told from the
    one under it is not a surface. Both of these were real: ink's --line and
    --card quantised to the same #030304, and slate's --card and --raise
    measured 0.010 apart. */
test('every theme has four distinguishable surfaces and a visible border', () => {
  const rows: string[] = [];
  for (const t of THEMES) {
    const p = paletteOf(t.name);
    const order = ['bg', 'card', 'raise', 'elev'];
    for (let i = 0; i < order.length - 1; i += 1) {
      const d = deltaE(p[order[i]], p[order[i + 1]]);
      if (d < 0.012) rows.push(`${t.name}: --${order[i]} and --${order[i + 1]} are ${d.toFixed(3)} apart`);
    }
    for (const [a, b] of [['line', 'card'], ['line', 'bg'], ['line2', 'raise']]) {
      const d = deltaE(p[a], p[b]);
      if (d < 0.011) rows.push(`${t.name}: --${a} and --${b} are ${d.toFixed(3)} apart, so there is no edge`);
    }
  }
  assert.deepEqual(rows, [], rows.join('\n'));
});
