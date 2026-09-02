import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  detectTemplate, BOOKMAKER_TEMPLATES, TEMPLATE_FLOOR, TEMPLATE_MARGIN,
} from '@/lib/data/importing';
import { ALL_BOOKMAKERS, resolveBookmakerId } from '@/lib/data/reference';

/*  A REALISTIC FRAGMENT PER BOOKMAKER.
 *
 *  Each of these is the chrome off one slip: the wordmark, the reference
 *  line, the promotion wording and the totals, in roughly the order that
 *  book prints them, with a selection or two in the middle. They are the
 *  input the detector actually gets, which is text a reader transcribed
 *  rather than a tidy label.
 *
 *  A permed bet is in several of them on purpose. A Lucky 15 is the case the
 *  detector exists for: one stake, four selections and fifteen lines, laid
 *  out differently by every book, and read without knowing whose slip it is
 *  the stake comes out fifteen times too big or fifteen times too small. */
const SLIPS: { id: string; text: string }[] = [
  {
    id: 'bet365',
    text: [
      'bet365   Bet Receipt',
      'Ref: O/0938471/0021',
      'Lucky 15   15 x £1.00',
      'Constitution Hill  2/1   14:30 Cheltenham',
      'State Man  11/4   15:05 Leopardstown',
      'Total Stake £15.00     To Return £0.00',
      'Bet Credits available: £0.00        Edit Bet',
    ].join('\n'),
  },
  {
    id: 'paddy-power',
    text: [
      'Paddy Power',
      'Bet Slip   Receipt No. PP4471982',
      'Treble  £5.00',
      'Arsenal to win  1.72',
      "Paddy's Rewards Club: 5 bets to your next £5 free bet",
      'Total Stake £5.00   Potential Returns £24.10',
    ].join('\n'),
  },
  {
    id: 'betfair',
    text: [
      'Betfair Sportsbook',
      'Bet Slip',
      'Single  £20.00  Liverpool to win  1.90',
      'Price Rush applied',
      'Potential returns £38.00',
    ].join('\n'),
  },
  {
    id: 'betfair-exchange',
    text: [
      'Betfair  Exchange',
      'My Bets   Matched   Unmatched',
      'Back  Liverpool  3.40  Matched at 3.40',
      'Stake £50.00   Liability n/a',
      'Commission 2% on net winnings',
    ].join('\n'),
  },
  {
    id: 'sky-bet',
    text: [
      'Sky Bet',
      'Bet ID: 9930-2214-77',
      'RequestABet  Haaland 2+ shots on target and Man City to win  6.50',
      'Bet Boost applied   Acca Freeze available',
      'Stake £10.00  Est. Returns £65.00',
    ].join('\n'),
  },
  {
    id: 'william-hill',
    text: [
      'William Hill',
      'Your Bet   Coupon No 88213',
      'Yankee  11 x £2.00',
      'Jonbon  4.33  16:10 Punchestown',
      'Epic Boost applied to leg 1',
      'Total stake £22.00',
    ].join('\n'),
  },
  {
    id: 'ladbrokes',
    text: [
      'Ladbrokes',
      'Bet Reference LB-77120934',
      'Odds Boost used',
      'Double  £10.00  Celtic / Rangers  4.20',
      'Grid   Est. returns £42.00',
    ].join('\n'),
  },
  {
    id: 'coral',
    text: [
      'Coral',
      'Bet Reference CR-2210488',
      'Connect card ending 4471',
      'Odds Boost available',
      'Single £25.00  Over 2.5 goals  1.83',
    ].join('\n'),
  },
  {
    id: 'boylesports',
    text: [
      'BoyleSports',
      'Docket 5518-2290',
      'Lucky 31  31 x €0.50',
      'Shamrock Rovers  1.95   Derry City  2.30',
      'Money Back Special: 2nd to SP favourite',
      'Total stake €15.50',
    ].join('\n'),
  },
  {
    id: 'bet-victor',
    text: [
      'BetVictor',
      'Bet Ref BV-004182',
      'Patent   Stake per line £2.00',
      'Price Promise applied',
      'Total stake £14.00',
    ].join('\n'),
  },
  {
    id: 'unibet',
    text: [
      'Unibet',
      'Combo  4 selections',
      'Bet Builder: Napoli to win and over 2.5 goals  3.10',
      'Money Back+ if your team leads and draws',
      'Stake £15.00  Potential payout £46.50',
    ].join('\n'),
  },
];

test('every bookmaker in the table is recognised from its own slip', () => {
  for (const slip of SLIPS) {
    const m = detectTemplate(slip.text);
    assert.equal(m.bookmakerId, slip.id, `${slip.id} read as ${m.bookmakerId} (${m.matched.join(', ')})`);
    assert.ok(m.confidence !== 'low', `${slip.id} was recognised but only weakly`);
    assert.ok(m.matched.length > 0, `${slip.id} came back with no evidence`);
  }
});

test('no slip is ever read as a different bookmaker', () => {
  /*  A WRONG TEMPLATE IS WORSE THAN NO TEMPLATE. This is the assertion that
   *  matters: every fragment against every template, and the only id that may
   *  come back is its own. */
  for (const slip of SLIPS) {
    const m = detectTemplate(slip.text);
    assert.notEqual(m.bookmakerId, 'unknown', `${slip.id} should be recognised`);
    for (const other of SLIPS) {
      if (other.id === slip.id) continue;
      assert.notEqual(m.bookmakerId, other.id, `${slip.id} was read as ${other.id}`);
    }
  }
});

