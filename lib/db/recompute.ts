/* The one writer of `bet_state`.
 *
 * `settlement_events` is the truth and it is append only. `bet_state` is a
 * fold over it, and this is the only function allowed to perform that fold or
 * to write the table. Nothing else may UPDATE bet_state: two writers is how a
 * derived table stops agreeing with what it was derived from, and the whole
 * product reads this one.
 *
 * It is pure. It takes the bet and its events and returns the state. The
 * caller writes it inside the same transaction as the event insert, so there
 * is never a moment where an event exists and the state does not reflect it.
 */

export type BetInput = {
  stakePence: number;
  liabilityPence?: number | null;
  side?: string | null;          // back | lay
  odds?: number | null;
  isFreeBet?: boolean | null;
  unitPence?: number | null;     // the unit the bet was logged with
  commissionPct?: number | null; // the bookmaker's, for exchange bets
  arbGroupId?: string | null;
  source?: string | null;
};

export type EventInput = {
  seq: number;
  type: string;
  fractionEighths?: number | null;
  stakePortionPence?: number | null;
  odds?: number | null;
  returnedPence?: number | null;
};

export type BetStateOut = {
  status: 'open' | 'part_settled' | 'settled';
  remainingStakePence: number;
  realisedPlPence: number;
  returnedPence: number;
  voidedStakePence: number;
  units: number | null;
  countsInStats: boolean;
};

export const EVENT_TYPES = [
  'placed', 'won', 'lost', 'void', 'push', 'half_won', 'half_lost',
  'cash_out_partial', 'cash_out_full', 'rule4', 'commission',
  'promo_refund', 'manual_correction',
] as const;

export type EventType = (typeof EVENT_TYPES)[number];

/* Terminal events end the bet. A multi cashed out in play keeps recording leg
   results afterwards for leg statistics, but they stop determining the
   outcome, so nothing after a terminal event may move the money. */
const TERMINAL = new Set(['won', 'lost', 'void', 'push', 'cash_out_full', 'half_won', 'half_lost']);

/* Money is integer pence everywhere inside the product. Rounding happens once,
   here, at the point a fraction is unavoidable, and never at the edge. */
const round = (n: number) => Math.round(n);

