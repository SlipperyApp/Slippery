import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

/** The tells.
 *
 *  None of these is a bug. Every one of them is a thing that makes a page
 *  read as generated rather than written, and every one of them creeps back
 *  in one commit at a time unless something fails.
 *
 *  The em dash is the loudest of them. It is not wrong; it is that nobody
 *  types it, so a page full of them announces what wrote the page. The en
 *  dash stays: in a table cell it means "no value", which is a different job
 *  and the correct glyph for it. */

const ROOTS = ['components', 'app', 'lib'];

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(p)) out.push(p);
  }
  return out;
}

const FILES = ROOTS.flatMap((r) => walk(r));

test('no em dashes, anywhere', () => {
  const found: string[] = [];
  for (const f of FILES) {
    readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
      if (line.includes('—')) found.push(`${f}:${i + 1} ${line.trim().slice(0, 90)}`);
    });
  }
  assert.deepEqual(found, [], found.join('\n'));
});

/*  Words that promise rather than state. Every one of them can be replaced by
 *  saying the thing itself, and the replacement is always shorter. */
const BUZZ = [
  'seamless', 'seamlessly', 'effortless', 'effortlessly', 'leverage', 'leveraging',
  'unlock', 'unlocks', 'elevate', 'elevates', 'empower', 'empowers', 'empowering',
  'revolutionise', 'revolutionize', 'revolutionary', 'game.changing', 'cutting.edge',
  'state of the art', 'best.in.class', 'world.class', 'next.generation', 'robust',
  'delve', 'tapestry', 'testament to', 'in today.s', 'fast.paced world',
  'supercharge', 'turbocharge', 'harness the power', 'take it to the next level',
  'streamline', 'streamlined', 'synerg',
];

test('no buzzwords in anything a reader sees', () => {
  const found: string[] = [];
  const re = new RegExp(`\\b(${BUZZ.join('|')})`, 'i');
  for (const f of FILES) {
    readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
      // Comments are for whoever reads the code, and are not the product.
      const code = line.replace(/\/\/.*$/, '').replace(/\/\*.*$/, '').trim();
      if (!code || code.startsWith('*')) return;
      /*  Prose only. `unlock:` is a field on a theme and describes how one
       *  is earned, which is the domain speaking rather than a brochure. The
       *  check reads what is inside quotes, which is what a reader sees. */
      for (const q of code.matchAll(/(['"`])((?:\\.|(?!\1)[^\\])*)\1/g)) {
        const m = re.exec(q[2]);
        if (m) found.push(`${f}:${i + 1} "${m[1]}" in: ${q[2].slice(0, 80)}`);
      }
    });
  }
  assert.deepEqual(found, [], found.join('\n'));
});

test('no section leads with a pill restating its own title', () => {
  /*  One label above a heading is a label. One above every heading of every
   *  section of every page is a template, and it is the most recognisable
   *  shape a generated page has. */
  const found: string[] = [];
  for (const f of FILES.filter((x) => x.includes('marketing') || x.endsWith('MarketingChrome.tsx'))) {
    const text = readFileSync(f, 'utf8');
    const lines = text.split('\n');
    lines.forEach((line, i) => {
      if (!/className="pill"/.test(line)) return;
      // A pill carrying a figure or a count is data, not a badge.
      const label = />([^<]{1,30})</.exec(line)?.[1]?.trim() ?? '';
      if (!label || /\d/.test(label)) return;
      const after = lines.slice(i + 1, i + 6).join(' ');
      /*  Not only <h1>/<h2>. The landing sequence put its badge above a
       *  <span className="jack__title">, which is a heading in every way that
       *  matters to a reader and in none that matter to a selector, so it
       *  shipped past the first version of this test. Anything that reads as
       *  a title counts. */
      if (/<h1|<h2|sect__h|hero__h|__title|card__title/.test(after)) found.push(`${f}:${i + 1} "${label}" sits above a heading`);
    });
  }
  assert.deepEqual(found, [], found.join('\n'));
});

test('the fonts are the two the product uses, and no others', () => {
  const css = readFileSync('app/styles/tokens.css', 'utf8');
  const families = [...css.matchAll(/font-family:\s*'([^']+)'/g)].map((m) => m[1]);
  assert.deepEqual([...new Set(families)].sort(), ['Archivo', 'Plex Mono']);
  for (const banned of ['Inter', 'Space Grotesk', 'Instrument Serif', 'Geist']) {
    assert.ok(!css.includes(banned), `${banned} is in tokens.css`);
  }
});
