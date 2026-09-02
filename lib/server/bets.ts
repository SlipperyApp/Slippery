/** appendEvent: the ONLY path that adds a settlement event.
 *
 *  It writes the event and recomputes bet_state inside the same transaction,
 *  so bet_state can never lag the ledger it folds, and a request that fails
 *  writes nothing at all. lib/domain/fold.ts is the only thing that produces
 *  the numbers it stores. */

import type { PoolClient } from 'pg';
import { commissionDue, recompute } from '@/lib/domain/fold';
import type { Bet, BetLeg, BetState, EventType, SettlementEvent } from '@/lib/domain/types';

export type AppendInput = {
  accountId: string;
  betId: string;
  type: EventType;
  fractionEighths?: number | null;
  returnedPence?: number | null;
  deductionPence?: number | null;
  commissionPct?: number | null;
  enteredBy?: string;
  note?: string | null;
  occurredAt?: string;
};

type BetRow = {
  id: string; account_id: string; balance_id: string | null; shape: Bet['shape']; side: Bet['side'];
  stake_pence: number; liability_pence: number | null; odds: string;
  currency: Bet['currency']; bookmaker_id: string; tipster_id: string | null;
  sport_id: string; event_name: string; selection: string; market_raw: string;
  event_at: string; placed_at: string; is_free_bet: boolean; is_bonus_funds: boolean;
  is_boosted: boolean; is_each_way: boolean; ew_place_fraction: string | null;
  ew_part: Bet['ewPart']; ew_group_id: string | null; places_paid: number | null;
  closing_odds: string | null;
  slip_backed: boolean;
  source: Bet['source']; arb_group_id: string | null; note: string | null;
  unit_pence_at_placement: number; commission_pct: string;
  competition: string | null; course: string | null; market_group_id: string | null;
  expected_settle_at: string | null; fx_rate: string | null; created_at: string;
};

type LegRow = {
  id: string; bet_id: string; seq: number; selection: string; market_raw: string;
  fixture_id: string | null; event_name: string; leg_odds: string;
  leg_result: BetLeg['legResult']; event_at: string;
};

type EventRow = {
  id: string; bet_id: string; seq: number; type: EventType;
  fraction_eighths: number | null; returned_pence: number | null;
  deduction_pence: number | null; commission_pct: string | null;
  occurred_at: string; entered_by: string; after_result_known: boolean;
  note: string | null; created_at: string;
};

const toBet = (r: BetRow, legs: LegRow[]): Bet => ({
  id: r.id, accountId: r.account_id, balanceId: r.balance_id ?? '', shape: r.shape, side: r.side,
  stakePence: r.stake_pence, liabilityPence: r.liability_pence, odds: Number(r.odds),
  currency: r.currency, fxRate: r.fx_rate ? Number(r.fx_rate) : null,
  bookmakerId: r.bookmaker_id, tipsterId: r.tipster_id, sportId: r.sport_id as Bet['sportId'],
  competition: r.competition, course: r.course, eventName: r.event_name,
  selection: r.selection, marketRaw: r.market_raw, marketGroupId: r.market_group_id,
  eventAt: r.event_at, placedAt: r.placed_at, expectedSettleAt: r.expected_settle_at,
  isFreeBet: r.is_free_bet, isBonusFunds: r.is_bonus_funds, isBoosted: r.is_boosted,
  isEachWay: r.is_each_way, ewPlaceFraction: r.ew_place_fraction ? Number(r.ew_place_fraction) : null,
  ewPart: r.ew_part, ewGroupId: r.ew_group_id,
  placesPaid: r.places_paid == null ? null : Number(r.places_paid),
  slipBacked: r.slip_backed,
  /*  Null stays null. A closing price nobody recorded is not a zero and is
      not a price, and `Number(null)` is 0, which would divide into the price
      taken and print a beat on a bet nobody looked up. */
  closingOdds: r.closing_odds == null ? null : Number(r.closing_odds),
  source: r.source, arbGroupId: r.arb_group_id, note: r.note,
  unitPenceAtPlacement: r.unit_pence_at_placement, commissionPct: Number(r.commission_pct),
  createdAt: r.created_at,
  legs: legs.map((l) => ({
    id: l.id, betId: l.bet_id, seq: l.seq, selection: l.selection, marketRaw: l.market_raw,
    fixtureId: l.fixture_id, eventName: l.event_name, legOdds: Number(l.leg_odds),
    legResult: l.leg_result, eventAt: l.event_at,
  })),
});

const toEvent = (r: EventRow): SettlementEvent => ({
  id: r.id, betId: r.bet_id, seq: r.seq, type: r.type,
  fractionEighths: r.fraction_eighths, returnedPence: r.returned_pence,
  deductionPence: r.deduction_pence,
  commissionPct: r.commission_pct == null ? null : Number(r.commission_pct),
  occurredAt: r.occurred_at, enteredBy: r.entered_by,
  afterResultKnown: r.after_result_known, note: r.note, createdAt: r.created_at,
});

