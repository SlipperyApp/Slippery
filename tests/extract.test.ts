import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  normaliseRead, readSlip, toFields, toLegs, toRead,
  shapeFor, asConfidence, oddsFromText, contentBlockFor, readerReady,
} from '@/lib/server/vision';
import { parseMoneyMinor } from '@/lib/format';
import {
  REFUSAL_COPY, MAX_UPLOAD_BYTES, checkUpload, checkPick, normaliseType,
  DUPLICATE_WINDOW_MS, duplicateCutoff, fingerprintSource, identityOf,
  withinDuplicateWindow, type BetIdentity, type SlipRefusal,
} from '@/lib/data/read';
import { detectPromotions } from '@/lib/data/importing';

/** The reader, tested where the reader actually decides things.
 *
 *  The network call needs a key and cannot run here. Everything that decides
 *  what reaches a ledger can, and does: the model's answer is checked against
 *  itself by `normaliseRead`, and that is the whole of the honesty. A read
 *  that is wrong is worse than a read that did not happen, so the refusals
 *  below are tested harder than the successes.
 *
 *  No key, real or otherwise, appears in this file. */

const GBP = { accountCurrency: 'GBP' as const };
const EUR = { accountCurrency: 'EUR' as const };

const leg = (over: Record<string, unknown> = {}) => ({
  selection: 'Arsenal', eventName: 'Arsenal v Spurs', marketRaw: 'Match result',
  oddsText: '2.50', odds: 2.5, confidence: 'high', ...over,
});

const slip = (over: Record<string, unknown> = {}) => ({
  isSlip: true,
  capture: 'screenshot',
  bookmaker: 'bet365',
  bookmakerConfidence: 'high',
  shape: 'single',
  stakeText: '£10.00',
  stakePence: 1000,
  currency: 'GBP',
  placedAt: '2026-08-30T13:42:00Z',
  isFreeBet: false,
  isBoosted: false,
  isEachWay: false,
  ewTerms: null,
  legs: [leg()],
  notLegible: [],
  cutOff: [],
  ...over,
});

const good = (raw: unknown, ctx = GBP) => {
  const out = normaliseRead(raw, ctx);
  assert.equal(out.ok, true, `expected a read, got ${out.ok ? '' : out.reason}`);
  if (!out.ok) throw new Error('unreachable');
  return out.result;
};

const refused = (raw: unknown, ctx = GBP): SlipRefusal => {
  const out = normaliseRead(raw, ctx);
  assert.equal(out.ok, false, 'expected a refusal and got a read');
  if (out.ok) throw new Error('unreachable');
  return out.reason;
};

// ------------------------------------------------- money is not a float

test('an amount is integer minor units or it is nothing', () => {
  assert.deepEqual(parseMoneyMinor('£15.00'), { minor: 1500, currency: 'GBP' });
  assert.deepEqual(parseMoneyMinor('€2.150,50'), { minor: 215050, currency: 'EUR' });
  assert.deepEqual(parseMoneyMinor('1,234.56'), { minor: 123456, currency: null });
  assert.deepEqual(parseMoneyMinor('15'), { minor: 1500, currency: null });
  assert.deepEqual(parseMoneyMinor('  Stake: GBP 7.5 '), { minor: 750, currency: 'GBP' });

  // 19.99 through Number(x) * 100 is 1998.9999999999998.
  assert.equal(parseMoneyMinor('19.99')!.minor, 1999);
  for (const t of ['0.01', '9.99', '19.99', '119.99', '1000.05']) {
    assert.ok(Number.isInteger(parseMoneyMinor(t)!.minor), `${t} did not come back as an integer`);
  }
});

test('what is not money comes back as nothing rather than as a number', () => {
  for (const t of ['', '   ', 'free bet', 'SP', '15.0001', '1e3', 'Infinity', '-5.00', '5 to 10']) {
    assert.equal(parseMoneyMinor(t), null, `${JSON.stringify(t)} was read as money`);
  }
  assert.equal(parseMoneyMinor(null), null);
  assert.equal(parseMoneyMinor(1500), null, 'a bare number was never quoted off a slip');
  assert.equal(parseMoneyMinor('99999999.99'), null, 'a million pound stake is a misread column');
});

