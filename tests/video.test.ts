import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';

const read = (p: string) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

/* THE VIDEO PROJECT MUST NOT ADD A BYTE TO THE SITE.
 *
 * It is a build-time tool with its own package.json. The risk is not that it
 * is large; it is that somebody imports a component from it, or adds Remotion
 * to the site's dependencies for convenience, and the site starts shipping a
 * rendering library to every visitor.
 */
test('the site never imports anything from the video project', () => {
  const skip = new Set(['node_modules', '.next', '.git', 'video', 'test-results', 'public']);
  const bad: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      if (skip.has(name)) continue;
      const p = join(dir, name);
      if (statSync(p).isDirectory()) { walk(p); continue; }
      if (!/\.(ts|tsx|js|mjs)$/.test(name)) continue;
      const src = readFileSync(p, 'utf8');
      if (/from\s+['"][^'"]*\bvideo\/src\b/.test(src)) bad.push(p);
      if (/from\s+['"]remotion/.test(src)) bad.push(p);
    }
  };
  walk(process.cwd());
  assert.deepEqual(bad, []);
});

test('remotion is not a dependency of the site', () => {
  const pkg = JSON.parse(read('package.json'));
  const all = { ...pkg.dependencies, ...pkg.devDependencies };
  for (const name of Object.keys(all)) {
    assert.doesNotMatch(name, /remotion/, name + ' is in the site package.json');
  }
});

test('the video project is self-contained', () => {
  const pkg = JSON.parse(read('video/package.json'));
  assert.ok(pkg.dependencies.remotion, 'it should carry its own remotion');
  assert.equal(pkg.private, true);
});

/* THE STORYBOARD STAYS AS DOM.
   Its six scenes are live and theme-reactive. Rendering them would freeze
   them to one palette and break seven of the eight themes. */
test('the landing storyboard was not turned into video', () => {
  const client = read('lib/proto/runtime.js');
  assert.match(client, /data-scene/, 'the live scenes are gone');
  assert.match(client, /const FILM=/, 'the storyboard array is gone');
});

test('the embed asks for nothing until somebody wants it', () => {
  const client = read('lib/proto/runtime.js');
  const embed = client.slice(client.indexOf('const EXPLAINER='), client.indexOf('const WAVES='));
  assert.match(embed, /preload="none"/);
  assert.match(embed, /playsinline/);
  assert.match(embed, /muted/);
  assert.match(embed, /poster=/);
  assert.doesNotMatch(embed, /autoplay/, 'a video that starts by itself on a page about money is an ambush');
  assert.match(embed, /<source src="\/video\/explainer\.webm"/);
  assert.match(embed, /<source src="\/video\/explainer\.mp4"/);
});

/* The palette is copied into the video because a render cannot read a custom
   property. Copied values go stale; this is what stops them. */
test('the video palette still matches the Carbon theme', () => {
  const css = read('app/proto.css');
  const block = css.slice(css.indexOf('[data-t=carbon]{'), css.indexOf('}', css.indexOf('[data-t=carbon]{')));
  const theme = read('video/src/theme.ts');
  for (const token of ['pos', 'neg', 'a', 'bg', 'p', 's', 'card', 't1', 't2', 't3', 't4', 'elev', 'lg1', 'lg2']) {
    const inCss = new RegExp('--' + token + ':(#[0-9A-Fa-f]{6})').exec(block);
    if (!inCss) continue;
    const inVideo = new RegExp('\\b' + token + ": '(#[0-9A-Fa-f]{6})'").exec(theme);
    assert.ok(inVideo, token + ' is missing from the video palette');
    assert.equal(inVideo[1].toLowerCase(), inCss[1].toLowerCase(),
      token + ' has drifted: the theme says ' + inCss[1] + ', the video says ' + inVideo[1]);
  }
});

test('the rendered files exist, in all four shapes', () => {
  for (const f of [
    'public/video/explainer.mp4',
    'public/video/explainer.webm',
    'public/video/explainer-9x16.mp4',
    'public/video/explainer-poster.jpg',
  ]) {
    const p = new URL('../' + f, import.meta.url);
    assert.ok(existsSync(p), f + ' has not been rendered');
    assert.ok(statSync(p).size > 10_000, f + ' is suspiciously small');
  }
});