/** Recompute and store bet_state. Nothing else in the codebase writes that
 *  table, which is the whole point of it living here. */
export async function writeState(client: PoolClient, bet: Bet, events: SettlementEvent[]): Promise<BetState> {
  const state = recompute(bet, events, new Date().toISOString());
  await client.query(
    `insert into bet_state (bet_id, status, remaining_stake_pence, realised_pl_pence,
                            returned_pence, voided_stake_pence, units, outcome, updated_at)
     values ($1,$2,$3,$4,$5,$6,$7,$8, now())
     on conflict (bet_id) do update set
       status = excluded.status,
       remaining_stake_pence = excluded.remaining_stake_pence,
       realised_pl_pence = excluded.realised_pl_pence,
       returned_pence = excluded.returned_pence,
       voided_stake_pence = excluded.voided_stake_pence,
       units = excluded.units,
       outcome = excluded.outcome,
       updated_at = now()`,
    [bet.id, state.status, state.remainingStakePence, state.realisedPlPence,
      state.returnedPence, state.voidedStakePence, state.units, state.outcome],
  );
  return state;
}

export async function loadBet(client: PoolClient, accountId: string, betId: string) {
  const bets = await client.query<BetRow>(
    'select * from bets where id = $1 and account_id = $2', [betId, accountId],
  );
  if (!bets.rows.length) throw new Error('not_found');
  const legs = await client.query<LegRow>('select * from bet_legs where bet_id = $1 order by seq', [betId]);
  const events = await client.query<EventRow>('select * from settlement_events where bet_id = $1 order by seq', [betId]);
  return { bet: toBet(bets.rows[0], legs.rows), events: events.rows.map(toEvent) };
}

export async function appendEvent(client: PoolClient, input: AppendInput): Promise<BetState> {
  const { bet, events } = await loadBet(client, input.accountId, input.betId);

  const nextSeq = (events[events.length - 1]?.seq ?? 0) + 1;
  // An event added once the bet already has a terminal result is flagged, and
  // the flag is what a group's late-edit column reads.
  const afterResultKnown = events.some((e) =>
    ['won', 'lost', 'void', 'push', 'placed', 'half_won', 'half_lost', 'cash_out_full'].includes(e.type));

  const inserted = await client.query<EventRow>(
    `insert into settlement_events
       (bet_id, seq, type, fraction_eighths, returned_pence, deduction_pence,
        commission_pct, occurred_at, entered_by, after_result_known, note)
     values ($1,$2,$3,$4,$5,$6,$7, coalesce($8::timestamptz, now()), $9, $10, $11)
     returning *`,
    [bet.id, nextSeq, input.type, input.fractionEighths ?? null, input.returnedPence ?? null,
      input.deductionPence ?? null, input.commissionPct ?? null, input.occurredAt ?? null,
      input.enteredBy ?? 'you', afterResultKnown, input.note ?? null],
  );

  const state = await writeState(client, bet, [...events, toEvent(inserted.rows[0])]);

  await client.query(
    `insert into audit_log (account_id, entity, entity_id, action, after, source, after_result_known)
     values ($1, 'settlement_event', $2, $3, $4, $5, $6)`,
    [input.accountId, bet.id, input.type, JSON.stringify({ state }), input.enteredBy ?? 'you', afterResultKnown],
  );

  return state;
}

/** A graded result, and the commission that result triggers, in one go.
 *
 *  COMMISSION HAD NO APPENDER AT ALL. The fold has understood a `commission`
 *  event since the first migration, bookmakers carry their rate, bets freeze
 *  it at placement, and neither /api/settle nor the cron sweep ever mentioned
 *  the word. So every winner on an exchange was reported 1.5 to 2 per cent
 *  above what the exchange actually paid, and it compounded through return,
 *  units, the calendar and every breakdown, because they all read the same
 *  realised figure.
 *
 *  Both settlement paths call this instead of appendEvent, so there is one
 *  place that decides whether a charge is owed. The charge itself is worked
 *  out by the fold, off the state the result event produced, which is why the
 *  base is net winnings on the settled portion and not turnover.
 *
 *  It is a second event rather than a smaller first one on purpose: the
 *  ledger is append only and a person looking at a bet that returned £150 and
 *  paid £98 is owed the line that says where the other £2 went. */
export async function appendResult(client: PoolClient, input: AppendInput): Promise<BetState> {
  const state = await appendEvent(client, input);

  const { bet, events } = await loadBet(client, input.accountId, input.betId);
  const pct = commissionDue(bet, events, state);
  if (pct === null) return state;

  return appendEvent(client, {
    accountId: input.accountId,
    betId: input.betId,
    type: 'commission',
    commissionPct: pct,
    enteredBy: input.enteredBy ?? 'system',
    note: `${pct}% commission on net winnings.`,
  });
}
