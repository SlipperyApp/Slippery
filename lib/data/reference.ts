/** Reference data: bookmakers, sports, markets, competitions.
 *
 *  Nothing the account can set is hardcoded at a call site. These are the
 *  defaults a new account starts with, and every one of them is editable. */

import type { Bookmaker, SportId } from '@/lib/domain/types';

export const SPORTS: { id: SportId; name: string; icon: 'football' | 'tennis' | 'horse' }[] = [
  { id: 'football', name: 'Football', icon: 'football' },
  { id: 'tennis', name: 'Tennis', icon: 'tennis' },
  { id: 'horse-racing', name: 'Horse racing', icon: 'horse' },
];

/** Grouped the way the bookmakers themselves group, because a Flutter brand
 *  and a Kambi brand lay their slips out differently and the reader picks the
 *  template before it parses. */
export const BOOKMAKER_GROUPS: { group: string; books: { id: string; name: string; commissionPct?: number; handicapStyle?: 'asian' | 'european' }[] }[] = [
  {
    group: 'Flutter',
    books: [
      { id: 'paddy-power', name: 'Paddy Power' },
      { id: 'sky-bet', name: 'Sky Bet' },
      { id: 'betfair', name: 'Betfair Sportsbook', handicapStyle: 'asian' },
      { id: 'betfair-exchange', name: 'Betfair Exchange', commissionPct: 2, handicapStyle: 'asian' },
    ],
  },
  {
    group: 'Kambi',
    books: [
      { id: 'unibet', name: 'Unibet' },
      { id: 'bet-victor', name: 'BetVictor' },
      { id: '888sport', name: '888sport' },
    ],
  },
  {
    group: 'Entain',
    books: [
      { id: 'ladbrokes', name: 'Ladbrokes' },
      { id: 'coral', name: 'Coral' },
      { id: 'betdaq', name: 'BETDAQ', commissionPct: 2, handicapStyle: 'asian' },
    ],
  },
  {
    group: 'Other',
    books: [
      { id: 'bet365', name: 'bet365', handicapStyle: 'asian' },
      { id: 'william-hill', name: 'William Hill' },
      { id: 'betfred', name: 'Betfred' },
      { id: 'boylesports', name: 'BoyleSports' },
      { id: 'smarkets', name: 'Smarkets', commissionPct: 2, handicapStyle: 'asian' },
      { id: 'matchbook', name: 'Matchbook', commissionPct: 1.5, handicapStyle: 'asian' },
      { id: 'shop', name: 'Betting shop' },
    ],
  },
];

export const ALL_BOOKMAKERS = BOOKMAKER_GROUPS.flatMap((g) =>
  g.books.map((b) => ({ ...b, group: g.group })));

/** What a bet is filed under when the slip did not say and nobody answered.
 *
 *  It is here and not at a call site because a bet is fingerprinted on both
 *  sides of an upload: once when the slip is read and once when it is saved.
 *  A default applied on only one of those two is a duplicate check that
 *  cannot match its own writes. */
export const DEFAULT_BOOKMAKER_ID = 'bet365';

export function bookmakerName(id: string): string {
  return ALL_BOOKMAKERS.find((b) => b.id === id)?.name ?? id;
}

/** An id, from whatever a caller happens to be holding.
 *
 *  THE COLUMN STORES AN ID AND THREE CALLERS WERE HOLDING A NAME. The review
 *  screen sent whatever string the reader printed, so "Betfair Exchange" went
 *  into bookmaker_id, where nothing could look it up: not the commission
 *  rate, not the handicap convention, not the breakdown row. It reads as a
 *  bookmaker on the row and behaves as one nowhere else.
 *
 *  It returns null rather than a default. Deciding that an unrecognised name
 *  is bet365 is the silent guess the whole reader refuses, and the caller
 *  that genuinely needs a value can say so at its own call site. */
