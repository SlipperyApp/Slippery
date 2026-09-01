import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { THEMES, THEME_NAMES, DEFAULT_THEME } from '@/lib/themes';

const CSS = readFileSync(new URL('../app/styles/tokens.css', import.meta.url), 'utf8');

const PROFIT = '#86EFAC';
const LOSS = '#FCA5A5';

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

test('there are eight themes and the default is carbon', () => {
  assert.equal(THEMES.length, 8);
  assert.equal(DEFAULT_THEME, 'carbon');
  assert.deepEqual(THEME_NAMES, ['carbon', 'periwinkle', 'ink', 'graphite', 'slate', 'bronze', 'cinnabar', 'liquid']);
});

test('the two result colours are declared once, outside every theme block', () => {
  const posMatches = CSS.match(/--pos:\s*#86EFAC/gi) ?? [];
  const negMatches = CSS.match(/--neg:\s*#FCA5A5/gi) ?? [];
  assert.equal(posMatches.length, 1, 'profit green must be defined exactly once');
  assert.equal(negMatches.length, 1, 'loss red must be defined exactly once');
});

test('no theme block redefines the result colours', () => {
  for (const t of THEME_NAMES) {
    const block = new RegExp(`\\[data-theme='${t}'\\][\\s\\S]*?\\}`, 'i').exec(CSS)?.[0] ?? '';
    assert.ok(!/--pos:|--neg:/.test(block), `${t} must not redefine --pos or --neg`);
  }
});

test('no theme accent sits near profit green or loss red', () => {
  // This is why there is no green theme and no red theme. A near-neutral
  // accent is exempt: it cannot be mistaken for a result colour.
  const p = hsl(PROFIT); const n = hsl(LOSS);
  for (const t of THEMES) {
    const accent = t.swatch[2];
    const a = hsl(accent);
    if (a.s <= 0.25) continue;
    assert.ok(hueGap(a.h, p.h) >= 40, `${t.name} accent ${accent} is ${hueGap(a.h, p.h).toFixed(0)} degrees from profit green`);
    assert.ok(hueGap(a.h, n.h) >= 35, `${t.name} accent ${accent} is ${hueGap(a.h, n.h).toFixed(0)} degrees from loss red`);
  }
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
    .replace(/--pos:\s*#86EFAC;/i, '')
    .replace(/--neg:\s*#FCA5A5;/i, '');
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
    const want = [p.bg, p.surface, p.accent, p.line];
    const got = t.swatch.map((c) => c.toUpperCase());
    for (let i = 0; i < 4; i++) {
      const token = ['--bg', '--surface', '--accent', '--line'][i];
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