// --------------------------------------- the model is not believed on its word

test('a stake the model numbered but never quoted stays a question', () => {
  const r = good(slip({ stakeText: null, stakePence: 2500 }));
  assert.equal(r.stakePence, null, 'a number nobody can point at on the image was written');
  assert.ok(r.notLegible.includes('stake'));
});

test('a stake whose printed text disagrees with the number is a question, not a tiebreak', () => {
  const r = good(slip({ stakeText: '£10.00', stakePence: 1000000 }));
  assert.equal(r.stakePence, null);
});

test('a stake the model listed as not legible is not used even when it quoted one', () => {
  const r = good(slip({ notLegible: ['stake'] }));
  assert.equal(r.stakePence, null);
});

test('a stake that reads cleanly is kept, in minor units', () => {
  const r = good(slip({ stakeText: '£12.50', stakePence: 1250 }));
  assert.equal(r.stakePence, 1250);
  assert.ok(Number.isInteger(r.stakePence));
});

test('a low confidence price never becomes a number', () => {
  const r = good(slip({ legs: [leg({ confidence: 'low' })] }));
  assert.equal(r.legs[0].odds, null);
  assert.equal(r.legs[0].confidence, 'low');
  assert.ok(r.notLegible.includes('odds'));
});

test('a price the model read differently from the price it quoted is dropped', () => {
  // 6/4 is 2.50. A model answering 2.40 has misread the column, not rounded.
  const r = good(slip({ legs: [leg({ oddsText: '6/4', odds: 2.4 })] }));
  assert.equal(r.legs[0].odds, null);
  assert.equal(r.legs[0].confidence, 'low');
});

test('the fractional ladder is read, and SP is not a price', () => {
  assert.equal(oddsFromText('6/4'), 2.5);
  assert.equal(oddsFromText('evens'), 2);
  assert.equal(oddsFromText('11/10'), 2.1);
  assert.equal(oddsFromText('SP'), null);
  assert.equal(oddsFromText('1.00'), null, 'a price of 1.00 is not a price');
  assert.equal(oddsFromText(null), null);
  const r = good(slip({ legs: [leg({ oddsText: 'SP', odds: null })] }));
  assert.equal(r.legs[0].odds, null);
});

test('a confidence the reader did not recognise is low, never high', () => {
  for (const v of ['certain', 'very high', 'HIGH', '', null, undefined, 1, {}]) {
    assert.equal(asConfidence(v), 'low', `${JSON.stringify(v)} was treated as better than low`);
  }
  assert.equal(asConfidence('high'), 'high');
  assert.equal(asConfidence('medium'), 'medium');
});

// ------------------------------------------------------------- multiples

test('a treble is read as three legs', () => {
  const r = good(slip({
    shape: 'treble',
    legs: [leg({ selection: 'A' }), leg({ selection: 'B' }), leg({ selection: 'C' })],
  }));
  assert.equal(r.legs.length, 3);
  assert.equal(r.shape, 'treble');
  assert.equal(r.lines, 1);
});

test('a treble that read two legs is REFUSED, not written as a double', () => {
  const out = normaliseRead(slip({
    shape: 'treble', legs: [leg({ selection: 'A' }), leg({ selection: 'B' })],
  }), GBP);
  assert.equal(out.ok, false);
  if (out.ok) return;
  assert.equal(out.reason, 'legs_missing');
  assert.match(out.detail ?? '', /3 selections and 2/);
});

test('a leg with a price and no selection does not fill a slot on a multiple', () => {
  assert.equal(refused(slip({
    shape: 'double', legs: [leg({ selection: 'A' }), leg({ selection: null })],
  })), 'legs_missing');
});

