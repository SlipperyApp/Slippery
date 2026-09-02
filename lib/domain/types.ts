/** The data model.
 *
 *  A bet is a container with a settlement ledger, not a row with a result.
 *  `settlement_events` is append only. `bet_state` is a fold over it,
 *  recomputed by exactly one function inside the same transaction as every
 *  write. Every displayed figure reads `bet_state`; nothing reads
 *  `settlement_events` for display.
 *
 *  That is what makes repeated partial cash outs, exchange commission, a
 *  Rule 4 deduction and a promo refund landing a week later all
 *  representable through one mechanism, where a single result column could
 *  hold none of them. */

export type Currency = 'GBP' | 'EUR';

export type BetShape =
  | 'single' | 'multi_same_fixture' | 'multi_cross_fixture' | 'each_way' | 'system';

export type BetSide = 'back' | 'lay';

export type EwPart = 'win' | 'place';

export type LegResult = 'open' | 'won' | 'lost' | 'void' | 'half_won' | 'half_lost' | 'ask';

export type SportId = 'football' | 'tennis' | 'horse-racing';

export type BetSource = 'telegram' | 'web_upload' | 'manual' | 'csv_import' | 'shot_import';

/** History somebody brought with them, as opposed to a bet this product
 *  watched happen.
 *
 *  It lives beside the type because four surfaces now split on it: the
 *  dashboard leaves imported bets out of best day, worst day and the streak,
 *  the ledger offers a chip that shows or hides them, the export carries an
 *  `imported` column, and a row marks itself. Each of those held its own set
 *  literal, and a fifth source added to the type above would have had to be
 *  found in all of them. */
export const IMPORTED_SOURCES: ReadonlySet<string> = new Set<BetSource>(['csv_import', 'shot_import']);

export function isImportedSource(source: string): boolean {
  return IMPORTED_SOURCES.has(source);
}

/** Was this struck after the event had started.
 *
 *  DERIVED, not stored, and it lives here beside the two fields it is derived
 *  from. A bet placed after kick off is an in play bet and there is nothing
 *  else it could be: `placedAt` is when the slip was struck and `eventAt` is
 *  when the event begins, so the comparison IS the definition. A boolean
 *  column beside them would be a third fact that could disagree with the two
 *  it was copied from, and the first import that set one and not the others
 *  would leave a bet that is in play according to one screen and not another. */
export function isInPlay(bet: { placedAt: string; eventAt: string }): boolean {
  return Date.parse(bet.placedAt) > Date.parse(bet.eventAt);
}

export type Bet = {
  id: string;
  accountId: string;
  /** Which balance this bet belongs to. A bet is in exactly one, and the
   *  balance carries the currency, so a selection inside a balance can
   *  never contain two currencies. See lib/domain/balances.ts. */
  balanceId: string;
  shape: BetShape;
  side: BetSide;
  /** Integer minor units. Money is never a float and never crosses currencies. */
  stakePence: number;
  liabilityPence: number | null;
  odds: number;
  currency: Currency;
  fxRate: number | null;
  bookmakerId: string;
  tipsterId: string | null;
  sportId: SportId;
  competition: string | null;
  course: string | null;
  eventName: string;
  selection: string;
  marketRaw: string;
  marketGroupId: string | null;
  /** Canonical for every period total. `placedAt` is stored and filterable
   *  but never used for period maths. */
  eventAt: string;
  placedAt: string;
  expectedSettleAt: string | null;
  isFreeBet: boolean;
  isBonusFunds: boolean;
  isBoosted: boolean;
  isEachWay: boolean;
  ewPlaceFraction: number | null;
  ewPart: EwPart | null;
  ewGroupId: string | null;
  /** How many places the bookmaker paid on this market. The fraction says
   *  what a place is worth and this says how many there were, which is the
   *  half a ledger needs to print "3rd of 12, places paid 1-3". Null when
   *  the slip did not say, because a place count is never inferred from a
   *  field size. */
  placesPaid: number | null;
  slipBacked: boolean;
  source: BetSource;
  arbGroupId: string | null;
  note: string | null;
  /** The price this market settled at, as the account holder recorded it.
   *
   *  Entered by hand and null on most bets, which is the normal case rather
   *  than a gap. Nothing in this product computes, estimates or infers one:
   *  a fabricated closing price looks exactly like a real one, and the
   *  module that used to stand in for the missing feed was deleted for
   *  saying so on every account every day. See lib/domain/closing.ts. */
  closingOdds: number | null;
  /** The unit in force when the bet was placed, frozen so history never
   *  rewrites itself when the account's unit changes. */
  unitPenceAtPlacement: number;
  /** Commission on this bookmaker at the time of placement, per cent. */
  commissionPct: number;
  createdAt: string;
  legs: BetLeg[];
};

