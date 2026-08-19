/* THE BOOKMAKER REGISTRY.
 *
 * One row per brand, and every part of the app that needs to know
 * something about a bookmaker reads it from here.
 *
 * There were five copies of this list before, and they had already drifted
 * apart. `BOOKS` in data.js grouped brands for the settings screen.
 * `BOOKPAGES` in pages.js keyed the same brands as `paddy-power` while
 * data.js called them `Paddy Power`. `BOOK_RULES` in settlement.js was the
 * only one with behaviour attached and listed Unibet, LeoVegas and 32Red as
 * three unrelated rows with no idea they are one platform. The reader's
 * `platform` field was free text that was never matched against anything.
 * Adding a brand meant editing four files and nothing failed if you forgot
 * one, which is not a system, it is a habit.
 *
 * A row is:
 *   id        stable slug, used by the reference pages and never shown
 *   name      how the brand writes itself, which is what gets displayed
 *   provider  the platform behind it, because brands on one platform share
 *             a slip layout and a settlement style
 *   handicap  'asian' or 'european'. THIS IS A SETTLEMENT RULE and the
 *             reason the registry cannot be decoration: on bet365 a −1 on a
 *             2−1 win pushes and the stake comes back; everywhere else the
 *             handicap draw is its own outcome, so the same bet loses.
 *   aliases   what slips and exports actually say, folded the same way as
 *             the name, so "Bet 365" and "BET365" both resolve
 *
 * Adding a Kambi brand is one row. Nothing else has to change, and the
 * tests assert that every consumer sees it.
 *
 * Pure data and pure functions: no DOM, no globals. The server imports it
 * through settlement.js, which has the same rule.
 */