export function recomputeState(bet: BetInput, eventsIn: EventInput[]): BetStateOut {
  const events = [...eventsIn].sort((a, b) => a.seq - b.seq);
  const lay = bet.side === 'lay';

  /* An exchange lay risks liability, not stake. Every proportion below is of
     what is at risk, and the ROI denominator follows the same figure. */
  const atRisk = lay ? (bet.liabilityPence ?? bet.stakePence) : bet.stakePence;

  let remaining = atRisk;
  let returned = 0;
  let pl = 0;
  let voided = 0;
  let terminal = false;
  let touched = false;
  let grossWinnings = 0;   // what rule4 and commission are allowed to reduce

  for (const e of events) {
    if (e.type === 'placed') continue;

    /* Adjustments are the exception: they are allowed after a terminal event,
       which is the entire reason they exist as events rather than as edits. */
    const isAdjustment =
      e.type === 'rule4' || e.type === 'commission' ||
      e.type === 'promo_refund' || e.type === 'manual_correction';

    if (terminal && !isAdjustment) continue;
    touched = true;

    switch (e.type) {
      case 'won': {
        const stake = e.stakePortionPence ?? remaining;
        const odds = e.odds ?? bet.odds ?? 1;
        const ret = e.returnedPence ?? round(stake * odds);
        const win = ret - stake;
        grossWinnings += win;
        returned += ret;
        /* A free bet returns the winnings and not the stake, and its stake
           never entered turnover in the first place. */
        pl += bet.isFreeBet ? win : win;
        remaining -= stake;
        terminal = true;
        break;
      }
      case 'lost': {
        const stake = e.stakePortionPence ?? remaining;
        pl -= bet.isFreeBet ? 0 : stake;
        remaining -= stake;
        terminal = true;
        break;
      }
      case 'void':
      case 'push': {
        /* Stake returned, nothing won or lost. Voided stake leaves turnover
           and leaves the ROI denominator, which is why it is counted here
           rather than silently dropped. */
        const stake = e.stakePortionPence ?? remaining;
        returned += stake;
        voided += stake;
        remaining -= stake;
        terminal = true;
        break;
      }
      case 'half_won': {
        /* A quarter line splits the stake: half the stake wins at the price,
           half is returned. */
        const stake = e.stakePortionPence ?? remaining;
        const half = round(stake / 2);
        const odds = e.odds ?? bet.odds ?? 1;
        const win = round(half * odds) - half;
        grossWinnings += win;
        returned += round(half * odds) + (stake - half);
        voided += stake - half;
        pl += win;
        remaining -= stake;
        terminal = true;
        break;
      }
      case 'half_lost': {
        const stake = e.stakePortionPence ?? remaining;
        const half = round(stake / 2);
        returned += stake - half;
        voided += stake - half;
        pl -= half;
        remaining -= stake;
        terminal = true;
        break;
      }
      case 'cash_out_partial': {
        /* Eighths OF REMAINING STAKE, relabelled after each pull. Two
           consecutive pulls of 4/8 leave a quarter running, not nothing. */
        const eighths = Math.max(1, Math.min(8, e.fractionEighths ?? 0));
        const portion = e.stakePortionPence ?? round((remaining * eighths) / 8);
        const ret = e.returnedPence ?? 0;
        returned += ret;
        pl += ret - portion;
        if (ret > portion) grossWinnings += ret - portion;
        remaining -= portion;
        if (remaining <= 0) { remaining = 0; terminal = true; }
        break;
      }
      case 'cash_out_full': {
        const portion = e.stakePortionPence ?? remaining;
        const ret = e.returnedPence ?? 0;
        returned += ret;
        pl += ret - portion;
        if (ret > portion) grossWinnings += ret - portion;
        remaining -= portion;
        terminal = true;
        break;
      }
      case 'rule4': {
        /* Rule 4 applies to winnings only, never to the stake and never to
           the recorded odds. The original price stays on the bet. */
        const deduction = e.returnedPence ?? 0;
        const cut = Math.min(deduction, Math.max(0, grossWinnings));
        pl -= cut;
        returned -= cut;
        grossWinnings -= cut;
        break;
      }
      case 'commission': {
        /* Per bookmaker, on net winnings only. A losing exchange bet pays no
           commission, which is why it cannot be a flat percentage of stake. */
        const charged = e.returnedPence ?? round(Math.max(0, grossWinnings) * ((bet.commissionPct ?? 0) / 100));
        const cut = Math.min(charged, Math.max(0, grossWinnings));
        pl -= cut;
        returned -= cut;
        grossWinnings -= cut;
        break;
      }
      case 'promo_refund': {
        /* Lands after settlement and adjusts P&L and bankroll. It never
           touches the original odds or the original result. */
        const amount = e.returnedPence ?? 0;
        pl += amount;
        returned += amount;
        break;
      }
      case 'manual_correction': {
        const amount = e.returnedPence ?? 0;
        pl += amount;
        break;
      }
      default:
        break;
    }
  }

  if (remaining < 0) remaining = 0;

  const status: BetStateOut['status'] =
    !touched ? 'open'
      : terminal || remaining === 0 ? 'settled'
        : 'part_settled';

  const unit = bet.unitPence ?? null;

  /* Arb pairs are reported as one net line and imported figures have no bet
     behind them, so neither belongs in win rate, streaks, average odds or the
     best and worst day. Both still count toward net, turnover and calendar. */
  const countsInStats = !bet.arbGroupId && bet.source !== 'csv_import' && bet.source !== 'shot_import';

  return {
    status,
    remainingStakePence: remaining,
    realisedPlPence: pl,
    returnedPence: returned,
    voidedStakePence: voided,
    units: unit && unit > 0 ? Math.round((pl / unit) * 100) / 100 : null,
    countsInStats,
  };
}

/* Turnover and the ROI denominator both exclude voided stake. Kept beside the
   fold so the two cannot drift, because the UI has to state the excluded
   figure wherever any void exists in the period. */
export function turnoverPence(bet: BetInput, state: BetStateOut): number {
  if (bet.isFreeBet) return 0;
  const atRisk = bet.side === 'lay' ? (bet.liabilityPence ?? bet.stakePence) : bet.stakePence;
  return Math.max(0, atRisk - state.voidedStakePence);
}
