import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { MARK_GRID, MARK_ALPHA, MARK_POS, MARK_NEG, MARK_GROUND } from '@/lib/brand';

/*  Three surfaces draw the mark and only one of them can load the file.
 *
 *  Everywhere the browser renders HTML it is public/icon.svg. /api/share and
 *  /og go through Satori, which draws no external file, so both rebuild the
 *  mark out of divs from lib/brand.ts. Nothing stops those two from drifting
 *  away from the icon except this: the icon is parsed and compared.
 *
 *  They had drifted. The share card drew a five by five pattern nobody had
 *  checked, and /og drew three rounded squares in a row, which is not the
 *  mark at all. */

function gridFromIcon(): { grid: string[]; alpha: number[][] } {
  const svg = readFileSync('public/icon.svg', 'utf8');
  const rects = [...svg.matchAll(
    /<rect x="([\d.]+)" y="([\d.]+)"[^>]*fill="(#[0-9A-Fa-f]{6})" opacity="([\d.]+)"/g,
  )];
  const xs = [...new Set(rects.map((r) => Number(r[1])))].sort((a, b) => a - b);
  const ys = [...new Set(rects.map((r) => Number(r[2])))].sort((a, b) => a - b);
  const grid = ys.map(() => new Array<string>(xs.length).fill(' '));
  const alpha = ys.map(() => new Array<number>(xs.length).fill(1));
  for (const [, x, y, fill, op] of rects) {
    const c = xs.indexOf(Number(x));
    const r = ys.indexOf(Number(y));
    const hex = fill.toUpperCase();
    grid[r][c] = hex === MARK_POS.toUpperCase() ? 'p' : hex === MARK_NEG.toUpperCase() ? 'n' : ' ';
    alpha[r][c] = Number(op);
  }
  return { grid: grid.map((r) => r.join('')), alpha };
}

test('the generated images draw the mark the icon file actually contains', () => {
  const { grid, alpha } = gridFromIcon();
  assert.deepEqual(grid, [...MARK_GRID], 'lib/brand.ts and public/icon.svg disagree');
  assert.deepEqual(alpha, MARK_ALPHA.map((r) => [...r]));
});

test('the mark uses its own colours, never the two locked result colours', () => {
  /*  #86EFAC and #FCA5A5 mean profit and loss and nothing else. A logo drawn
   *  in them would be a fourth meaning on two colours that the whole product
   *  keeps down to one each. The icon uses a softer pair on purpose. */
  assert.notEqual(MARK_POS.toUpperCase(), '#86EFAC');
  assert.notEqual(MARK_NEG.toUpperCase(), '#FCA5A5');
  for (const c of [MARK_POS, MARK_NEG, MARK_GROUND]) {
    assert.match(c, /^#[0-9A-F]{6}$/i);
    assert.ok(readFileSync('public/icon.svg', 'utf8').includes(c), `${c} is not in the icon`);
  }
});