test('every id in the table is a bookmaker the ledger knows', () => {
  /*  The detector and the ledger have to agree on what a bookmaker is called,
   *  or a bet is filed under a name that no commission rate, no handicap
   *  convention and no breakdown row can be looked up from. */
  for (const t of BOOKMAKER_TEMPLATES) {
    assert.ok(ALL_BOOKMAKERS.some((b) => b.id === t.id), `${t.id} is not in the bookmaker list`);
    assert.equal(resolveBookmakerId(t.id), t.id);
  }
});

test('every template has a brand signature, or it can never win', () => {
  for (const t of BOOKMAKER_TEMPLATES) {
    assert.ok(t.signatures.some((s) => s.kind === 'brand'), `${t.id} has no brand signature`);
  }
});

// ------------------------------------------------------------------ unknown

test('a slip with no bookmaker on it is unknown, not a guess', () => {
  /*  Every generic word a betting slip carries and not one name. The old
   *  behaviour of every path that needed a bookmaker was to default to
   *  bet365, which is a wrong answer that looks like a right one. */
  const m = detectTemplate([
    'Bet Slip',
    'Single  £10.00  Arsenal to win  1.80',
    'Cash Out available',
    'Total Stake £10.00   To Return £18.00',
  ].join('\n'));
  assert.equal(m.bookmakerId, 'unknown');
  assert.equal(m.confidence, 'low');
  assert.equal(m.score, 0);
});

test('feature words without a name never decide anything', () => {
  // Odds Boost is on Ladbrokes and on Coral, and on its own it is neither.
  const m = detectTemplate('Odds Boost applied. Bet Reference 88213. Total stake £10.00');
  assert.equal(m.bookmakerId, 'unknown');
});

test('two books within the margin come back unknown, with the evidence', () => {
  /*  A bare "Betfair" is a slip that could be the Sportsbook or the Exchange,
   *  and those are two different products: the Exchange charges commission on
   *  net winnings and the Sportsbook does not, so filing one as the other
   *  reports every winner about two per cent high. */
  const m = detectTemplate('Betfair\nSingle £20.00 Liverpool 1.90');
  assert.equal(m.bookmakerId, 'unknown');
  assert.deepEqual(m.matched, ['Betfair'], 'it still says what it saw');
  assert.ok(m.runnerUp, 'and that something else scored the same');
});

test('the exchange and the sportsbook are told apart by their own words', () => {
  const exchange = detectTemplate('Betfair Exchange  Matched at 3.40  Commission 2%');
  assert.equal(exchange.bookmakerId, 'betfair-exchange');
  const sportsbook = detectTemplate('Betfair Sportsbook  Price Rush  Bet Slip');
  assert.equal(sportsbook.bookmakerId, 'betfair');
});

test('empty, missing and non-text input are unknown rather than an error', () => {
  for (const junk of ['', '   ', null, undefined, 42, {}, []]) {
    const m = detectTemplate(junk as unknown);
    assert.equal(m.bookmakerId, 'unknown');
    assert.equal(m.score, 0);
  }
});

// -------------------------------------------------------------- confidence

test('a name alone is medium, a name plus something only that book prints is high', () => {
  const nameOnly = detectTemplate('BoyleSports');
  assert.equal(nameOnly.bookmakerId, 'boylesports');
  assert.equal(nameOnly.confidence, 'medium');
  assert.equal(nameOnly.score, TEMPLATE_FLOOR);

  const withFeature = detectTemplate('BoyleSports  Money Back Special');
  assert.equal(withFeature.confidence, 'high');
  assert.ok(withFeature.score - nameOnly.score >= TEMPLATE_MARGIN);
});

test('the wordmark is recognised however the slip spaces it', () => {
  for (const spelling of ['bet365', 'Bet 365', 'BET365']) {
    assert.equal(detectTemplate(`${spelling} Bet Receipt`).bookmakerId, 'bet365');
  }
  for (const spelling of ['BetVictor', 'Bet Victor']) {
    assert.equal(detectTemplate(`${spelling} Bet Ref BV-1`).bookmakerId, 'bet-victor');
  }
  for (const spelling of ['Sky Bet', 'SkyBet']) {
    assert.equal(detectTemplate(`${spelling} Bet ID 1`).bookmakerId, 'sky-bet');
  }
});

test('the permed bet fragments still name their book', () => {
  /*  The case the whole thing exists for. Three perms, three books, three
   *  layouts of the same three numbers, and each one has to be recognised
   *  before anything tries to read a stake off it. */
  const permed = SLIPS.filter((s) => /lucky 15|lucky 31|yankee|patent/i.test(s.text));
  assert.ok(permed.length >= 4, 'the fixtures should cover several perms');
  for (const p of permed) {
    const m = detectTemplate(p.text);
    assert.equal(m.bookmakerId, p.id);
    assert.equal(m.confidence, 'high');
  }
});

// ----------------------------------------------------------------- the id

test('a bookmaker resolves from a name, an id or the way a slip spells it', () => {
  assert.equal(resolveBookmakerId('bet365'), 'bet365');
  assert.equal(resolveBookmakerId('Betfair Exchange'), 'betfair-exchange');
  assert.equal(resolveBookmakerId('betvictor'), 'bet-victor');
  assert.equal(resolveBookmakerId('BoyleSports'), 'boylesports');
  assert.equal(resolveBookmakerId('  Paddy Power '), 'paddy-power');
  assert.equal(resolveBookmakerId('Not A Bookmaker'), null, 'it refuses rather than defaulting');
  assert.equal(resolveBookmakerId(''), null);
});
