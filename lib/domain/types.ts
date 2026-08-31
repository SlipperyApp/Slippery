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

export type Bet = {
  id: string;
  accountId: string;
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
  slipBacked: boolean;
  source: BetSource;
  arbGroupId: string | null;
  note: string | null;
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

/** The whole outcome vocabulary the product ever shows. Six, and no more. */
export type Outcome = 'won' | 'lost' | 'cash-profit' | 'cash-loss' | 'cash-flat' | 'void';

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
  oddsFormat: 'decimal' | 'fractional' | 'american';
  showProfitIn: 'currency' | 'units' | 'both';
  calendarDates: boolean;
  theme: string;
  bankrollStartPence: number;
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
