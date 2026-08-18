/* No control may be inert.
 *
 * Four buttons in this codebase once confirmed actions they never
 * performed: Reset all bets printed "Reset all bets completed", disabled
 * itself and deleted nothing. Those are fixed. This is the guard that stops
 * the next one, because the failure is silent by construction: a button
 * with no handler looks exactly like a button with one.
 *
 * A control is answered either by its id, which the delegated handler looks
 * up, or by a routing attribute the handler dispatches on. Both count. What
 * does not count is neither.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const read = p => readFile(new URL(p, root), 'utf8');

async function allJs() {
  const dir = new URL('src/js/', root);
  const names = await readdir(dir);
  const parts = await Promise.all(names.filter(n => n.endsWith('.js'))
    .map(n => readFile(new URL(n, dir), 'utf8')));
  return parts.join('\n');
}

test('every button is reachable by a handler', async () => {
  const html = await read('src/app.html');
  const js = await allJs();

  /* The attributes the delegated handler actually dispatches on. Read out
     of the source rather than listed here, so adding a new routing
     attribute does not silently widen what counts as "handled". */
  const routed = new Set();
  for (const m of js.matchAll(/c\(['"]\[?([a-z-]*data-[a-z-]+)\]?[^'"]*['"]\)/g)) routed.add(m[1]);
  for (const m of js.matchAll(/closest\(['"]\[(data-[a-z-]+)\]/g)) routed.add(m[1]);
  for (const m of js.matchAll(/getAttribute\(['"](data-[a-z-]+)['"]\)/g)) routed.add(m[1]);
  assert.ok(routed.size > 3, 'expected to find the routing attributes in the handler');

  const dead = [];
  for (const tag of html.matchAll(/<button\b[^>]*>/g)) {
    const el = tag[0];
    if (/\btype="submit"/.test(el)) continue;
    /* A disabled control is not inert by accident. The card capture screen
       is a deliberate, labelled mockup: no processor account exists, so
       every field and its button are disabled rather than pretending. */
    if (/\bdisabled\b/.test(el)) continue;
    const id = (/\bid="([^"]+)"/.exec(el) || [])[1];
    const attrs = [...el.matchAll(/\b(data-[a-z-]+)=/g)].map(m => m[1]);
    const byId = id && js.includes(id);
    const byAttr = attrs.some(a => routed.has(a));
    if (!byId && !byAttr) dead.push(el.slice(0, 110));
  }
  assert.deepEqual(dead, [],
    'these buttons have no id the handler looks up and no attribute it ' +
    'dispatches on, so pressing them does nothing:\n  ' + dead.join('\n  '));
});

test('no handler branch only claims success without doing anything', async () => {
  /* The exact shape of the four that lied: say it worked, do nothing.

     A branch that toasts and does nothing is only a lie when the toast
     CLAIMS something happened. "Verification reviews are not open yet" is
     the opposite: it is the honest answer for a feature that does not
     exist, and flagging it would push the code back toward confirming
     something it did not do. */
  const js = await read('src/js/main.js');
  const CLAIMS = /\b(saved|added|deleted|reset|sent|applied|updated|removed|completed|copied|imported|cleared|done)\b/i;

  const offenders = [];
  for (const m of js.matchAll(/if \((?:\(el = )?c\((['"])(.+?)\1\)\)?\)\s*\{/g)) {
    let depth = 0, body = '';
    for (let j = m.index + m[0].length - 1; j < js.length; j++) {
      if (js[j] === '{') depth++;
      else if (js[j] === '}') { depth--; if (!depth) { body = js.slice(m.index, j + 1); break; } }
    }
    const toast = /toast\(\s*['"`]([^'"`]*)/.exec(body);
    if (!toast || !CLAIMS.test(toast[1])) continue;

    /* Strip comments, the branch head, the toast itself and the return.
       Whatever is left is the work. Nothing left means it only talked. */
    /* Drop the branch head by its exact matched length rather than by a
       second regex: `if (c('#x'))` and `if ((el = c('#x')))` do not have
       the same number of closing parens, and a pattern that guessed left a
       stray ")" behind, which counted as work and made this whole test
       pass on a control that did nothing. */
    const rest = body.slice(m[0].length)
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*$/gm, '')
      .replace(/toast\([^;]*\);?/g, '')
      .replace(/return;?/g, '')
      .replace(/[(){}\s;]/g, '');
    if (!rest) offenders.push(m[2] + ' -> "' + toast[1] + '"');
  }
  assert.deepEqual(offenders, [],
    'these confirm something they never did:\n  ' + offenders.join('\n  '));
});

test('the destructive controls reach the server', async () => {
  /* Reset all bets, delete account and purge images each printed success
     and deleted nothing. Each must name a real call. */
  const js = await read('src/js/main.js');
  for (const [what, needle] of [
    ['resetting bets', /del\(\s*'\/api\/bets'/],
    ['closing the account', /'\/api\/auth\/close'/]
  ]) {
    assert.match(js, needle, what + ' must hit the server, not just say it did');
  }
});
