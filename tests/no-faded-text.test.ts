import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

/** Opacity on text is the most reliable way to ship an unreadable string.
 *
 *  It survives review because the colour in the stylesheet IS the right
 *  colour: the fault only exists in the composite, so reading the code tells
 *  you nothing and only a contrast tool on a running page can see it. Six
 *  places in this repo faded readable text between 0.35 and 0.6; axe measured
 *  the worst of them at 2.0:1 against a 4.5:1 requirement.
 *
 *  The replacement is `.pending`, which is --ink-2 and measures 7.9:1.
 *
 *  Fades on things that are NOT read are fine and are listed below: an SVG
 *  fill, a scrim, a decorative overlay. The stylesheets are covered by
 *  tests/contrast.test.ts; this is the JSX half, which is where all six of
 *  the real offences lived. */

const ROOTS = ['components', 'app'];
const ALLOW = [
  /aria-hidden/,                    // decoration, by declaration
  /fill=|stroke=|<path|<circle/,    // inside an svg
  /cal__fill|scrim|sheet__|grain|blob|wavefield/,
];

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(p)) out.push(p);
  }
  return out;
}

test('nothing that has to be read is faded with opacity', () => {
  const bad: string[] = [];
  for (const file of ROOTS.flatMap((r) => walk(r))) {
    const lines = readFileSync(file, 'utf8').split('\n');
    lines.forEach((line, i) => {
      const m = line.match(/opacity:\s*(?:['"])?(0?\.\d+)/);
      if (!m) return;
      if (ALLOW.some((re) => re.test(line))) return;
      bad.push(`${file}:${i + 1} opacity ${m[1]} — use .pending, or aria-hidden if it is decoration\n    ${line.trim().slice(0, 110)}`);
    });
  }
  assert.deepEqual(bad, [], bad.join('\n'));
});