export function resolveBookmakerId(value: string): string | null {
  const v = value.trim().toLowerCase();
  if (!v) return null;
  const byId = ALL_BOOKMAKERS.find((b) => b.id === v);
  if (byId) return byId.id;
  /*  Punctuation and spacing differ between "BetVictor", "Bet Victor" and
      "bet-victor", and none of those differences is a different bookmaker. */
  const flat = v.replace(/[^a-z0-9]/g, '');
  return ALL_BOOKMAKERS.find(
    (b) => b.name.toLowerCase().replace(/[^a-z0-9]/g, '') === flat
      || b.id.replace(/[^a-z0-9]/g, '') === flat,
  )?.id ?? null;
}

export function defaultBookmakers(accountId: string): Bookmaker[] {
  return ALL_BOOKMAKERS.map((b) => ({
    id: b.id,
    accountId,
    name: b.name,
    groupName: b.group,
    commissionPct: b.commissionPct ?? 0,
    enabled: true,
    isCustom: false,
    handicapStyle: b.handicapStyle ?? 'european',
  }));
}

/** Market groups. Aliases collapse the bookmakers' own wording so the By
 *  market breakdown is not thirty rows of the same thing. */
export const MARKET_GROUPS: { id: string; name: string; aliases: string[] }[] = [
  { id: 'match-result', name: 'Match result', aliases: ['1x2', 'full time result', 'match odds', 'to win', 'moneyline', 'winner'] },
  { id: 'totals', name: 'Goals over/under', aliases: ['over/under', 'total goals', 'goals o/u', 'over', 'under'] },
  { id: 'handicap', name: 'Handicap', aliases: ['asian handicap', 'handicap', 'hcp', 'ah', 'spread'] },
  { id: 'btts', name: 'Both teams to score', aliases: ['btts', 'both to score', 'goal/goal'] },
  { id: 'double-chance', name: 'Double chance', aliases: ['double chance', '1x', 'x2', '12'] },
  { id: 'correct-score', name: 'Correct score', aliases: ['correct score', 'cs'] },
  { id: 'player', name: 'Player markets', aliases: ['anytime scorer', 'first scorer', 'shots', 'assists', 'cards', 'to be carded'] },
  { id: 'race-win', name: 'Race winner', aliases: ['win', 'to win race', 'outright'] },
  { id: 'race-ew', name: 'Race each way', aliases: ['each way', 'e/w', 'ew'] },
  { id: 'set-betting', name: 'Set betting', aliases: ['set betting', 'correct sets', '2-0', '2-1'] },
  { id: 'game-handicap', name: 'Game handicap', aliases: ['game handicap', 'games hcp'] },
];

export function marketGroupFor(marketRaw: string): string {
  const m = marketRaw.toLowerCase();
  for (const g of MARKET_GROUPS) {
    if (g.aliases.some((a) => m.includes(a))) return g.id;
  }
  return 'match-result';
}

export function marketGroupName(id: string): string {
  return MARKET_GROUPS.find((g) => g.id === id)?.name ?? id;
}

/*  THE ACCOUNT'S TIME ZONE, and why it is a short list rather than the whole
 *  IANA database.
 *
 *  A calendar day is the most looked at thing in this product and it has to
 *  be the day the person betting was living in. Europe/London and
 *  Europe/Dublin keep the same clock, so the pair reads as one choice; every
 *  other zone here is somewhere a UK or Irish account holder is plausibly
 *  reading their own ledger from, and each one shifts a late kick off onto a
 *  different day from the server's.
 *
 *  A zone outside this list is still accepted if the platform knows it, so an
 *  account restored from elsewhere is never silently moved. What the list
 *  decides is what the picker offers. */
