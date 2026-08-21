import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ACTIONS, NOT_BUILT, key } from '../lib/proto/actions.js';

const runtime = readFileSync(new URL('../lib/proto/runtime.js', import.meta.url), 'utf8');

/* Every control the render layer draws, by the only stable identifier the
   prototype gives one. */
const controls = [...new Set(
  [...runtime.matchAll(/data-toast="([^"]*)"/g)].map((m) => key(m[1])),
)];

test('there are still ninety one controls to account for', () => {
  assert.ok(controls.length > 60, 'found only ' + controls.length);
});

/* THE DEFECT THIS FILE EXISTS FOR.
   A control that looks like it deletes your account and silently does
   nothing is worse than one that admits it is not ready. */
const DESTRUCTIVE = /delet|remove|reset|cancel|unlink|unpair|wipe|sign out/i;

test('no destructive control is left unclassified', () => {
  const unclassified = controls.filter((c) => DESTRUCTIVE.test(c) && !(c in ACTIONS));
  assert.deepEqual(unclassified, [],
    'these look destructive and no action is registered for them, so they would fall through to "not built": ' + unclassified.join(' | '));
});

test('every destructive control that is classified actually does something', () => {
  for (const c of controls.filter((c) => DESTRUCTIVE.test(c) && c in ACTIONS)) {
    assert.equal(typeof ACTIONS[c], 'function', c + ' is registered but does nothing');
  }
});

test('deleting an account runs immediately rather than through undo', () => {
  /* The one exception to undo-instead-of-confirm: account deletion keeps its
     confirm sheet, so it must not be deferred behind a four second window. */
  assert.equal(typeof ACTIONS['deleted'], 'function');
  assert.doesNotMatch(String(ACTIONS['deleted']), /holdUndo/);
});

test('resetting an account is deferred, so undo can stop it', () => {
  assert.match(String(ACTIONS['account reset']), /holdUndo/);
});

test('interpolated labels collapse to one entry rather than never matching', () => {
  assert.equal(key('${b} removed'), '* removed');
  assert.equal(key('Removed from ${g[0]}'), 'removed from *');
  assert.equal(key('  Copied  '), 'copied');
});

test('what is genuinely not built says so rather than being missing', () => {
  for (const c of ['coming soon to the app store', 'choose a picture', 'image saved']) {
    assert.equal(ACTIONS[c], NOT_BUILT, c + ' should be explicitly marked, not left to fall through');
  }
});

test('nothing in the table is left as a bare truthy placeholder', () => {
  for (const [k, v] of Object.entries(ACTIONS)) {
    assert.ok(typeof v === 'function' || v === NOT_BUILT, k + ' is neither an action nor an admission');
  }
});

test('the handler consults the table rather than trusting the label', () => {
  assert.match(runtime, /runAction\(t,\s*e\)/);
  assert.doesNotMatch(runtime, /const m=t\.dataset\.toast;\s*\n\s*toast\(m,/,
    'the old handler showed the label and did nothing');
});

test('undo cancels the write rather than reversing it afterwards', () => {
  assert.match(runtime, /cancelUndo\(\)/);
  assert.match(runtime, /Restored\. Nothing was deleted\./);
});
