import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  slipStatus, slipSentence, SLIP_STATE_LABEL, IMAGE_RETENTION_DAYS,
} from '@/lib/domain/slip';

const NOW = new Date('2026-09-01T12:00:00Z');
const daysAgo = (d: number) => new Date(NOW.getTime() - d * 86400000).toISOString();

/*  A CAPTURED BET WITH ITS IMAGE STILL IN THE STORE.
 *
 *  The image is stated rather than assumed, because that is the fix: this
 *  used to be worked out from placedAt and a literal ninety, so every slip
 *  backed bet in the product reported "Image held" over a store that held
 *  nothing. tests/slip-storage.test.ts covers the bet with no image. */
const bet = (over: Partial<{
  source: string; slipBacked: boolean; placedAt: string;
  slipImage: { id: string; deletedAt: string | null } | null;
}> = {}) => ({
  source: 'telegram', slipBacked: true, placedAt: daysAgo(1),
  slipImage: { id: 'img-1', deletedAt: null }, ...over,
});

test('a captured slip inside the window is held, and counts down', () => {
  const s = slipStatus(bet({ placedAt: daysAgo(10) }), NOW);
  assert.equal(s.state, 'held');
  assert.equal(s.ageDays, 10);
  assert.equal(s.daysLeft, IMAGE_RETENTION_DAYS - 10);
});

test('the ninetieth day is the boundary, and it is exact', () => {
  /*  The boundary is the whole promise in the privacy policy, so it is
   *  asserted from both sides rather than trusted. On day ninety the image is
   *  still there with nothing left to run; on day ninety one it is gone. */
  const onTheDay = slipStatus(bet({ placedAt: daysAgo(IMAGE_RETENTION_DAYS) }), NOW);
  assert.equal(onTheDay.state, 'held');
  assert.equal(onTheDay.daysLeft, 0);

  /*  On day ninety one the sweep has run and the row says so. The clock no
      longer decides this on its own: an image is expired because it was
      deleted, not because a date passed, which is the difference between a
      promise kept and a promise printed. */
  const after = slipStatus(bet({
    placedAt: daysAgo(IMAGE_RETENTION_DAYS + 1),
    slipImage: { id: 'img-1', deletedAt: daysAgo(1) },
  }), NOW);
  assert.equal(after.state, 'expired');
  assert.equal(after.daysLeft, null, 'there is nothing left to count down to');
});

test('a typed bet and an imported one are not slips, whatever their age', () => {
  /*  Both are first class bets. Neither ever had an image, so neither can
   *  expire, and putting either in the gallery as a blank tile would turn a
   *  wall of evidence into a second ledger with the evidence missing. */
  const typed = slipStatus(bet({ slipBacked: false, placedAt: daysAgo(400) }), NOW);
  assert.equal(typed.state, 'typed');
  assert.equal(typed.daysLeft, null);

  const imported = slipStatus(bet({ source: 'csv_import', slipBacked: false, placedAt: daysAgo(2) }), NOW);
  assert.equal(imported.state, 'imported');

  /*  Imported wins over typed when both are true, which they always are:
   *  every imported bet is also not slip backed, and "Imported" is the one
   *  that says where the bet actually came from. The ledger row says
   *  Imported, so this has to as well or one bet has two names on one
   *  screen. */
  const both = slipStatus(bet({ source: 'shot_import', slipBacked: false }), NOW);
  assert.equal(both.state, 'imported');
});

test('an expired slip SAYS it was removed rather than showing nothing', () => {
  /*  The whole reason the gallery exists in this shape. A broken image is
   *  indistinguishable from a bug and a blank tile is indistinguishable from
   *  a bet nobody photographed. */
  const s = slipStatus(bet({
    placedAt: daysAgo(200), slipImage: { id: 'img-1', deletedAt: daysAgo(110) },
  }), NOW);
  const said = slipSentence(s);
  assert.equal(SLIP_STATE_LABEL[s.state], 'Image removed');
  assert.match(said, /removed/i);
  assert.match(said, new RegExp(String(IMAGE_RETENTION_DAYS)));
  assert.match(said, /bet is unchanged/i, 'it has to say the bet survived the image');
});

test('the held sentence counts down in days and offers the early deletion', () => {
  assert.match(slipSentence(slipStatus(bet({ placedAt: daysAgo(89) }), NOW)), /1 day\b/);
  assert.match(slipSentence(slipStatus(bet({ placedAt: daysAgo(88) }), NOW)), /2 days/);
  assert.match(slipSentence(slipStatus(bet({ placedAt: daysAgo(10) }), NOW)), /now if you ask/);
  assert.match(slipSentence(slipStatus(bet({ placedAt: daysAgo(90) }), NOW)), /removed today/);
});

test('a slip captured in the future does not report a negative age', () => {
  // Clock skew between a phone and the server is real and it must not print
  // "captured -1 days ago" on somebody's gallery.
  const s = slipStatus(bet({ placedAt: new Date(NOW.getTime() + 3600_000).toISOString() }), NOW);
  assert.equal(s.ageDays, 0);
  assert.equal(s.state, 'held');
  assert.equal(s.daysLeft, IMAGE_RETENTION_DAYS);
});

test('every state has a label and a sentence, so no tile can render blank', () => {
  const cases = [
    bet({ placedAt: daysAgo(1) }),
    bet({ placedAt: daysAgo(500) }),
    bet({ slipBacked: false }),
    bet({ source: 'csv_import', slipBacked: false }),
  ];
  for (const c of cases) {
    const s = slipStatus(c, NOW);
    assert.ok(SLIP_STATE_LABEL[s.state].length > 0, `no label for ${s.state}`);
    assert.ok(slipSentence(s).length > 20, `no sentence for ${s.state}`);
  }
});
