/** THE REPOSITORY. An account's own book, read out of the database.
 *
 *  This is the half of the read path that did not exist. Every page went
 *  through getViewer(), getViewer() read the example account, and so a signed
 *  in account was shown somebody else's ledger with the "Example" label
 *  removed. Nothing here fabricates a figure: an account with no rows comes
 *  back with no rows, and lib/data/viewer.ts decides what a screen does with
 *  that.
 *
 *  It reads bet_state rather than folding again. bet_state is written by
 *  lib/domain/fold.ts inside the same transaction as every event, so the
 *  stored row IS the fold, and recomputing here would put a second answer to
 *  the same question in the build. The settlement events come back with each
 *  bet because the sheet shows its own working off them, which is the fold's
 *  own output rather than a second derivation. */

import { hasDatabase, query } from './db';
import type { DemoBet, DemoData } from '@/lib/data/demo';
import { emptyBook, newAccountFacts } from '@/lib/data/viewer';
import { NOTIFICATIONS, SHARING_SWITCHES, switchDefaults } from '@/lib/data/settings';
import type { Balance } from '@/lib/domain/balances';
import type { Movement } from '@/lib/domain/movements';
import type { Bet, BetLeg, BetState, EventType, SettlementEvent } from '@/lib/domain/types';
import { DEFAULT_TZ } from '@/lib/format';
import { TRIAL_DAYS, TRIAL_SLIPS } from '@/lib/domain/trial';

/*  A bet with a very long history is still one bet, but a whole book at once
 *  is the read behind every screen in the product, so it is bounded. Two
 *  thousand bets is more than three years of a heavy account and the ledger
 *  pages at fifty. */
const MAX_BETS = 2000;

type AccountRow = {
  id: string; email: string; display_name: string; handle: string | null;
  unit_pence: number; currency: string; week_start: number; odds_format: string;
  show_profit_in: string; calendar_dates: boolean; theme: string;
  balance_start_pence: number; link_code: string | null; time_zone: string;
  trial_ends_at: string | null; trial_slips_allowed: number; trial_slips_used: number;
  plan_state: string; telegram_linked: boolean;
  notifications: Record<string, unknown> | null;
  sharing: Record<string, unknown> | null;
  break_until: string | null;
};

type BalanceRow = {
  id: string; account_id: string; name: string; currency: string;
  start_pence: number; unit_pence: number; share_token: string | null;
  archived: boolean; sort: number; created_at: string;
};

