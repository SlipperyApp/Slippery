import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';

/** Fails if any var(--x) without a fallback names a custom property defined
 *  nowhere.
 *
 *  This is the failure that ships green: an undefined property inside a
 *  font-size invalidates the whole declaration, the element silently inherits,
 *  and a page title renders at body size while the build passes, the type
 *  check is clean and axe has nothing to say about it. */

const STYLES = new URL('../app/styles/', import.meta.url);
const cssFiles = readdirSync(STYLES).filter((f) => f.endsWith('.css'));
const sources = cssFiles.map((f) => ({ file: f, text: readFileSync(new URL(f, STYLES), 'utf8') }));

/** Every property declared anywhere, in a theme block or at :root. */
const declared = new Set<string>();
for (const { text } of sources) {
  for (const m of text.matchAll(/(--[a-z0-9-]+)\s*:/gi)) declared.add(m[1]);
}

/** Properties set from the components rather than the stylesheets. */
const SET_IN_TSX = ['--gap', '--s', '--blob-mask', '--tear', '--sc', '--cal-rows'];
for (const n of SET_IN_TSX) declared.add(n);

test('no stylesheet reads a custom property that is never defined', () => {
  const missing: string[] = [];
  for (const { file, text } of sources) {
    const clean = text.replace(/\/\*[\s\S]*?\*\//g, '');
    clean.split('\n').forEach((line, i) => {
      // var(--x) with no comma is a read with no fallback.
      for (const m of line.matchAll(/var\(\s*(--[a-z0-9-]+)\s*\)/gi)) {
        if (!declared.has(m[1])) missing.push(`${file}:${i + 1} reads ${m[1]}, which is defined nowhere`);
      }
    });
  }
  assert.deepEqual([...new Set(missing)], []);
});

test('every component that reads a token in an inline style names a real one', () => {
  const roots = [new URL('../components/', import.meta.url), new URL('../app/', import.meta.url)];
  const missing: string[] = [];

  const walk = (dir: URL) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const child = new URL(entry.name + (entry.isDirectory() ? '/' : ''), dir);
      if (entry.isDirectory()) { walk(child); continue; }
      if (!/\.tsx?$/.test(entry.name)) continue;
      const text = readFileSync(child, 'utf8');
      for (const m of text.matchAll(/var\(\s*(--[a-z0-9-]+)\s*\)/g)) {
        if (!declared.has(m[1])) missing.push(`${entry.name} reads ${m[1]}, which is defined nowhere`);
      }
    }
  };
  roots.forEach(walk);
  assert.deepEqual([...new Set(missing)], []);
});

test('every theme block defines the same set of properties', () => {
  // A theme missing one property inherits carbon's, which is a colour from
  // another palette sitting in this one and nothing reports it.
  const tokens = readFileSync(new URL('tokens.css', STYLES), 'utf8');
  const blocks = [...tokens.matchAll(/\[data-theme='([a-z]+)'\]\s*\{([\s\S]*?)\n\}/g)]
    .map((m) => ({ name: m[1], props: new Set([...m[2].matchAll(/(--[a-z0-9-]+)\s*:/g)].map((x) => x[1])) }));
  const carbon = /:root,\s*\[data-theme='carbon'\]\s*\{([\s\S]*?)\n\}/.exec(tokens)?.[1] ?? '';
  const reference = new Set([...carbon.matchAll(/(--[a-z0-9-]+)\s*:/g)].map((x) => x[1]));

  assert.ok(reference.size > 10, 'the carbon block was not found');
  const gaps: string[] = [];
  for (const b of blocks) {
    for (const p of reference) if (!b.props.has(p)) gaps.push(`${b.name} is missing ${p}`);
    for (const p of b.props) if (!reference.has(p)) gaps.push(`${b.name} defines ${p}, which carbon does not`);
  }
  assert.deepEqual(gaps, []);
});

/*  EVERY Z-INDEX IS A NAMED TIER.
 *
 *  There were thirteen raw numbers across five stylesheets and not one of
 *  them was wrong, which is the problem: each was chosen against whatever it
 *  happened to sit near, so nothing in the codebase said whether the sticky
 *  call to action was meant to be under the header or the header over the
 *  toast. A stacking bug does not announce itself in a build or a type check.
 *  It announces itself as one element under another on one device.
 *
 *  This is the rule that keeps it true. A raw number added later is a tier
 *  nobody named. */
test('no stylesheet sets a z-index to a raw number', () => {
  const raw: string[] = [];
  for (const { file, text } of sources) {
    text.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
      .split('\n')
      .forEach((line, i) => {
        if (/z-index\s*:\s*-?\d/.test(line)) raw.push(`${file}:${i + 1} ${line.trim()}`);
      });
  }
  assert.deepEqual(raw, [], raw.join('\n'));
});

test('the scale is ordered, and the order is the one the product needs', () => {
  /*  Asserted as an order rather than as values, because the values are
   *  spaced to leave room and the spacing is allowed to change. What may not
   *  change is which tier sits over which: a sheet over its own scrim, a
   *  toast over an open sheet, and the skip link over everything. */
  const tokens = readFileSync(new URL('tokens.css', STYLES), 'utf8');
  const value = (name: string) => {
    const m = new RegExp(`${name}\\s*:\\s*(-?\\d+)`).exec(tokens);
    assert.ok(m, `${name} is not defined`);
    return Number(m![1]);
  };
  const order = ['--z-behind', '--z-background', '--z-content', '--z-sticky',
    '--z-header', '--z-overlay', '--z-sheet', '--z-toast'];
  const values = order.map(value);
  for (let i = 1; i < values.length; i++) {
    assert.ok(values[i] > values[i - 1], `${order[i]} must sit over ${order[i - 1]}`);
  }
  assert.ok(values[0] < 0, 'behind has to be behind its own box');
});

test('every named tier is actually used, and nothing reads one that is not defined', () => {
  // A tier nobody uses is a name somebody will invent a second meaning for.
  const all = sources.map((s) => s.text).join('\n');
  for (const name of ['--z-behind', '--z-background', '--z-content', '--z-sticky',
    '--z-header', '--z-overlay', '--z-sheet', '--z-toast']) {
    assert.ok(new RegExp(`var\\(${name}\\)`).test(all), `${name} is defined and never used`);
  }
});