test('a perm carries its line count, and each way doubles it', () => {
  const four = [leg({ selection: 'A' }), leg({ selection: 'B' }), leg({ selection: 'C' }), leg({ selection: 'D' })];
  assert.equal(good(slip({ shape: 'Lucky 15', legs: four })).lines, 15);
  assert.equal(good(slip({ shape: 'yankee', legs: four })).lines, 11);
  assert.equal(good(slip({ shape: 'Lucky 15', legs: four, isEachWay: true })).lines, 30);
});

test('an each way slip with no place terms asks rather than assuming a fifth the odds', () => {
  const r = good(slip({ isEachWay: true, ewTerms: null }));
  assert.ok(r.notLegible.includes('ewterms'));
  const terms = toFields(r).find((f) => f.key === 'ewterms')!;
  assert.equal(terms.value, '');
  assert.equal(terms.confidence, 'missing');
  assert.ok(terms.question && terms.required);
});

test('the shapes the slips actually say are recognised, and nothing else is invented', () => {
  assert.equal(shapeFor('Lucky 15')?.id, 'lucky15');
  assert.equal(shapeFor('ACCA')?.id, 'accumulator');
  assert.equal(shapeFor('same game multi')?.id, 'bet_builder');
  assert.equal(shapeFor('quadruple'), null);
  assert.equal(shapeFor(null), null);
  const r = good(slip({ shape: 'quadruple' }));
  assert.equal(r.shape, null, 'an unrecognised bet type was mapped to a real one');
});

// ------------------------------------------------------------- refusals

test('an image that is not a betting slip is refused', () => {
  assert.equal(refused({ isSlip: false }), 'not_a_slip');
  assert.equal(refused(slip({ isSlip: 'yes' })), 'not_a_slip', 'anything but true is not a slip');
});

test('a photograph of a screen is refused with its own reason', () => {
  assert.equal(refused(slip({ capture: 'photo_of_screen' })), 'photo_of_screen');
  // A photograph of a paper slip is a normal thing to send and is not refused.
  assert.equal(good(slip({ capture: 'photo_of_paper' })).capture, 'photo_of_paper');
});

test('a stake cropped off the edge is refused, and never filled in from the rest', () => {
  assert.equal(refused(slip({ stakeText: null, stakePence: null, cutOff: ['stake row'] })), 'stake_cropped');
  // The same missing stake WITHOUT the crop signal is a question, not a refusal.
  assert.equal(good(slip({ stakeText: null, stakePence: null })).stakePence, null);
});

test('a slip in another currency is refused and nothing is converted', () => {
  const out = normaliseRead(slip({ stakeText: '€10,00', currency: 'EUR', stakePence: 1000 }), GBP);
  assert.equal(out.ok, false);
  if (out.ok) return;
  assert.equal(out.reason, 'currency_mismatch');
  assert.match(out.detail ?? '', /EUR/);
  assert.match(out.detail ?? '', /GBP/);
  // The same slip on a euro account reads, in euros, unconverted.
  const r = good(slip({ stakeText: '€10,00', currency: 'EUR', stakePence: 1000 }), EUR);
  assert.equal(r.currency, 'EUR');
  assert.equal(r.stakePence, 1000);
});

test('the printed symbol beats the field, so a mislabelled currency still refuses', () => {
  assert.equal(refused(slip({ stakeText: '€10,00', currency: 'GBP' }), GBP), 'currency_mismatch');
});

test('an answer that is not a shape at all is unparsable rather than empty', () => {
  assert.equal(refused(null), 'unparsable');
  assert.equal(refused('{}'), 'unparsable');
  assert.equal(refused([]), 'unparsable');
  assert.equal(refused(42), 'unparsable');
});

