import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  IMAGE_RETENTION_DAYS, SLIP_STATE_LABEL, slipSentence, slipStatus, type SlipState,
} from '@/lib/domain/slip';

/** THE IMAGE THE PRODUCT DESCRIBED AND NEVER KEPT.
 *
 *  "Slips", "IMAGE HELD 90D", "The image is deleted after 90 days, or now if
 *  you ask" and a privacy policy repeating the promise all stood over a file
 *  that was never stored. The delete control set a React state variable,
 *  relabelled itself "Requested" and sent nothing anywhere. These tests hold
 *  the two halves of the fix: nothing claims an image it has not got, and
 *  every claim it does make is one the code keeps. */

const NOW = new Date('2026-09-01T12:00:00Z');
const daysAgo = (d: number) => new Date(NOW.getTime() - d * 86400000).toISOString();
const bet = (over: Record<string, unknown> = {}) => ({
  source: 'telegram', slipBacked: true, placedAt: daysAgo(1), ...over,
} as Parameters<typeof slipStatus>[0]);

test('a resolved image is held, and carries the id that serves it', () => {
  const s = slipStatus(bet({ slipImage: { id: 'img-1', deletedAt: null }, placedAt: daysAgo(3) }), NOW);
  assert.equal(s.state, 'held');
  assert.equal(s.imageId, 'img-1');
  assert.equal(s.daysLeft, IMAGE_RETENTION_DAYS - 3);
});

test('a slip backed bet with nothing stored says so, rather than claiming an image', () => {
  /*  The defect in one line. Every slip backed bet reported "Image held" and
   *  counted down ninety days to the deletion of a file that did not exist. */
  const s = slipStatus(bet({ slipImage: null, placedAt: daysAgo(3) }), NOW);
  assert.equal(s.state, 'unstored');
  assert.equal(s.imageId, undefined);
  assert.equal(s.daysLeft, null, 'there is nothing to count down to');
  assert.match(slipSentence(s), /no image was kept/i);
  assert.doesNotMatch(slipSentence(s), new RegExp(`${IMAGE_RETENTION_DAYS} days`));
});

test('an image deleted on request says it was your request, not the schedule', () => {
  /*  A person exercising a data right is owed the version that says so. The
   *  ninetieth day and a deletion somebody asked for leave the same row and
   *  are not the same fact. */
  const s = slipStatus(bet({
    slipImage: { id: 'img-1', deletedAt: daysAgo(0) }, placedAt: daysAgo(5),
  }), NOW);
  assert.equal(s.state, 'expired');
  assert.equal(s.removedEarly, true);
  assert.match(slipSentence(s), /at your request/i);
  assert.match(slipSentence(s), /bet is unchanged/i);
});

test('an image the clock removed says the clock removed it', () => {
  const s = slipStatus(bet({
    slipImage: { id: 'img-1', deletedAt: daysAgo(0) }, placedAt: daysAgo(200),
  }), NOW);
  assert.equal(s.state, 'expired');
  assert.notEqual(s.removedEarly, true);
  assert.match(slipSentence(s), new RegExp(`removed ${IMAGE_RETENTION_DAYS} days`));
});

test('a surface that resolves nothing cannot imply an image by saying nothing', () => {
  /*  The shape of the original defect. Leaving the image out used to mean
   *  "work it out from the date", and the date said held for ninety days over
   *  a store that held nothing. Absent and null are now the same answer, so
   *  the only way to get "Image held" on a screen is to have an image. */
  assert.equal(slipStatus(bet({ placedAt: daysAgo(3) }), NOW).state, 'unstored');
  assert.equal(slipStatus(bet({ placedAt: daysAgo(200) }), NOW).state, 'unstored');
  assert.equal(
    slipStatus(bet({ placedAt: daysAgo(3), slipImage: null }), NOW).state,
    slipStatus(bet({ placedAt: daysAgo(3) }), NOW).state,
  );
});

test('every slip state has a label and a sentence', () => {
  const states: SlipState[] = ['imported', 'typed', 'held', 'expired', 'unstored'];
  assert.deepEqual(Object.keys(SLIP_STATE_LABEL).sort(), [...states].sort());
  for (const state of states) {
    assert.ok(SLIP_STATE_LABEL[state].length > 3, `${state} has no label`);
    const said = slipSentence({ state, ageDays: 5, daysLeft: state === 'held' ? 85 : null });
    assert.ok(said.length > 30, `${state} has no sentence`);
    assert.ok(!said.includes('—'), `${state} has an em dash in it`);
  }
});

// --------------------------------------------------------------- structural

const SHEET = readFileSync('components/app/BetSheet.tsx', 'utf8');
const GALLERY = readFileSync('components/app/SlipGallery.tsx', 'utf8');
const EXTRACT = readFileSync('app/api/extract/route.ts', 'utf8');
const BETS = readFileSync('app/api/bets/route.ts', 'utf8');
const SWEEP = readFileSync('app/api/cron/retention/route.ts', 'utf8');
const SETTINGS = readFileSync('app/api/settings/route.ts', 'utf8');
const ROUTE = readFileSync('app/api/slips/[id]/route.ts', 'utf8');

test('delete the image now sends a request rather than relabelling itself', () => {
  /*  It was onClick={() => setImageGone(true)}: local React state, a new
   *  label, and nothing sent anywhere, beside a privacy commitment the policy
   *  repeats. */
  assert.match(SHEET, /fetch\(`\/api\/slips\/\$\{imageId\}`, \{ method: 'DELETE' \}\)/);
  assert.doesNotMatch(SHEET, /onClick=\{\(\) => setImageGone\(true\)\}/);
  assert.match(ROUTE, /export async function DELETE/);
});

test('the image is stored on the read and bound to the bet that is written', () => {
  assert.match(EXTRACT, /storeSlipImage/);
  assert.match(BETS, /linkSlipToBet/);
});

test('the retention sweep deletes the bytes, not only a key pointing at nothing', () => {
  for (const [name, src] of [['the sweep', SWEEP], ['the settings purge', SETTINGS]] as const) {
    assert.match(src, /data = null/, `${name} clears a key and leaves the image`);
  }
  assert.match(SWEEP, /bet_id is null/, 'an image nobody turned into a bet is kept for ninety days');
});

test('no surface draws a picture it has not got', () => {
  /*  The rule the gallery was already written to: a broken image is
   *  indistinguishable from a bug and an empty box is indistinguishable from
   *  a bet nobody photographed. Every img in these two files is guarded on
   *  there being an image id. */
  for (const [name, src] of [['the sheet', SHEET], ['the gallery', GALLERY]] as const) {
    for (const line of src.split('\n')) {
      if (!/<img\s/.test(line)) continue;
      assert.match(line, /\/api\/slips\/\$\{/, `${name} renders an img from something other than a stored id`);
    }
    assert.match(src, /imageId \?/, `${name} does not guard its picture`);
  }
});

test('an image is served only to the account that owns it', () => {
  assert.match(ROUTE, /currentAccount/);
  assert.match(ROUTE, /'private, max-age=3600, immutable'/, 'a slip must never land in a shared cache');
  const store = readFileSync('lib/server/slips.ts', 'utf8');
  assert.match(store, /where id = \$1 and account_id = \$2/, 'ownership must be part of the query');
});
