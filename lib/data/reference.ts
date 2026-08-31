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

export function bookmakerName(id: string): string {
  return ALL_BOOKMAKERS.find((b) => b.id === id)?.name ?? id;
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