test('every refusal the reader can produce has copy, and every one says what to do next', () => {
  const reasons: SlipRefusal[] = [
    'no_file', 'too_large', 'unsupported_type', 'not_configured', 'unreachable',
    'refused', 'unparsable', 'not_a_slip', 'photo_of_screen', 'stake_cropped',
    'currency_mismatch', 'legs_missing', 'trial_spent', 'read_only',
  ];
  assert.deepEqual(Object.keys(REFUSAL_COPY).sort(), [...reasons].sort());
  for (const r of reasons) {
    const c = REFUSAL_COPY[r];
    assert.ok(c.tag.length > 2 && c.tag === c.tag.toUpperCase(), `${r} has no scannable tag`);
    assert.ok(c.title.length > 10, `${r} has no title`);
    assert.ok(c.message.length > 20, `${r} does not say what happened`);
    assert.ok(c.fix.length > 20, `${r} is a dead end: no next step`);
    for (const s of [c.tag, c.title, c.message, c.fix]) {
      assert.ok(!s.includes('—'), `${r} has an em dash in it`);
    }
  }
});

// ---------------------------------------------------- the file, before the read

test('the upload guards refuse by name, and the picker is one list longer', () => {
  assert.equal(checkUpload({ type: 'image/png', size: 1000, name: 'a.png' }), null);
  assert.equal(checkUpload({ type: 'image/png', size: 0, name: 'a.png' }), 'no_file');
  assert.equal(checkUpload({ type: 'image/png', size: MAX_UPLOAD_BYTES, name: 'a.png' }), null);
  assert.equal(checkUpload({ type: 'image/png', size: MAX_UPLOAD_BYTES + 1, name: 'a.png' }), 'too_large');
  assert.equal(checkUpload({ type: 'text/plain', size: 10, name: 'a.txt' }), 'unsupported_type');
  assert.equal(checkUpload({ type: 'image/heic', size: 10, name: 'a.heic' }), 'unsupported_type');

  // HEIC is picked and converted in the browser, so the picker takes it.
  assert.equal(checkPick({ type: 'image/heic', size: 10, name: 'a.heic' }), null);
  assert.equal(checkPick({ type: 'text/plain', size: 10, name: 'a.txt' }), 'unsupported_type');
  assert.equal(checkPick({ type: '', size: 10, name: 'slip.HEIC' }), null);
  assert.equal(checkPick({ type: '', size: 10, name: 'slip.exe' }), 'unsupported_type');
});

test('a media type is normalised to what the reader is actually sent', () => {
  assert.equal(normaliseType('image/jpg'), 'image/jpeg');
  assert.equal(normaliseType('IMAGE/PNG; charset=binary'), 'image/png');
  assert.equal(normaliseType('', 'slip.pdf'), 'application/pdf');
  assert.equal(normaliseType('', 'slip.heic'), null);
  assert.equal(normaliseType('application/zip', 'slip.zip'), null);
});

test('a file the reader cannot open never becomes a request', () => {
  assert.equal(contentBlockFor('x', 'image/heic'), null);
  assert.equal(contentBlockFor('x', 'text/plain'), null);
  const pdf = contentBlockFor('x', 'application/pdf') as Record<string, unknown>;
  assert.equal(pdf.type, 'document', 'a PDF sent as an image comes back refused by the far end');
  assert.equal((contentBlockFor('x', 'image/png') as Record<string, unknown>).type, 'image');
});

test('with no key configured the reader says so and never pretends to read', async () => {
  const had = { v: process.env.VISION_API_KEY, a: process.env.ANTHROPIC_API_KEY };
  delete process.env.VISION_API_KEY;
  delete process.env.ANTHROPIC_API_KEY;
  assert.equal(readerReady(), false);
  const out = await readSlip('x', 'image/png', GBP);
  assert.equal(out.ok, false);
  if (!out.ok) assert.equal(out.reason, 'not_configured');
  if (had.v) process.env.VISION_API_KEY = had.v;
  if (had.a) process.env.ANTHROPIC_API_KEY = had.a;
});

