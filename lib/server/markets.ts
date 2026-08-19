/* THE 27 CANONICAL MARKET GROUPS.
 *
 * Bookmakers name the same bet a dozen ways. "Double Chance 1X",
 * "Asian Handicap Home +0.5" and "Away Win No" are one market and must land
 * in one row on the By market card, or the card reports a market somebody
 * has never heard of alongside three near-duplicates of it.
 *
 * Seeded per account so it can be edited: the master toggle, per-variant
 * remove, add alias and new group all act on the account's own copy.
 */
export type MarketGroup = { name: string; aliases: string[] };

export const MARKET_GROUPS: MarketGroup[] = [
  { name: "Home win", aliases: ["Asian Handicap Home \u22120.5", "Double Chance X2 No", "Away or Draw No", "Winning Margin Home 1+"] },
  { name: "Away win", aliases: ["Asian Handicap Away \u22120.5", "Double Chance 1X No", "Home or Draw No"] },
  { name: "Draw", aliases: ["Double Chance 12 No", "Winning Margin Draw", "Home Win No + Away Win No"] },
  { name: "Home or draw", aliases: ["Double Chance 1X", "Asian Handicap Home +0.5", "Away Win No"] },
  { name: "Draw or away", aliases: ["Double Chance X2", "Asian Handicap Away +0.5", "Home Win No"] },
  { name: "Home or away", aliases: ["Double Chance 12", "Draw No"] },
  { name: "Draw no bet, home", aliases: ["Asian Handicap Home 0"] },
  { name: "Both teams to score", aliases: ["BTTS Yes", "Both teams Over 0.5", "Neither Clean Sheet", "Home Score Yes + Away Score Yes"] },
  { name: "Both teams to score, no", aliases: ["BTTS No", "Away Goals 0", "Home Goals 0", "Home Clean Sheet", "Away Clean Sheet", "Either Team Clean Sheet", "Team Total Under 0.5", "Win to Nil"] },
  { name: "Overs", aliases: ["Over 2.5", "Goals Range 3+", "Under 2.5 No", "Asian Total Over 2.5"] },
  { name: "Unders", aliases: ["Under 2.5", "Goals Range 0-2", "Over 2.5 No"] },
  { name: "0-0", aliases: ["Under 0.5", "Total Goals 0", "Any Goalscorer No", "First Team to Score: No Goal", "Race to 1 Goal: Neither"] },
  { name: "Over 0.5 goals", aliases: ["Goals Range 1+", "0-0 No", "Any Goalscorer Yes"] },
  { name: "Home win to nil", aliases: ["Home Win + Away Goals 0", "Result & BTTS: Home & No"] },
  { name: "Away win to nil", aliases: ["Away Win + Home Goals 0", "Result & BTTS: Away & No"] },
  { name: "Score draw", aliases: ["Draw & BTTS Yes", "Draw & Over 0.5"] },
  { name: "Home \u22121.5", aliases: ["Home by 2+", "Winning Margin Home 2+", "European Handicap Home \u22121 win"] },
  { name: "Home to score", aliases: ["Home Team Over 0.5", "Away Clean Sheet No", "Home Goals 1+"] },
  { name: "Away to score", aliases: ["Away Team Over 0.5", "Home Clean Sheet No", "Away Goals 1+"] },
  { name: "Home scores first", aliases: ["First Team to Score Home", "Race to 1 Goal Home", "Opening Goal Home"] },
  { name: "Player to score", aliases: ["Anytime Goalscorer", "Player Over 0.5 Goals", "Player 1+ Goals"] },
  { name: "Player 2+ goals", aliases: ["Player Over 1.5 Goals", "Brace or better"] },
  { name: "Player hat-trick", aliases: ["Player Over 2.5 Goals", "Player 3+ Goals"] },
  { name: "Player carded", aliases: ["Player to be Booked", "Player Over 0.5 Cards"] },
  { name: "Red card", aliases: ["Total Reds Over 0.5", "Sending Off Yes"] },
  { name: "Home leads at half time", aliases: ["1st Half Result Home", "Half Time Result Home", "1st Half AH Home \u22120.5"] },
  { name: "Corners over 9.5", aliases: ["Under 9.5 No", "Corners Range 10+"] },
];

/* Fold the way a slip spells it: case, punctuation and the minus sign, which
   arrives as U+2212 from some readers and a hyphen from others. */
const key = (s: string) =>
  String(s || '').toLowerCase().replace(/\u2212/g, '-').replace(/[^a-z0-9+-]/g, '');

const INDEX = new Map<string, string>();
for (const g of MARKET_GROUPS) {
  INDEX.set(key(g.name), g.name);
  for (const a of g.aliases) INDEX.set(key(a), g.name);
}

/** The canonical name for a market as a slip spelled it, or null if this is
 *  a market the product has no group for, which is an honest answer. */
export const canonicalMarket = (raw: string): string | null => INDEX.get(key(raw)) ?? null;
