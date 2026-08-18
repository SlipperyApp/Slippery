/* Every route goes somewhere, and every route somewhere is reachable.
 *
 * Both halves have failed here before. The landing rewrite deleted the
 * eight feature sections and left the footer's "Features" button pointing
 * at data-anchor="secAll", an id that no longer existed, so the link did
 * nothing. In the other direction, the utilities page was fully built and
 * rendered and reachable only by typing #util into the address bar.
 *
 * Two views are deliberately not on any data-nav and are listed here by
 * name rather than left to a rule that would hide a real orphan.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../src/app.html', import.meta.url), 'utf8');
const main = readFileSync(new URL('../src/js/main.js', import.meta.url), 'utf8');

const all = re => [...html.matchAll(re)].map(m => m[1]);
const views = new Set(all(/<section class="view[^"]*" id="([a-z]+)"/g));
const navs = new Set(all(/data-nav="([a-z]+)"/g));
const ids = new Set(all(/id="([A-Za-z0-9_-]+)"/g));

/* Reached by a parameter rather than by a name:
     pay   opened by data-pay, which also says WHICH plan
     prof  opened by data-profile, which also says whose profile */
const BY_PARAMETER = ['pay', 'prof'];
/* Not a section at all: the demo is the dashboard with a fabricated
   ledger in it, so data-nav="demo" is intercepted before routing. */
const NOT_A_VIEW = ['demo'];

test('every data-nav points at a view that exists', () => {
  for (const n of navs) {
    if (NOT_A_VIEW.includes(n)) continue;
    assert.ok(views.has(n), 'data-nav="' + n + '" goes nowhere');
  }
});

test('every view can be reached without typing a URL', () => {
  for (const v of views) {
    if (BY_PARAMETER.includes(v)) continue;
    assert.ok(navs.has(v), '#' + v + ' is built and rendered but has no way in');
  }
});

test('the views reached by a parameter really are', () => {
  /* Proving the exemption above rather than letting it hide a bug. The
     profile buttons are rendered rather than written into the markup,
     because they carry a person's name. */
  const render = readFileSync(new URL('../src/js/render.js', import.meta.url), 'utf8');
  assert.match(html, /data-pay="/);
  assert.match(render, /data-profile="/);
  assert.match(main, /c\('\[data-pay\]'\)/);
  assert.match(main, /c\('\[data-profile\]'\)/);
});

test('every data-anchor points at an element that exists', () => {
  for (const a of all(/data-anchor="([A-Za-z]+)"/g)) {
    assert.ok(ids.has(a), 'data-anchor="' + a + '" points at nothing');
  }
});

test('the demo is intercepted before it can be routed to', () => {
  /* It is not a view, so falling through to go() would silently do
     nothing. The interception has to come before the generic handler. */
  const demo = main.indexOf(`c('[data-nav="demo"]')`);
  const generic = main.indexOf(`c('[data-nav]')`);
  assert.ok(demo > 0 && demo < generic, 'the demo handler must precede the generic one');
});

test('no CTA offers a page that was deleted', () => {
  /* The calculators and the roadmap were removed. A button still naming
     them would be a route to nothing that reads like a promise. */
  for (const gone of ['Calculators', 'Coming soon']) {
    assert.ok(!html.includes('>' + gone + '<'), 'a control still offers ' + gone);
  }
});

test('the tab bar and the footer agree that the app has three tabs', () => {
  const bar = html.slice(html.indexOf('class="tabbar"'));
  const tabs = [...bar.slice(0, bar.indexOf('</nav>')).matchAll(/data-nav="([a-z]+)"/g)];
  assert.equal(tabs.length, 3, 'the tab bar draws its indicator from this count');
  for (const [, t] of tabs) assert.ok(views.has(t), t + ' is a tab with no view');
});