test('an unreadable file is refused before any request is made', async () => {
  const had = process.env.VISION_API_KEY;
  // A placeholder, so the code path past the key check can be reached. The
  // media type is refused before anything is sent anywhere.
  process.env.VISION_API_KEY = 'placeholder-not-a-key';
  const out = await readSlip('x', 'image/heic', GBP);
  assert.equal(out.ok, false);
  if (!out.ok) assert.equal(out.reason, 'unsupported_type');
  if (had === undefined) delete process.env.VISION_API_KEY; else process.env.VISION_API_KEY = had;
});

// ------------------------------------------------------------- the screen

test('a field the reader was not sure of arrives EMPTY, with a question on it', () => {
  const r = good(slip({ stakeText: null, stakePence: null, bookmaker: null, placedAt: null }));
  const fields = toFields(r);
  for (const f of fields) {
    if (f.confidence === 'high') {
      assert.ok(f.value.length > 0, `${f.key} is read cleanly and empty at the same time`);
    } else {
      assert.equal(f.value, '', `${f.key} arrived with a guess already in the box`);
      assert.ok(f.question, `${f.key} is uncertain and asks nothing`);
    }
  }
  const stake = fields.find((f) => f.key === 'stake')!;
  assert.equal(stake.confidence, 'missing');
  assert.ok(stake.required);
});

test('nothing on the review screen ever renders as undefined, NaN or null', () => {
  const r = good(slip({
    shape: 'treble', stakeText: null, stakePence: null, placedAt: null, bookmaker: null,
    legs: [leg({ selection: 'A' }), leg({ selection: 'B', oddsText: null, odds: null }), leg({ selection: 'C' })],
  }));
  const read = toRead(r, { id: 'abc', currency: 'GBP' });
  const text = JSON.stringify(read);
  for (const bad of ['undefined', 'NaN', '"null"']) {
    assert.ok(!text.includes(bad), `${bad} reached the review screen`);
  }
  assert.equal(read.stakeMinor, null);
  assert.equal(read.legs[1].odds, '', 'an unread price rendered as a number');
  assert.equal(read.legs.length, 3);
});

test('a stake that reads cleanly reaches the screen as integer minor units', () => {
  const read = toRead(good(slip({ stakeText: '£7.50', stakePence: 750 })), { id: 'abc', currency: 'GBP' });
  assert.equal(read.stakeMinor, 750);
  assert.ok(Number.isInteger(read.stakeMinor));
  assert.equal(read.lines, 1);
});

test('the legs the screen shows are the legs the reader read', () => {
  const r = good(slip({
    shape: 'double',
    legs: [leg({ selection: 'A', oddsText: '2/1', odds: 3 }), leg({ selection: 'B', oddsText: '6/4', odds: 2.5 })],
  }));
  assert.deepEqual(toLegs(r).map((l) => l.odds), ['3.00', '2.50']);
});

// ------------------------------------------------------------- the secret