type BetRow = {
  id: string; account_id: string; balance_id: string | null; shape: Bet['shape']; side: Bet['side'];
  stake_pence: number; liability_pence: number | null; odds: string;
  currency: string; fx_rate: string | null; bookmaker_id: string; tipster_id: string | null;
  sport_id: string; competition: string | null; course: string | null;
  event_name: string; selection: string; market_raw: string; market_group_id: string | null;
  event_at: string; placed_at: string; expected_settle_at: string | null;
  is_free_bet: boolean; is_bonus_funds: boolean; is_boosted: boolean;
  is_each_way: boolean; ew_place_fraction: string | null; ew_part: Bet['ewPart'];
  ew_group_id: string | null; places_paid: number | null; slip_backed: boolean;
  source: Bet['source']; arb_group_id: string | null; note: string | null;
  closing_odds: string | null; unit_pence_at_placement: number; commission_pct: string;
  created_at: string;
  status: BetState['status'] | null; remaining_stake_pence: number | null;
  realised_pl_pence: number | null; returned_pence: number | null;
  voided_stake_pence: number | null; units: string | null;
  outcome: BetState['outcome'] | null; state_updated_at: string | null;
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

type SlipRow = { id: string; bet_id: string; deleted_at: string | null };

type MovementRow = {
  id: string; account_id: string; balance_id: string | null; kind: Movement['kind'];
  amount_pence: number; currency: string; bookmaker_id: string | null;
  occurred_at: string; note: string | null; created_at: string;
};

const cur = (v: string | null | undefined): 'GBP' | 'EUR' => (v === 'EUR' ? 'EUR' : 'GBP');

function toAccount(r: AccountRow, now: Date): DemoData['account'] {
  return newAccountFacts({
    id: r.id,
    displayName: r.display_name || '',
    handle: r.handle ?? '',
    email: r.email,
    unitPence: Number(r.unit_pence) || 0,
    currency: cur(r.currency),
    balanceStartPence: Number(r.balance_start_pence) || 0,
    timeZone: r.time_zone || DEFAULT_TZ,
    weekStart: r.week_start === 0 ? 0 : 1,
    oddsFormat: (['decimal', 'fractional', 'american'].includes(r.odds_format)
      ? r.odds_format : 'decimal') as DemoData['account']['oddsFormat'],
    showProfitIn: (['currency', 'units', 'both'].includes(r.show_profit_in)
      ? r.show_profit_in : 'both') as DemoData['account']['showProfitIn'],
    calendarDates: r.calendar_dates !== false,
    theme: r.theme || 'carbon',
    linkCode: r.link_code ?? '',
    telegramLinked: Boolean(r.telegram_linked),
    /*  Five plan states in the column, three the product renders. past_due is
        still a working account and cancelled is read only, which is what the
        two banners already say, so the mapping is here rather than in each
        screen deciding for itself. */
    planState: r.plan_state === 'active' ? 'active'
      : r.plan_state === 'read_only' || r.plan_state === 'cancelled' ? 'read_only'
        : r.plan_state === 'past_due' ? 'active' : 'trial',
    trialEndsAt: r.trial_ends_at ?? new Date(now.getTime() + TRIAL_DAYS * 86400000).toISOString(),
    trialSlipsAllowed: Number(r.trial_slips_allowed) || TRIAL_SLIPS,
    trialSlipsUsed: Math.max(0, Number(r.trial_slips_used) || 0),
    /*  Only what the account actually overrode is stored, so the answer for
        every other switch comes from the one list in lib/data/settings.ts.
        Both panes used to hold their own copy in React state and nothing
        else, and a reload put every switch back where it started. */
    notifications: switchDefaults(NOTIFICATIONS, r.notifications),
    sharing: switchDefaults(SHARING_SWITCHES, r.sharing),
    onBreak: Boolean(r.break_until && new Date(r.break_until).getTime() > now.getTime()),
  }, now);
}

const toBalance = (r: BalanceRow): Balance => ({
  id: r.id, accountId: r.account_id, name: r.name, currency: cur(r.currency),
  startMinor: Number(r.start_pence) || 0, unitMinor: Number(r.unit_pence) || 0,
  shareToken: r.share_token, archived: Boolean(r.archived), sort: Number(r.sort) || 0,
  createdAt: r.created_at,
});

const toLeg = (l: LegRow): BetLeg => ({
  id: l.id, betId: l.bet_id, seq: Number(l.seq), selection: l.selection,
  marketRaw: l.market_raw, fixtureId: l.fixture_id, eventName: l.event_name,
  legOdds: Number(l.leg_odds), legResult: l.leg_result, eventAt: l.event_at,
});

const toEvent = (r: EventRow): SettlementEvent => ({
  id: r.id, betId: r.bet_id, seq: Number(r.seq), type: r.type,
  fractionEighths: r.fraction_eighths, returnedPence: r.returned_pence,
  deductionPence: r.deduction_pence,
  commissionPct: r.commission_pct == null ? null : Number(r.commission_pct),
  occurredAt: r.occurred_at, enteredBy: r.entered_by,
  afterResultKnown: r.after_result_known, note: r.note, createdAt: r.created_at,
});

function toBet(
  r: BetRow, legs: LegRow[], events: EventRow[], fallbackBalance: string,
  slipImage: DemoBet['slipImage'],
): DemoBet {
  const risk = r.side === 'lay' ? (r.liability_pence ?? 0) : Number(r.stake_pence);
  /*  A bet with no bet_state row is an OPEN bet with its whole stake still
      standing, which is exactly what the fold returns for an empty event
      list. It is stated here rather than folded, because folding in the read
      path would make this file a second writer of the same numbers. */
  const state: BetState = {
    betId: r.id,
    status: r.status ?? 'open',
    remainingStakePence: r.remaining_stake_pence ?? risk,
    realisedPlPence: r.realised_pl_pence ?? 0,
    returnedPence: r.returned_pence ?? 0,
    voidedStakePence: r.voided_stake_pence ?? 0,
    units: r.units == null ? 0 : Number(r.units),
    outcome: r.outcome ?? null,
    updatedAt: r.state_updated_at ?? r.created_at,
  };

  return {
    id: r.id, accountId: r.account_id, balanceId: r.balance_id ?? fallbackBalance,
    shape: r.shape, side: r.side,
    stakePence: Number(r.stake_pence), liabilityPence: r.liability_pence,
    odds: Number(r.odds), currency: cur(r.currency),
    fxRate: r.fx_rate == null ? null : Number(r.fx_rate),
    bookmakerId: r.bookmaker_id, tipsterId: r.tipster_id,
    sportId: r.sport_id as Bet['sportId'],
    competition: r.competition, course: r.course, eventName: r.event_name,
    selection: r.selection, marketRaw: r.market_raw, marketGroupId: r.market_group_id,
    eventAt: r.event_at, placedAt: r.placed_at, expectedSettleAt: r.expected_settle_at,
    isFreeBet: r.is_free_bet, isBonusFunds: r.is_bonus_funds, isBoosted: r.is_boosted,
    isEachWay: r.is_each_way,
    ewPlaceFraction: r.ew_place_fraction == null ? null : Number(r.ew_place_fraction),
    ewPart: r.ew_part, ewGroupId: r.ew_group_id,
    placesPaid: r.places_paid == null ? null : Number(r.places_paid),
    slipBacked: r.slip_backed, source: r.source, arbGroupId: r.arb_group_id, note: r.note,
    /*  Null stays null. A closing price nobody recorded is not a zero, and
        Number(null) is 0, which divides into the price taken and prints a
        beat on a bet nobody looked up. */
    closingOdds: r.closing_odds == null ? null : Number(r.closing_odds),
    unitPenceAtPlacement: Number(r.unit_pence_at_placement) || 1,
    commissionPct: Number(r.commission_pct) || 0,
    createdAt: r.created_at,
    legs: legs.map(toLeg),
    state,
    events: events.map(toEvent),
    slipImage,
  };
}

const toMovement = (r: MovementRow, fallbackBalance: string): Movement => ({
  id: r.id, accountId: r.account_id, balanceId: r.balance_id ?? fallbackBalance,
  kind: r.kind, amountMinor: Number(r.amount_pence), currency: cur(r.currency),
  bookmakerId: r.bookmaker_id, occurredAt: r.occurred_at, note: r.note,
  createdAt: r.created_at,
});

/** This account's whole book, or null when the database could not answer.
 *
 *  Null is not "no bets". A failed read has to be told apart from an empty
 *  ledger, because one of them is a page saying your account is empty when it
 *  is not, which is the same class of lie this file was written to remove. */
export async function loadBook(accountId: string, now: Date = new Date()): Promise<DemoData | null> {
  if (!hasDatabase()) return null;

  try {
    const [accounts, balanceRows] = await Promise.all([
      query<AccountRow>(
        `select a.id, a.email, a.display_name, a.handle, a.unit_pence, a.currency,
                a.week_start, a.odds_format, a.show_profit_in, a.calendar_dates, a.theme,
                a.balance_start_pence, a.link_code, a.time_zone,
                a.trial_ends_at, a.trial_slips_allowed, a.trial_slips_used, a.plan_state,
                a.notifications, a.sharing, a.break_until,
                exists (select 1 from telegram_links t
                         where t.account_id = a.id and t.dormant = false) as telegram_linked
           from accounts a where a.id = $1 limit 1`,
        [accountId],
      ),
      query<BalanceRow>(
        `select * from balances where account_id = $1 order by sort, created_at`,
        [accountId],
      ),
    ]);

    if (!accounts.length) return null;
    const account = toAccount(accounts[0], now);
    const balances = balanceRows.map(toBalance);
    const fallbackBalance = balances[0]?.id ?? 'bal-main';

    const betRows = await query<BetRow>(
      `select b.*, s.status, s.remaining_stake_pence, s.realised_pl_pence, s.returned_pence,
              s.voided_stake_pence, s.units, s.outcome, s.updated_at as state_updated_at
         from bets b left join bet_state s on s.bet_id = b.id
        where b.account_id = $1
        order by b.event_at desc
        limit ${MAX_BETS}`,
      [accountId],
    );

    const ids = betRows.map((b) => b.id);
    const [legRows, eventRows, slipRows, movementRows] = await Promise.all([
      ids.length
        ? query<LegRow>('select * from bet_legs where bet_id = any($1::uuid[]) order by bet_id, seq', [ids])
        : Promise.resolve([] as LegRow[]),
      ids.length
        ? query<EventRow>('select * from settlement_events where bet_id = any($1::uuid[]) order by bet_id, seq', [ids])
        : Promise.resolve([] as EventRow[]),
      /*  THE SLIP BEHIND EACH BET. Resolved here so a screen never has to ask
          a second time, and so lib/domain/slip.ts gets a real answer rather
          than falling back to a date. `data` is deliberately not selected: a
          book read is every bet on the account and the bytes are served one
          at a time by /api/slips. */
      ids.length
        ? query<SlipRow>(
          `select id, bet_id, deleted_at from slip_images
            where account_id = $1 and bet_id = any($2::uuid[])
            order by uploaded_at desc`,
          [accountId, ids],
        )
        : Promise.resolve([] as SlipRow[]),
      query<MovementRow>(
        'select * from money_movements where account_id = $1 order by occurred_at desc limit 500',
        [accountId],
      ),
    ]);

    const legsBy = new Map<string, LegRow[]>();
    for (const l of legRows) legsBy.set(l.bet_id, [...(legsBy.get(l.bet_id) ?? []), l]);
    const eventsBy = new Map<string, EventRow[]>();
    for (const e of eventRows) eventsBy.set(e.bet_id, [...(eventsBy.get(e.bet_id) ?? []), e]);

    const slipsBy = new Map<string, SlipRow>();
    for (const row of slipRows) if (!slipsBy.has(row.bet_id)) slipsBy.set(row.bet_id, row);

    const bets = betRows.map((r) => {
      const slip = slipsBy.get(r.id);
      /*  Null, not undefined, for a slip backed bet with nothing stored. The
          two mean different things: null is "we looked and there is none",
          which the gallery says out loud, and undefined is "nobody looked". */
      const slipImage = r.slip_backed
        ? (slip ? { id: slip.id, deletedAt: slip.deleted_at } : null)
        : undefined;
      return toBet(r, legsBy.get(r.id) ?? [], eventsBy.get(r.id) ?? [], fallbackBalance, slipImage);
    });

    return {
      account,
      balances: balances.length ? balances : emptyBook(account, [], now).balances,
      bets,
      movements: movementRows.map((m) => toMovement(m, fallbackBalance)),
      generatedAt: now.toISOString(),
    };
  } catch {
    /*  A read that failed is not an empty account. The caller falls back to
        the empty book AND says the store could not be reached, rather than
        printing zeroes as though they were the answer. */
    return null;
  }
}

export const TRIAL_DEFAULTS = { days: TRIAL_DAYS, slips: TRIAL_SLIPS };
