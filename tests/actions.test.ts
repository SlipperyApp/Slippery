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
  /* The store-badge entries went when the badges did — both stores require a
     live listing before their badge may be shown at all, so the control was
     removed rather than left admitting it could not work. */
  for (const c of ['choose a picture', 'image saved', 'challenge set']) {
    assert.equal(ACTIONS[c], NOT_BUILT, c + ' should be explicitly marked, not left to fall through');
  }
});

test('tailing is declared not built, and the reason is a decision not a gap', () => {
  /* The distinction matters. Everything else in this list is waiting on a
     table or a hook. Tailing is waiting on an answer: it exists to make
     somebody place a bet they otherwise would not, and CLAUDE.md locks the
     line that nothing here may nudge toward more volume. If it is ever
     shipped, that should be a decision somebody took, not a gap somebody
     closed. */
  assert.equal(ACTIONS['tailing'], NOT_BUILT);
  assert.equal(ACTIONS['tailed'], NOT_BUILT);
  const src = readFileSync('lib/proto/actions.js', 'utf8');
  /* Line-break tolerant: the reason is a paragraph in a block comment, so
     both the wrapping AND the leading asterisks have to come out before
     matching. Rewrapping a comment must not fail a test. */
  const prose = src.replace(/^\s*\*/gm, '').replace(/\s+/g, ' ');
  assert.match(prose, /nudge toward more volume/,
    'the reason is not written down beside the declaration');
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

/* ═══ THE ONE ACTION THE PRODUCT EXISTS FOR ═══
 *
 * Capture at placement. If the dropzone does not upload, nothing else in
 * this repository matters, and it did not upload until it was checked. */

test('the dropzone posts a real file to the reader', () => {
  const rt = runtime;
  assert.match(rt, /new FormData\(\)/, 'nothing is being uploaded');
  assert.match(rt, /'\/api\/extract'/, 'the reader route is never called');
  assert.doesNotMatch(rt, /data-pick[^a-z]*>[\s\S]{0,80}data-go="crop"/,
    'the dropzone still navigates to the demo crop screen');
});

test('the review screen renders what the reader returned and nothing else', () => {
  /* Scoped to V.review on purpose. The prototype's worked example runs
     through the rest of the product and is the visual specification the
     fidelity harness holds; hydrate() replaces it the moment an account has
     data. THIS screen is different: it is the confirmation step before
     something enters your ledger, so it must show the reader's answer or
     nothing at all. */
  const review = runtime.slice(runtime.indexOf('V.review='), runtime.indexOf('function reviewLine'));
  for (const invented of ['Juventus v Cremonese', 'Arsenal, Leeds, Sinner', 'Kempton 19:45']) {
    assert.ok(!review.includes(invented), 'the review list still hard codes "' + invented + '"');
  }
  assert.match(review, /cur\.readBets/, 'the review list is not reading the extraction result');
});

test('nothing is written before somebody presses save', () => {
  const rt = runtime;
  const readSlips = rt.slice(rt.indexOf('async function readSlips'), rt.indexOf('async function saveRead'));
  assert.ok(!/'\/api\/bets'/.test(readSlips), 'reading a slip writes a bet without being asked');
});

/* Reader output goes into an HTML string. Unescaped, a bookmaker name off a
   screenshot is a script tag. */
test('anything read off a slip is escaped before it becomes HTML', () => {
  const rt = runtime;
  assert.match(rt, /const esc=/, 'there is no escaper');
  for (const field of ['b.eventName', 'b.bookmaker', 'cur.readName']) {
    const bare = new RegExp('\\$\\{' + field.replace('.', '\\.') + '\\b(?![^}]*\\))');
    assert.ok(!bare.test(rt), field + ' reaches innerHTML unescaped');
  }
});

test('a stake is formatted without a sign', () => {
  const rt = runtime;
  assert.match(rt, /const amount=/, 'stakes are going through the signed formatter');
  assert.match(rt, /bits\.push\(amount\(b\.stakePence/, 'the review line signs the stake');
});

/* ═══ THE FIGURES ON SCREEN ARE THE ACCOUNT'S OWN ═══ */

test('a signed-in account replaces the worked example rather than adding to it', () => {
  assert.match(runtime, /async function hydrateLedger/, 'nothing fetches the ledger');
  assert.match(runtime, /'\/api\/bets\?period=all'/, 'the ledger route is never called');
  /* If these stay `const` the hydration cannot replace them, and the
     failure is silent: the screens keep drawing the example. */
  for (const binding of ['bets', 'PERIODS', 'DAYVALS', 'BR_OPEN']) {
    assert.ok(!new RegExp('^const ' + binding + '\\b', 'm').test(runtime),
      binding + ' is const, so hydration cannot replace it');
  }
  const shell = readFileSync(new URL('../components/AppShell.tsx', import.meta.url), 'utf8');
  assert.match(shell, /hydrateLedger\(\)/, 'the shell never asks for the real ledger');
});

/* An account with nothing in it is the first thing every new user sees. */
test('no figure divides by zero on an empty account', () => {
  assert.match(runtime, /function roiOf/, 'ROI has no zero-stake case');
  assert.ok(!/net\/staked\*100/.test(runtime), 'the ledger still divides net by staked directly');
  assert.ok(!/d\.net\/\(d\.to-d\.void\)\*100/.test(runtime), 'the period card still divides directly');
  /* 57 · The guard is unchanged; the denominator was renamed. Exposure
     divides by BALANCE now — dividing by the starting bankroll made £88 at
     risk read 8.8% when it is 2.1%. */
  assert.match(runtime, /const b=balance\(\);return b>0/, 'exposure still divides by an unguarded balance');
  assert.match(runtime, /const startingBankroll=/, 'starting bankroll and balance are one number again');
});