test('the reader never logs, and never puts the key anywhere but the header', () => {
  const src = readFileSync('lib/server/vision.ts', 'utf8');
  assert.ok(!/console\.\w+\(/.test(src), 'the reader logs, and the repository is public');
  const uses = [...src.matchAll(/\bkey\b/g)].length;
  assert.ok(uses > 0);
  // The only place the value is written is the x-api-key header.
  const header = [...src.matchAll(/'x-api-key':\s*key/g)].length;
  assert.equal(header, 1);
  for (const shape of [/message:\s*[^\n]*key/, /return[^\n]*\bkey\b[^\n]*message/]) {
    assert.ok(!shape.test(src), 'the key appears in something a caller can read');
  }
});

// ---------------------------------------------------------- duplicates

/*  DUPLICATE DETECTION USED TO HASH THE IMAGE. `slip_images.sha256` was the
 *  only check, so two screenshots of one slip were two files, both saved, and
 *  every aggregate counted the bet twice. What identifies a bet is the bet. */

const identity = (over: Partial<BetIdentity> = {}): BetIdentity => ({
  bookmaker: 'bet365',
  selection: 'Arsenal',
  stakeMinor: 1000,
  odds: 2.5,
  eventName: 'Arsenal v Spurs',
  eventAt: '2026-08-30T13:42:00Z',
  ...over,
});

const print = (b: BetIdentity) => fingerprintSource(b);

test('two screenshots of one slip are two files and ONE bet', () => {
  /*  The same bet as two different reads: different casing, punctuation the
   *  second crop picked up, and seconds on the timestamp. The file hashes
   *  differ by construction, because the files differ. The bet does not. */
  const first = identity();
  const second = identity({
    bookmaker: 'BET365',
    selection: '  arsenal  ',
    eventName: 'Arsenal v. Spurs',
    eventAt: '2026-08-30T13:42:41Z',
  });
  assert.equal(print(second), print(first));
});

test('every field of the bet is in the fingerprint, so a real second bet is its own bet', () => {
  const base = print(identity());
  for (const [what, over] of [
    ['bookmaker', { bookmaker: 'smarkets' }],
    ['selection', { selection: 'Spurs' }],
    ['stake', { stakeMinor: 2000 }],
    ['price', { odds: 2.6 }],
    ['event', { eventName: 'Chelsea v Fulham' }],
    ['event time', { eventAt: '2026-08-30T15:00:00Z' }],
  ] as [string, Partial<BetIdentity>][]) {
    assert.notEqual(print(identity(over)), base, `${what} does not change the fingerprint`);
  }
});

test('a missing stake or price does not make every unread slip the same bet', () => {
  // Not a rule about matching, a rule about what CAN match: the route refuses
  // to look one up at all without both, and this is the shape it checks.
  const blank = identity({ stakeMinor: null, odds: null });
  assert.equal(blank.stakeMinor, null);
  assert.equal(blank.odds, null);
  assert.notEqual(print(blank), print(identity()));
});

test('a change of recipe cannot silently pair up bets taken under the old one', () => {
  assert.ok(print(identity()).startsWith('v1|'));
});

test('the bet a slip read would become is built the same way on both sides', () => {
  /*  identityOf is the one recipe. A fingerprint taken one way when the slip
   *  is read and another way when the bet is saved would never match itself,
   *  which is a duplicate check that never fires. */
  const read = identityOf({
    bookmaker: 'bet365',
    stakePerLineMinor: 500,
    lines: 2,
    eventAt: '2026-08-30T13:42:00Z',
    legs: [
      { selection: 'Arsenal', fixture: 'Arsenal v Spurs', odds: 2.5 },
      { selection: 'Chelsea', fixture: 'Chelsea v Fulham', odds: 2 },
    ],
  });
  assert.equal(read.selection, 'Arsenal / Chelsea', 'the legs join the way the bets table stores them');
  assert.equal(read.stakeMinor, 1000, 'the stake is per line times the lines, in minor units');
  assert.ok(Number.isInteger(read.stakeMinor));
  assert.equal(read.odds, 5, 'the price of a multiple is the product of its legs');
  assert.equal(read.eventName, 'Arsenal v Spurs', 'the first fixture names the bet');

  // A leg whose price was not read leaves the whole bet unpriced rather than
  // fingerprinting it at a price nobody read.
  const unpriced = identityOf({
    bookmaker: 'bet365', stakePerLineMinor: 500, lines: 1, eventAt: null,
    legs: [{ selection: 'Arsenal', fixture: 'Arsenal v Spurs', odds: null }],
  });
  assert.equal(unpriced.odds, null);
});

test('a duplicate 23 hours apart matches and one 25 hours apart does not', () => {
  /*  Two shots of one slip arrive within hours. The same fingerprint a week
   *  later is a different occasion: an annual fixture at the same time, a
   *  re-import, or somebody who backs the same horse every year. */
  const now = new Date('2026-08-31T12:00:00Z');
  const hoursAgo = (h: number) => new Date(now.getTime() - h * 3600000).toISOString();

  assert.equal(withinDuplicateWindow(hoursAgo(23), now), true);
  assert.equal(withinDuplicateWindow(hoursAgo(25), now), false);
  assert.equal(withinDuplicateWindow(hoursAgo(0.5), now), true);
  assert.equal(withinDuplicateWindow(hoursAgo(24), now), false, 'the far end is exclusive');
  assert.equal(DUPLICATE_WINDOW_MS, 24 * 3600 * 1000);

  // The query is handed this exact value, so the boundary the test pins is
  // the boundary the database applies.
  assert.equal(duplicateCutoff(now), '2026-08-30T12:00:00.000Z');
  assert.ok(hoursAgo(23) > duplicateCutoff(now));
  assert.ok(hoursAgo(25) < duplicateCutoff(now));
});

test('the duplicate answer says which check found it, and never ends the journey', () => {
  const src = readFileSync('app/api/extract/route.ts', 'utf8');
  // The image hash survives as a fast path, and is no longer the only check.
  assert.match(src, /slip_images/, 'the fast path on the file itself was dropped');
  assert.match(src, /bet_fingerprint/, 'the bet is not fingerprinted');
  assert.match(src, /matchedOn: 'image'/);
  assert.match(src, /matchedOn: 'bet'/);
  // Asking, not skipping: the read still comes back with the match on it.
  assert.match(src, /read\.duplicateOf = await betAlreadyThere/);

  const review = readFileSync('components/app/ReviewSlip.tsx', 'utf8');
  assert.match(review, /heldOnDuplicate/, 'the review screen saves a duplicate without asking');
  const analysing = readFileSync('components/app/Analysing.tsx', 'utf8');
  assert.match(analysing, /Read it anyway/, 'an identical file is still a dead end');
});

// ------------------------------------------------- the bookmaker's template

/*  THE TEMPLATE IS DECIDED BEFORE ANY FIELD IS PARSED, and it is decided by
 *  the signature table rather than by the model's answer to "which bookmaker
 *  is this". Nothing else in normaliseRead believes the model on its own
 *  word, and a bookmaker is the field it is least safe to believe on:
 *  whether a whole handicap line pushes or loses differs by book, so a wrong
 *  one is a wrongly graded bet rather than a cosmetic slip. */

test('the bookmaker comes off the slip text, not off the models opinion', () => {
  const r = good(slip({
    bookmaker: 'Paddy Power',
    bookmakerConfidence: 'high',
    slipText: 'bet365 Bet Receipt Ref: O/0938471 Bet Credits £0.00',
  }));
  assert.equal(r.template.bookmakerId, 'bet365', 'the table read the slip, not the label');
  assert.equal(r.bookmaker, 'bet365');
  assert.equal(r.bookmakerConfidence, 'high');
});

test('a model that names a bookmaker nothing on the slip supports is not believed', () => {
  /*  The failure this replaces: a model that infers "bet365" from a Premier
   *  League fixture and scores itself high, and a ledger that files the bet
   *  under Asian handicaps because of it. */
  const r = good(slip({
    bookmaker: 'bet365',
    bookmakerConfidence: 'high',
    slipText: 'Bet Slip. Single. Cash Out available. Total Stake £5.00',
  }));
  assert.equal(r.template.bookmakerId, 'unknown');
  assert.equal(r.bookmakerConfidence, 'low', 'an unrecognised template is never read cleanly');
});

test('the bookmaker field asks, with what it saw beside the question', () => {
  const r = good(slip({
    bookmaker: null,
    slipText: 'Bet Slip. Total Stake £5.00',
  }));
  const f = toFields(r).find((x) => x.key === 'bookmaker');
  assert.ok(f);
  assert.equal(f.value, '', 'nothing is filled in from a guess');
  assert.ok(f.question, 'and there is a question to answer');
  assert.equal(f.required, true);
});

test('a slip whose header was cropped is still recognised from its own wording', () => {
  /*  The header is the first thing off the top of a screenshot, and the book
   *  prints its own words further down as well. */
  const r = good(slip({
    bookmaker: null,
    slipText: 'Acca Freeze available. Bet ID: 9930-2214-77',
    legs: [{ selection: 'Man City', eventName: 'Man City v Arsenal', marketRaw: 'Match result', oddsText: '2.10', odds: 2.1, confidence: 'high' }],
  }));
  assert.equal(r.template.bookmakerId, 'unknown', 'Sky Bet features without the name are not Sky Bet');

  const named = good(slip({
    bookmaker: null,
    slipText: 'Sky Bet. Acca Freeze available. Bet ID: 9930-2214-77',
  }));
  assert.equal(named.template.bookmakerId, 'sky-bet');
});

test('the read hands the id on, not the display name', () => {
  const r = good(slip({ bookmaker: null, slipText: 'Betfair Exchange. Matched at 3.40. Commission 2%' }));
  const read = toRead(r, { id: 'abc', currency: 'GBP' });
  assert.equal(read.bookmakerId, 'betfair-exchange');
  assert.equal(read.bookmaker, 'Betfair Exchange');
  assert.ok(read.templateMatched.length > 0, 'the evidence travels with it');
});

/*  ------------------------------------------------ promotions, at ingestion
 *
 *  A free bet, bonus funds and a boost are three different things and every
 *  one changes what a bet is worth. Three weeks later a 25 pound stake at 3.0
 *  that returned 50 says nothing about whether the 25 was the account
 *  holder's. The slip knows, once, and only at ingestion. */

test('a free bet is read off the slip, under any of the names it goes by', () => {
  for (const text of [
    'Free Bet applied',
    'FREE BET STAKE NOT RETURNED',
    '£10 Bet Credits used',
    'Risk-free bet',
    'Returns exclude stake. S.N.R.',
  ]) {
    const p = detectPromotions(text);
    assert.equal(p.freeBet, true, text);
    assert.ok(p.matched.length > 0, `${text} has to say what it saw`);
  }
});

test('bonus funds need the word beside something that names a balance', () => {
  assert.equal(detectPromotions('Paid from Bonus Funds').bonusFunds, true);
  assert.equal(detectPromotions('Staked using your bonus balance').bonusFunds, true);
  assert.equal(detectPromotions('Wagering requirement 1x').bonusFunds, true);
});

test('a Lucky 15 odds bonus is not bonus funds', () => {
  /*  bet365 prints "BONUS 1/4 2x" on a Lucky 15, which doubles the odds on a
      single winner. It is a bonus on the PRICE and not a penny of bonus
      money, and reading it as bonus funds would take a real stake out of
      turnover and stop a real loss counting. */
  const p = detectPromotions('LUCKY 15 BONUS 1/4 2x CONSOLATION');
  assert.equal(p.bonusFunds, false);
  assert.equal(p.freeBet, false);
});

test('a boost is read and is never confused with either of the other two', () => {
  const p = detectPromotions('PRICE BOOST was 2.50 now 3.00');
  assert.equal(p.boosted, true);
  assert.equal(p.freeBet, false);
  assert.equal(p.bonusFunds, false);
});

test('a free bet beats bonus funds when a slip says both', () => {
  /*  "Free bet placed from your bonus balance" is a free bet whose token sat
      in the bonus wallet. The stake of a free bet is not returned, and that
      is the fact the arithmetic turns on, so it wins the tie. */
  const p = detectPromotions('Free Bet placed from your bonus balance');
  assert.equal(p.freeBet, true);
  assert.equal(p.bonusFunds, false);
});

test('a slip with no promotion on it flags nothing', () => {
  const p = detectPromotions('Bet Receipt · Single · Arsenal to win · £25.00 at 2.50');
  assert.deepEqual(p, { freeBet: false, bonusFunds: false, boosted: false, matched: [] });
  assert.deepEqual(detectPromotions(null), { freeBet: false, bonusFunds: false, boosted: false, matched: [] });
});
