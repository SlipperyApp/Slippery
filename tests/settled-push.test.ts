import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { isTransitionToSettled, BATCH_MS } from '../lib/settled-rule.ts';
import { settledLine } from '../lib/server/bot-voice.ts';

/* 17 · A bet finishing is the highest-attention moment this product has, and
 * it happened in silence: `settledLine()` has existed since the bot was built
 * and nothing ever called it.
 *
 * These cover the three ways the fix could be worse than the silence. */

test('only a transition INTO settled announces anything', () => {
  /* The trap: a recompute over an already-settled bet also returns 'settled',
     so without the previous status the bot announces the same bet every time
     anything touches it — an edit, a Rule 4, a manual correction. */
  assert.equal(isTransitionToSettled('open', 'settled'), true);
  assert.equal(isTransitionToSettled('part_settled', 'settled'), true);
  assert.equal(isTransitionToSettled(null, 'settled'), true);
  assert.equal(isTransitionToSettled('settled', 'settled'), false, 'a re-fold announced itself');
  assert.equal(isTransitionToSettled('open', 'part_settled'), false);
  assert.equal(isTransitionToSettled('open', 'open'), false);
});

test('the send is never inside the settlement transaction', () => {
  /* Telegram being slow or down must not be able to roll back a settlement.
     The fold hands the caller the fact; the caller sends after the commit. */
  const bets = readFileSync('lib/server/bets.ts', 'utf8');
  assert.doesNotMatch(bets, /sendMessage|queueSettledPush/,
    'the settlement fold is sending messages inside its own transaction');
  assert.match(bets, /justSettled: isTransitionToSettled\(previousStatus, state\.status\)/);

  const route = readFileSync('app/api/bets/[id]/settle/route.ts', 'utf8');
  const commit = route.indexOf('await db.transaction');
  /* The CALL, not the import at the top of the file — which is why this looks
     for `void queueSettledPush(` rather than the bare name. */
  const send = route.indexOf('void queueSettledPush(');
  assert.ok(commit > -1, 'the settlement is no longer in a transaction');
  assert.ok(send > commit, 'the push is not after the commit');
  /* And it is not awaited into the response: the settlement is already
     durable, so a slow Telegram must not make saving a result feel slow. */
  assert.doesNotMatch(route, /await queueSettledPush/);
});

test('a five-fold sends one message, not five', () => {
  /* A multiple's legs settle within a second or two of each other, and one
     message per leg is how a bot gets muted. */
  assert.equal(BATCH_MS, 90_000);
});

test('the settled line reads as a result, with no commiseration', () => {
  /* Tone: state the number and stop. Never console somebody on a loss. */
  const won = settledLine('Arsenal v Spurs', 900, 3400);
  const lost = settledLine('Inter v Milan', -2500, -1600);
  assert.match(won, /Arsenal v Spurs \+£9\.00 · today \+£34\.00/);
  assert.match(lost, /Inter v Milan −£25\.00 · today −£16\.00/);
  for (const s of [won, lost]) {
    assert.doesNotMatch(s, /unlucky|bad luck|next time|hard lines|congrat/i);
  }
});

test('a failed send cannot surface as an error, because the bet is already settled', () => {
  const src = readFileSync('lib/server/settled-push.ts', 'utf8');
  /* The catch is empty on purpose and says so, so nobody "helpfully" adds a
     throw to it later. */
  assert.match(src, /catch \{[\s\S]{0,220}A settlement is already recorded/);
});

test('nothing is sent to a dormant link', () => {
  /* `dormant` is set when somebody blocks the bot. Continuing to post at them
     is both useless and rude. */
  const src = readFileSync('lib/server/settled-push.ts', 'utf8');
  assert.match(src, /eq\(schema\.telegramLinks\.dormant, false\)/);
});

test('a pending message never keeps the process alive', () => {
  const src = readFileSync('lib/server/settled-push.ts', 'utf8');
  assert.match(src, /entry\.timer\.unref\?\.\(\)/);
});