export const TIME_ZONES: { id: string; label: string; clock: string }[] = [
  /*  `label` names the place, which is what somebody picks from a list.
   *  `clock` is the same fact as an adjective, because the line under the
   *  sidebar says "Times in ___" and "Times in United Kingdom time" is not a
   *  sentence anybody would write. Two fields rather than one clever
   *  template: English does not derive one from the other. */
  { id: 'Europe/London', label: 'United Kingdom', clock: 'UK time' },
  { id: 'Europe/Dublin', label: 'Ireland', clock: 'Irish time' },
  { id: 'Atlantic/Canary', label: 'Canary Islands', clock: 'Canary Islands time' },
  { id: 'Europe/Lisbon', label: 'Portugal', clock: 'Portuguese time' },
  { id: 'Europe/Madrid', label: 'Spain', clock: 'Spanish time' },
  { id: 'Europe/Paris', label: 'France', clock: 'French time' },
  { id: 'Europe/Amsterdam', label: 'Netherlands', clock: 'Dutch time' },
  { id: 'Europe/Berlin', label: 'Germany', clock: 'German time' },
  { id: 'Europe/Malta', label: 'Malta', clock: 'Maltese time' },
  { id: 'Europe/Athens', label: 'Greece', clock: 'Greek time' },
  { id: 'Asia/Dubai', label: 'United Arab Emirates', clock: 'UAE time' },
  { id: 'America/New_York', label: 'United States, eastern', clock: 'US eastern time' },
  { id: 'Australia/Sydney', label: 'Australia, eastern', clock: 'eastern Australian time' },
  { id: 'UTC', label: 'UTC', clock: 'UTC' },
];

export function timeZoneLabel(id: string): string {
  return TIME_ZONES.find((z) => z.id === id)?.label ?? id.replace(/_/g, ' ');
}

/** The zone as the strap line says it: "Times in Irish time". A zone outside
 *  the list falls back to its own IANA name, which is honest and ugly, and is
 *  what an account restored from somewhere else should show rather than a
 *  guess at the country. */
export function timeZoneClock(id: string): string {
  return TIME_ZONES.find((z) => z.id === id)?.clock ?? id.replace(/_/g, ' ');
}

export const COMPETITIONS: Record<SportId, string[]> = {
  football: ['Premier League', 'Championship', 'League of Ireland', 'Champions League', 'Serie A', 'La Liga', 'Scottish Premiership', 'FA Cup'],
  tennis: ['ATP Tour', 'WTA Tour', 'Grand Slam', 'Challenger'],
  'horse-racing': ['Cheltenham', 'Aintree', 'Ascot', 'Leopardstown', 'Punchestown', 'Newmarket', 'Curragh', 'Doncaster'],
};

/** The odds band module is ORDERED and never sorted by value: its read
 *  depends on the order being preserved. */
export const ODDS_BANDS: { id: string; label: string; min: number; max: number }[] = [
  { id: 'odds-on', label: 'Under 1.50', min: 1, max: 1.5 },
  { id: 'short', label: '1.50 to 2.00', min: 1.5, max: 2 },
  { id: 'even', label: '2.00 to 3.00', min: 2, max: 3 },
  { id: 'mid', label: '3.00 to 5.00', min: 3, max: 5 },
  { id: 'long', label: '5.00 to 10.00', min: 5, max: 10 },
  { id: 'very-long', label: '10.00 and up', min: 10, max: Infinity },
];

export function oddsBand(odds: number): string {
  return ODDS_BANDS.find((b) => odds >= b.min && odds < b.max)?.id ?? 'very-long';
}

/** Stake ranges derive from the UNIT, not from pounds, because pound buckets
 *  break the moment somebody changes their unit. Ordered, never sorted. */
export const STAKE_BANDS: { id: string; label: string; min: number; max: number }[] = [
  { id: 'under-half', label: 'Under 0.5u', min: 0, max: 0.5 },
  { id: 'half-one', label: '0.5u to 1u', min: 0.5, max: 1 },
  { id: 'one-two', label: '1u to 2u', min: 1, max: 2 },
  { id: 'two-five', label: '2u to 5u', min: 2, max: 5 },
  { id: 'over-five', label: 'Over 5u', min: 5, max: Infinity },
];

export function stakeBand(stakePence: number, unitPence: number): string {
  const u = stakePence / (unitPence || 1);
  return STAKE_BANDS.find((b) => u >= b.min && u < b.max)?.id ?? 'over-five';
}
