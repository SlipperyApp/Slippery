/* You can see an import before you agree to it.
 *
 * The review was four counts and one button. "Import 200 bets" was the
 * whole of it: nobody could see the dates and amounts they were about to
 * commit to their record, correct a row the parser read wrongly, or leave
 * one out. All of it or none of it, on a file exported from a bookmaker,
 * which is exactly the kind of file with one bad row in it.
 *
 * These are source-level checks because the review is DOM behaviour and
 * there is no DOM harness here; what they protect is that the review reads
 * from the row objects and posts only what was ticked. The browser audit
 * drives the real thing.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { betProblem } from '../src/js/betshape.js';

const read = f => readFile(new URL('../' + f, import.meta.url), 'utf8');
const main = await read('src/js/main.js');

test('every parsed row carries whether it is coming and what is wrong with it', () => {
  const build = main.slice(main.indexOf('pendingCsv = bets.map('));
  const body = build.slice(0, build.indexOf('});') + 3);
  assert.match(body, /include:/);
  assert.match(body, /duplicate: dupe/);
  assert.match(body, /problem: betProblem\(b\)/);
});

test('the import posts what was ticked, not what was parsed', () => {
  /* The bug this replaces: #csvGo posted the whole of pendingCsv. */
  const fn = main.slice(main.indexOf('async function runCsvImport'));
  const body = fn.slice(0, fn.indexOf('\n}\n'));
  assert.match(body, /pendingCsv\.filter\(b => b\.include && !b\.problem\)/);
  assert.doesNotMatch(body, /const rows = pendingCsv;/);
  assert.match(body, /Nothing selected/);
});

test('selection lives on the row object, never in the DOM', () => {
  /* A re-render must not be able to lose which rows somebody unticked. */
  const fn = main.slice(main.indexOf('function toggleCsvRow'));
  const body = fn.slice(0, fn.indexOf('\n}\n'));
  assert.match(body, /b\.include = !b\.include/);
  assert.match(main, /setHTML\('csvRows', pendingCsv\.map\(csvRow\)/);
});

test('an edit re-checks the row the way the server will', () => {
  const fn = main.slice(main.indexOf('function editCsvRow'));
  const body = fn.slice(0, fn.indexOf('\n}\n'));
  assert.match(body, /b\.problem = betProblem\(b\)/);
  /* And a row that has just been fixed comes back in, rather than staying
     excluded for a reason that no longer applies. */
  assert.match(body, /if \(!b\.problem && !b\.duplicate\) b\.include = true/);
});

test('a row that cannot be saved cannot be ticked', () => {
  const fn = main.slice(main.indexOf('function toggleCsvRow'));
  assert.match(fn.slice(0, 400), /if \(b\.problem\) \{ toast\(b\.problem\); return; \}/);
});

test('duplicates are found on the four fields the server keys on', () => {
  const fn = main.slice(main.indexOf('function showCsvReport'));
  const body = fn.slice(0, fn.indexOf('\n}\n'));
  /* day, selection, stake, bookmaker — the same key as api/bets.js. */
  assert.match(body, /dayOf\(b\.placedAt\)/);
  assert.match(body, /String\(b\.selection \|\| ''\)\.trim\(\)\.toLowerCase\(\)/);
  assert.match(body, /Math\.round\(Number\(b\.stakePence\) \|\| 0\)/);
  assert.match(body, /String\(b\.book \|\| ''\)\.trim\(\)\.toLowerCase\(\)/);
  /* Pre-unticked with the reason shown, rather than silently dropped by
     the server after the fact. */
  assert.match(body, /include: !dupe/);
});

test('the same validator runs on both sides', async () => {
  const bets = await read('api/bets.js');
  assert.match(bets, /from '\.\.\/src\/js\/betshape\.js'/);
  assert.match(main, /from '\.\/betshape\.js'/);
  /* Proving it is the real rule and not a copy that agrees today. */
  assert.match(betProblem({ stakePence: 0, selection: 'x' }), /needs a stake/);
  assert.equal(betProblem({ stakePence: 1000, odds: 2, selection: 'x' }), '');
});

test('a bet says where it came from', async () => {
  const render = await read('src/js/render.js');
  const data = await read('src/js/data.js');
  assert.match(data, /source: r\.source \|\| 'upload'/);
  assert.match(render, /b\.source === 'import' \? IMPORTED : ''/);
  /* A tag, not a colour: colour on a bet row means money. */
  const css = await read('src/styles/06-dashboard.css');
  const prov = css.slice(css.indexOf('.prov{'), css.indexOf('.prov{') + 300);
  assert.doesNotMatch(prov, /--pos|--neg/);
});

test('the ledger can be read by provenance, but only when there are two kinds', async () => {
  const render = await read('src/js/render.js');
  assert.match(render, /S\.source === 'slips' \? b\.source !== 'import' : b\.source === 'import'/);
  /* On an account with no imported history the control would be two
     buttons that always give the same answer. */
  assert.match(render, /srcEl\.hidden = !imported \|\| imported === pool\.length/);
});

test('the History tab states what an imported figure cannot do', async () => {
  const render = await read('src/js/render.js');
  const html = await read('src/app.html');
  assert.match(html, /id="historyRule"/);
  assert.match(render, /not in the win rate, the streak, or the best and worst day/);
});
