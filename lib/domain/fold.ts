/** The fold. The ONLY writer of bet_state.
 *
 *  Given a bet and its settlement events in sequence order, this returns the
 *  state every displayed figure reads. It is pure: no DOM, no globals, no
 *  clock beyond what is handed to it. It runs inside the same transaction as
 *  every write, so bet_state can never lag the ledger it folds.
 *
 *  Every event contributes exactly two numbers:
 *    stakePortion  how much of the remaining risk it consumes
 *    returned      how much money came back because of it, signed
 *  and the fold is
 *    remaining -= stakePortion
 *    realised  += returned - (free bet ? 0 : stakePortion)
 *  which is why a repeated partial cash out, a Rule 4 deduction, exchange
 *  commission and a late promo refund all fit through one mechanism, where a
 *  single result column could hold none of them. */

import type { Bet, BetState, BetStatus, Outcome, SettlementEvent } from './types';

const round = (n: number) => Math.round(n);

/** The price actually in force. Void legs drop out of a multiple and the odds
 *  recalculate; a single keeps its own price. */
export function effectiveOdds(bet: Bet): number {
  if (!bet.legs.length) return bet.odds;
  const live = bet.legs.filter((l) => l.legResult !== 'void');
  if (!live.length) return 1;
  return Number(live.reduce((acc, l) => acc * l.legOdds, 1).toFixed(4));
}

/** A lay bet risks its liability, not its stake, and its ROI denominator is
 *  the liability. Everything else in the fold is identical. */
export function riskPence(bet: Bet): number {
  return bet.side === 'lay' ? (bet.liabilityPence ?? 0) : bet.stakePence;
}

const TERMINAL_TYPES = new Set([
  'won', 'lost', 'void', 'push', 'placed', 'half_won', 'half_lost', 'cash_out_full',
]);
const ADJUSTMENT_TYPES = new Set(['rule4', 'commission', 'promo_refund', 'manual_correction']);

type Applied = { stakePortion: number; returned: number; voided: number; terminal: boolean };

function applyEvent(
  bet: Bet,
  ev: SettlementEvent,
  remaining: number,
  risk: number,
  netWinningsSoFar: number,
): Applied {
  const odds = effectiveOdds(bet);
  const free = bet.isFreeBet;

  switch (ev.type) {
    case 'won':
    case 'placed': {
      if (bet.side === 'lay') {
        // The layer keeps the backer's stake, in proportion to the part of
        // the liability still standing.
        const won = risk > 0 ? round((bet.stakePence * remaining) / risk) : 0;
        return { stakePortion: remaining, returned: remaining + won, voided: 0, terminal: true };
      }
      // A free bet's stake is not returned with the winnings.
      const returned = free ? round(remaining * (odds - 1)) : round(remaining * odds);
      return { stakePortion: remaining, returned, voided: 0, terminal: true };
    }
    case 'lost':
      return { stakePortion: remaining, returned: 0, voided: 0, terminal: true };

    case 'void':
    case 'push':
      // Stake returned, zero profit, and the stake is excluded from turnover
      // and from the ROI denominator everywhere it is reported.
      return {
        stakePortion: remaining,
        returned: free ? 0 : remaining,
        voided: remaining,
        terminal: true,
      };

    case 'half_won': {
      // A quarter line splits the stake. Half wins at the price, half is
      // returned because that half pushed.
      const half = round(remaining / 2);
      const rest = remaining - half;
      const win = free ? round(half * (odds - 1)) : round(half * odds);
      return { stakePortion: remaining, returned: win + (free ? 0 : rest), voided: rest, terminal: true };
    }
    case 'half_lost': {
      const half = round(remaining / 2);
      return { stakePortion: remaining, returned: free ? 0 : half, voided: half, terminal: true };
    }

    case 'cash_out_full':
      return { stakePortion: remaining, returned: ev.returnedPence ?? 0, voided: 0, terminal: true };

    case 'cash_out_partial': {
      // Eighths of the REMAINING stake, never of the original, which is what
      // makes a second pull land on the right base.
      const e = Math.max(1, Math.min(8, ev.fractionEighths ?? 1));
      const portion = round((remaining * e) / 8);
      return { stakePortion: portion, returned: ev.returnedPence ?? 0, voided: 0, terminal: e >= 8 };
    }

    case 'rule4': {
      // Pence in the pound off net winnings only. Never touches the original
      // odds or the result.
      const d = Math.max(0, Math.min(90, ev.deductionPence ?? 0));
      return { stakePortion: 0, returned: -round((Math.max(0, netWinningsSoFar) * d) / 100), voided: 0, terminal: false };
    }
    case 'commission': {
      // Per bookmaker, on net winnings only. A losing bet pays no commission.
      const pct = Math.max(0, ev.commissionPct ?? bet.commissionPct ?? 0);
      return { stakePortion: 0, returned: -round((Math.max(0, netWinningsSoFar) * pct) / 100), voided: 0, terminal: false };
    }
    case 'promo_refund':
    case 'manual_correction':
      // Adjusts profit and bankroll, never the original odds or the result.
      return { stakePortion: 0, returned: ev.returnedPence ?? 0, voided: 0, terminal: false };

    default:
      return { stakePortion: 0, returned: 0, voided: 0, terminal: false };
  }
}