export type BetLeg = {
  id: string;
  betId: string;
  seq: number;
  selection: string;
  marketRaw: string;
  fixtureId: string | null;
  eventName: string;
  legOdds: number;
  legResult: LegResult;
  eventAt: string;
};

export type EventType =
  | 'won' | 'lost' | 'void' | 'placed' | 'push' | 'half_won' | 'half_lost'
  | 'cash_out_partial' | 'cash_out_full'
  | 'rule4' | 'commission' | 'promo_refund' | 'manual_correction';

/** The whole outcome vocabulary the product ever shows. Seven, and no more.
 *
 *  `placed` is the seventh and it was missing, which made the ledger lie
 *  about the commonest each way result there is. A selection that placed and
 *  did not win was collapsed to `realised >= 0 ? 'won' : 'lost'`, so a £10
 *  each way at 4.0 on fifths that came third read as Lost on the win part
 *  and Won on the place part, and neither row said the thing that actually
 *  happened. It is its own result because it IS its own result: the money
 *  can land either side of zero and the fact does not change. */
export type Outcome =
  | 'won' | 'lost' | 'placed' | 'cash-profit' | 'cash-loss' | 'cash-flat' | 'void';

export type SettlementEvent = {
  id: string;
  betId: string;
  seq: number;
  type: EventType;
  /** 1..8, cash_out_partial only, and always of the REMAINING stake. */
  fractionEighths: number | null;
  /** What actually came back for a cash out, or the signed adjustment for an
   *  adjustment event. Result events derive it from the bet's own terms. */
  returnedPence: number | null;
  /** Rule 4: pence in the pound off net winnings. */
  deductionPence: number | null;
  /** Commission: per cent, applied to net winnings only. */
  commissionPct: number | null;
  occurredAt: string;
  enteredBy: string;
  afterResultKnown: boolean;
  note: string | null;
  createdAt: string;
};

export type BetStatus = 'open' | 'part_settled' | 'settled';

export type BetState = {
  betId: string;
  status: BetStatus;
  remainingStakePence: number;
  realisedPlPence: number;
  returnedPence: number;
  /** Stake that was voided, so turnover and the ROI denominator can exclude
   *  it everywhere. */
  voidedStakePence: number;
  units: number;
  outcome: Outcome | null;
  updatedAt: string;
};

export type Bookmaker = {
  id: string;
  accountId: string;
  name: string;
  groupName: string | null;
  commissionPct: number;
  enabled: boolean;
  isCustom: boolean;
  /** Which handicap convention this bookmaker settles under. Never
   *  hardcoded at a call site: it is looked up here. */
  handicapStyle: 'asian' | 'european';
};

export type Tipster = {
  id: string;
  accountId: string;
  name: string;
  unitPenceOverride: number | null;
  channelRef: string | null;
  hidden: boolean;
  isBotDefault: boolean;
};

export type PlEntry = {
  id: string;
  accountId: string;
  entryDate: string;
  amountPence: number;
  stakePence: number;
  bookmakerId: string | null;
  note: string | null;
  source: string;
};

export type PlanState = 'trial' | 'active' | 'past_due' | 'read_only' | 'cancelled';

export type Account = {
  id: string;
  email: string;
  displayName: string;
  handle: string;
  unitPence: number;
  currency: Currency;
  weekStart: 0 | 1;
  /** The IANA zone every day boundary on this account is computed in. A
   *  bettor in Ireland and a server in UTC disagree about which day a 23:40
   *  bet belongs to, and the calendar is the most looked at surface here. */
  timeZone: string;
  oddsFormat: 'decimal' | 'fractional' | 'american';
  showProfitIn: 'currency' | 'units' | 'both';
  calendarDates: boolean;
  theme: string;
  balanceStartPence: number;
  linkCode: string;
  trialEndsAt: string;
  trialSlipsAllowed: number;
  trialSlipsUsed: number;
  plan: 'monthly' | 'yearly' | null;
  planState: PlanState;
  ageConfirmedAt: string | null;
  createdAt: string;
};

export type Group = {
  id: string;
  name: string;
  joinMode: 'open' | 'code' | 'approval';
  rankingPeriod: 'month' | 'year' | 'all';
  slipBackedOnly: boolean;
  showEditAudit: boolean;
  inviteCode: string;
  adminAccountId: string;
  memberCount: number;
};