export const BOOKMAKERS = [
  { id: 'bet365', name: 'bet365', provider: 'In-house', handicap: 'asian',
    aliases: ['bet 365', 'b365', 'bet365.com'] },

  /* Flutter. Paddy Power and Betfair's sportsbook share a platform; the
     Betfair EXCHANGE is a different product and is not this row. */
  { id: 'paddy-power', name: 'Paddy Power', provider: 'Flutter', handicap: 'european',
    aliases: ['paddypower', 'paddy', 'pp'] },
  { id: 'betfair-sportsbook', name: 'Betfair Sportsbook', provider: 'Flutter', handicap: 'european',
    aliases: ['betfair', 'betfair sports'] },
  { id: 'sky-bet', name: 'Sky Bet', provider: 'Flutter', handicap: 'european',
    aliases: ['skybet', 'sky betting', 'sky'] },
  { id: 'pokerstars', name: 'PokerStars', provider: 'Flutter', handicap: 'european',
    aliases: ['poker stars', 'pokerstars sports'] },

  /* Kambi. One platform, many brands, one slip layout. This is the case the
     registry exists for: before it, these were three unrelated rows and
     adding a fourth brand meant discovering all four files by hand. */
  { id: 'unibet', name: 'Unibet', provider: 'Kambi', handicap: 'european',
    aliases: ['unibet.co.uk'] },
  { id: 'leovegas', name: 'LeoVegas', provider: 'Kambi', handicap: 'european',
    aliases: ['leo vegas', 'leovegas sport'] },
  { id: '32red', name: '32Red', provider: 'Kambi', handicap: 'european',
    aliases: ['32 red', '32redsport'] },
  { id: 'mrgreen', name: 'Mr Green', provider: 'Kambi', handicap: 'european',
    aliases: ['mr. green', 'mrgreen.com'] },
  { id: 'livescore-bet', name: 'LiveScore Bet', provider: 'Kambi', handicap: 'european',
    aliases: ['livescorebet', 'live score bet'] },
  { id: 'virgin-bet', name: 'Virgin Bet', provider: 'Kambi', handicap: 'european',
    aliases: ['virginbet'] },
  { id: 'betmgm-uk', name: 'BetMGM UK', provider: 'Kambi', handicap: 'european',
    aliases: ['betmgm', 'bet mgm', 'mgm'] },
  { id: 'betuk', name: 'BetUK', provider: 'Kambi', handicap: 'european',
    aliases: ['bet uk', 'betuk.com'] },
  { id: 'expekt', name: 'Expekt', provider: 'Kambi', handicap: 'european',
    aliases: ['expekt.com'] },
  { id: 'bally-bet', name: 'Bally Bet', provider: 'Kambi', handicap: 'european',
    aliases: ['ballybet', 'bally'] },
  { id: 'monopoly-casino-sports', name: 'Monopoly Casino & Sports', provider: 'Kambi', handicap: 'european',
    aliases: ['monopoly casino', 'monopoly sports', 'monopoly'] },
  { id: 'jackpotjoy-sports', name: 'Jackpotjoy Sports', provider: 'Kambi', handicap: 'european',
    aliases: ['jackpotjoy', 'jackpot joy'] },
  { id: 'rainbow-riches', name: 'Rainbow Riches', provider: 'Kambi', handicap: 'european',
    aliases: ['rainbowriches', 'rainbow riches casino'] },
  { id: 'grosvenor-sport', name: 'Grosvenor Sport', provider: 'Kambi', handicap: 'european',
    aliases: ['grosvenor', 'grosvenor sports'] },
  { id: 'casumo', name: 'Casumo', provider: 'Kambi', handicap: 'european',
    aliases: ['casumo sport', 'casumo.com'] },

  /* Entain */
  { id: 'ladbrokes', name: 'Ladbrokes', provider: 'Entain', handicap: 'european',
    aliases: ['ladbroke', 'lads'] },
  { id: 'coral', name: 'Coral', provider: 'Entain', handicap: 'european',
    aliases: ['coral.co.uk'] },
  { id: 'bwin', name: 'bwin', provider: 'Entain', handicap: 'european',
    aliases: ['bwin.com'] },

  /* Everyone else, each on their own platform. */
  { id: 'william-hill', name: 'William Hill', provider: 'In-house', handicap: 'european',
    aliases: ['williamhill', 'will hill', 'whill'] },
  { id: 'betfred', name: 'Betfred', provider: 'In-house', handicap: 'european',
    aliases: ['bet fred'] },
  { id: '888sport', name: '888sport', provider: 'In-house', handicap: 'european',
    aliases: ['888 sport', '888'] },
  { id: 'boylesports', name: 'BoyleSports', provider: 'In-house', handicap: 'european',
    aliases: ['boyle sports', 'boyles'] },

  /* Exchanges. A lay here risks liability rather than stake and commission
     is charged on net winnings, which is why they are their own platform
     rather than another sportsbook row. */
  { id: 'betfair-exchange', name: 'Betfair Exchange', provider: 'Exchange', handicap: 'european',
    aliases: ['betfair ex', 'bf exchange'] },
  { id: 'smarkets', name: 'Smarkets', provider: 'Exchange', handicap: 'european',
    aliases: ['smarket'] },
  { id: 'betvictor', name: 'BetVictor', provider: 'In-house', handicap: 'european',
    aliases: ['bet victor', 'victor'] }
];

/* Fold a name the way slips misspell it: case, spaces and punctuation all
   go. "Bet 365", "bet365" and "BET-365" are one key. */
export function bookKey(book) {
  return String(book || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

/* id and every alias, folded, pointing at the row. Built once. */
const INDEX = (() => {
  const m = new Map();
  for (const b of BOOKMAKERS) {
    m.set(bookKey(b.id), b);
    m.set(bookKey(b.name), b);
    for (const a of b.aliases || []) m.set(bookKey(a), b);
  }
  return m;
})();

/** The registry row for anything a slip, an export or a person typed. */
export function findBook(book) {
  return INDEX.get(bookKey(book)) || null;
}

/**
 * The brand's own spelling, for anything a bookmaker wrote itself.
 * Unknown names come back unchanged rather than being dropped: somebody
 * with an account at a bookmaker nobody here has heard of still has a real
 * bet, and losing the name would be worse than not knowing the platform.
 */
export function bookName(book) {
  const b = findBook(book);
  if (b) return b.name;
  const raw = String(book || '').trim();
  return raw;
}

/** The platform behind a brand, or null when it is not one we know. */
export function providerOf(book) {
  const b = findBook(book);
  return b ? b.provider : null;
}

/** Brand names grouped by platform, for the reference screens. */
export function booksByProvider() {
  const out = {};
  for (const b of BOOKMAKERS) (out[b.provider] || (out[b.provider] = [])).push(b.name);
  return out;
}

export const ALL_BOOK_NAMES = BOOKMAKERS.map(b => b.name);
