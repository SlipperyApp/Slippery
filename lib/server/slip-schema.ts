/* What a read slip looks like, and the check that nothing was invented.
 *
 * Pure: no key, no network, no environment. The route calls it after the
 * model answers and the tests call it directly, so the rule that the reader
 * never guesses is held by something that can be run without a slip.
 */
import { bookName } from '../settlement/books.js';

export type ReadLeg = { selection: string | null; event_name: string | null; market: string | null; odds: number | null };
export type ReadBet = {
  shape: 'single' | 'multi_same_fixture' | 'multi_cross_fixture' | 'each_way' | 'system' | null;
  side: 'back' | 'lay' | null;
  stake_pence: number | null;
  liability_pence: number | null;
  odds: number | null;
  currency: 'GBP' | 'EUR' | null;
  bookmaker: string | null;
  event_name: string | null;
  selection: string | null;
  market: string | null;
  event_at: string | null;
  is_free_bet: boolean | null;
  is_each_way: boolean | null;
  legs: ReadLeg[];
  unreadable_fields: string[];
};

export type ReadResult = { bets: ReadBet[]; not_a_slip?: boolean; note?: string };


/* Everything the model produced is treated as a suggestion and checked. */
export function sanitise(raw: Record<string, unknown>): ReadResult {
  const bets = Array.isArray(raw.bets) ? raw.bets : [];
  return {
    not_a_slip: Boolean(raw.not_a_slip),
    bets: bets.map((b) => sanitiseBet(b as Record<string, unknown>)),
  };
}

function sanitiseBet(b: Record<string, unknown>): ReadBet {
  const bad = new Set<string>(Array.isArray(b.unreadable_fields) ? (b.unreadable_fields as string[]) : []);

  const pence = (v: unknown, field: string) => {
    const n = Number(v);
    if (!Number.isFinite(n) || n <= 0 || !Number.isInteger(n)) { if (v != null) bad.add(field); return null; }
    return n;
  };
  const odds = (v: unknown, field: string) => {
    const n = Number(v);
    if (!Number.isFinite(n) || n < 1) { if (v != null) bad.add(field); return null; }
    return Math.round(n * 1000) / 1000;
  };
  const text = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, 200) : null);
  const when = (v: unknown, field: string) => {
    if (typeof v !== 'string' || Number.isNaN(Date.parse(v))) { if (v != null) bad.add(field); return null; }
    return new Date(v).toISOString();
  };

  const legs: ReadLeg[] = Array.isArray(b.legs)
    ? (b.legs as Record<string, unknown>[]).map((l) => ({
        selection: text(l.selection),
        event_name: text(l.event_name),
        market: text(l.market),
        odds: odds(l.odds, 'leg odds'),
      }))
    : [];

  const shapeIn = typeof b.shape === 'string' ? b.shape : null;
  const shape = (['single', 'multi_same_fixture', 'multi_cross_fixture', 'each_way', 'system'].includes(shapeIn as string)
    ? shapeIn
    : legs.length > 1 ? null : 'single') as ReadBet['shape'];

  /* A shape the reader could not decide is a question for the person, not a
     coin toss the ledger has to live with. */
  if (!shape && legs.length > 1) bad.add('bet type');

  const stake = pence(b.stake_pence, 'stake');
  if (stake == null) bad.add('stake');

  const side = b.side === 'lay' ? 'lay' : 'back';
  const liability = pence(b.liability_pence, 'liability');
  if (side === 'lay' && liability == null) bad.add('liability');

  return {
    shape,
    side,
    stake_pence: stake,
    liability_pence: liability,
    odds: odds(b.odds, 'odds'),
    currency: b.currency === 'EUR' ? 'EUR' : 'GBP',
    /* Folded through the registry so "Bet 365" and "bet365" are the same
       bookmaker, which is what decides how a handicap grades. */
    bookmaker: b.bookmaker ? bookName(String(b.bookmaker)) : null,
    event_name: text(b.event_name),
    selection: text(b.selection),
    market: text(b.market),
    event_at: when(b.event_at, 'date'),
    is_free_bet: Boolean(b.is_free_bet),
    is_each_way: Boolean(b.is_each_way) || shape === 'each_way',
    legs,
    unreadable_fields: [...bad],
  };
}
