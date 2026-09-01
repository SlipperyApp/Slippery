import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

/** Spacing comes from the scale, or it is not spacing.
 *
 *  A hardcoded margin in an inline style is invisible to every other part of
 *  the system: it does not change with the breakpoint, it does not match the
 *  card beside it, and nobody reviewing a diff can tell 14px from 16px. The
 *  scale exists so that two things a screen apart line up, and one literal is
 *  enough to break that on the one screen where it matters.
 *
 *  Small numbers are allowed, because optical alignment is real: nudging a
 *  glyph 2px to sit on a baseline is not a spacing decision. Anything from
 *  6px up should be a token. */

const ROOTS = ['components', 'app'];
const FLOOR = 6;

/*  Satori renders the share card and knows nothing about custom properties:
 *  there is no stylesheet in an ImageResponse, so literals are the only
 *  option there and are correct. */
const EXEMPT = [/app\/api\/share\//, /app\/og\//];

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.tsx$/.test(p)) out.push(p);
  }
  return out;
}

const PROPS = /\b(margin|marginTop|marginBottom|marginLeft|marginRight|marginBlock|marginInline|padding|paddingTop|paddingBottom|paddingLeft|paddingRight|paddingBlock|paddingInline|gap|rowGap|columnGap)\s*:\s*(?:'([^']*)'|(\d+))/g;

test('spacing in an inline style comes from the scale', () => {
  const bad: string[] = [];
  for (const f of ROOTS.flatMap((r) => walk(r))) {
    if (EXEMPT.some((re) => re.test(f))) continue;
    readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
      for (const m of line.matchAll(PROPS)) {
        const raw = m[2] ?? m[3];
        if (!raw) continue;
        // A token, a calc over tokens, auto, or zero: all fine.
        if (/var\(--s|var\(--tap|auto|^0$|^0px$/.test(raw)) continue;
        const px = [...raw.matchAll(/(\d+(?:\.\d+)?)px|^(\d+)$/g)]
          .map((n) => Number(n[1] ?? n[2]))
          .filter((n) => Number.isFinite(n));
        if (px.length && px.every((n) => n < FLOOR)) continue;   // optical nudge
        if (!px.length) continue;                                 // a keyword or a percentage
        bad.push(`${f}:${i + 1} ${m[1]}: ${raw}`);
      }
    });
  }
  assert.deepEqual(bad, [], `${bad.length} literal spacings:\n${bad.slice(0, 20).join('\n')}`);
});