function outcomeOf(events: SettlementEvent[], realised: number, remaining: number): Outcome | null {
  const cashFull = events.some((e) => e.type === 'cash_out_full');
  const cashPart = events.some((e) => e.type === 'cash_out_partial');
  const result = [...events].reverse().find((e) =>
    TERMINAL_TYPES.has(e.type) && e.type !== 'cash_out_full');

  const cashLabel = (): Outcome =>
    realised > 0 ? 'cash-profit' : realised < 0 ? 'cash-loss' : 'cash-flat';

  if (cashFull) return cashLabel();
  if (result) {
    if (result.type === 'void' || result.type === 'push') return 'void';
    if (result.type === 'lost') return 'lost';
    if (result.type === 'half_lost') return realised < 0 ? 'lost' : 'void';
    return realised >= 0 ? 'won' : 'lost';
  }
  if (cashPart && remaining === 0) return cashLabel();
  return null;
}

/** The recompute. Nothing else may write bet_state. */
export function recompute(bet: Bet, events: SettlementEvent[], now: string): BetState {
  const ordered = [...events].sort((a, b) => a.seq - b.seq);
  const risk = riskPence(bet);

  let remaining = risk;
  let realised = 0;
  let returnedTotal = 0;
  let voided = 0;
  let stakeConsumed = 0;
  let terminated = false;

  for (const ev of ordered) {
    // A terminal event closes the bet. Later leg grading is still kept for
    // leg statistics, but it stops determining the outcome. Adjustments
    // (a Rule 4, commission, a promo refund landing a week later) still land.
    if (terminated && !ADJUSTMENT_TYPES.has(ev.type)) continue;

    const netWinningsSoFar = returnedTotal - stakeConsumed;
    const a = applyEvent(bet, ev, remaining, risk, netWinningsSoFar);

    remaining = Math.max(0, remaining - a.stakePortion);
    stakeConsumed += a.stakePortion;
    returnedTotal += a.returned;
    voided += a.voided;
    realised += a.returned - (bet.isFreeBet ? 0 : a.stakePortion);
    if (a.terminal) terminated = true;
  }

  const status: BetStatus =
    terminated || (risk > 0 && remaining === 0) ? 'settled'
      : remaining < risk ? 'part_settled'
        : 'open';

  const unit = bet.unitPenceAtPlacement || 1;

  return {
    betId: bet.id,
    status,
    remainingStakePence: remaining,
    realisedPlPence: realised,
    returnedPence: returnedTotal,
    voidedStakePence: voided,
    units: Number((realised / unit).toFixed(4)),
    outcome: outcomeOf(ordered, realised, remaining),
    updatedAt: now,
  };
}

/** Turnover excludes voided stake everywhere, and a free bet's stake too,
 *  because it was never turned over. */
export function turnoverPence(bet: Bet, state: BetState): number {
  if (bet.isFreeBet) return 0;
  return Math.max(0, riskPence(bet) - state.voidedStakePence);
}

/** Arb pairs report as one net line and are excluded from win rate, streaks
 *  and average odds. They still count to net and turnover. */
export function countsTowardWinRate(bet: Bet): boolean {
  return !bet.arbGroupId;
}
