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

/*  `|| 0` is not decoration. Math.round(-0.4) is -0 and so is -Math.round(0),
 *  which is what a bet that pays no commission because it lost produced: a
 *  returned figure of -0, harmless in the fold and "-0.00" the moment
 *  anything reaches for toFixed on it, which is a bookmaker appearing to
 *  have taken nothing in a way that looks like a bug. NaN falls to 0 here
 *  too, rather than travelling into bet_state. */
const round = (n: number) => Math.round(n) || 0;

/** A deduction, kept off negative zero. The negation has to be guarded as
 *  well as the rounding, because -0 is what negating a zero gives. */
const deduct = (n: number) => -n || 0;

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

/** The commission on a given amount of net winnings, in whole pence.
 *
 *  ONE formula, here, because two would drift. The fold calls it when a
 *  commission event lands and the settlement paths call it only to ask
 *  whether there is anything to charge; neither works the arithmetic out
 *  again on its own.
 *
 *  The percentage is taken in thousandths, which is the precision the column
 *  stores, so a rate like 1.3 that has no exact binary form cannot make an
 *  exact charge land a penny high through the multiply. */
export function commissionPence(netWinningsPence: number, pct: number): number {
  if (netWinningsPence <= 0 || pct <= 0) return 0;
  const thousandths = Math.round(pct * 1000);
  return Math.ceil((netWinningsPence * thousandths) / 100_000);
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
      return { stakePortion: 0, returned: deduct(round((Math.max(0, netWinningsSoFar) * d) / 100)), voided: 0, terminal: false };
    }
    case 'commission': {
      /*  Per bookmaker, on NET WINNINGS only, never on turnover. A £50 stake
       *  returning £150 on a 2% exchange is charged 2% of the £100 it won,
       *  which is £2.00, not 2% of the £150 back and not 2% of the £50 in.
       *  A losing bet pays no commission at all.
       *
       *  The part penny rounds UP, away from the person. That is what Betfair
       *  itself does, and it is the only direction that cannot overstate
       *  profit: rounding a charge down reports money the exchange never paid
       *  out, which is the same defect as never charging commission at all,
       *  one penny smaller. */
      const pct = Math.max(0, ev.commissionPct ?? bet.commissionPct ?? 0);
      /*  Negated through `deduct`, not with a bare minus: -commissionPence(0)
       *  is -0, and -0 is what a losing bet's commission is, so the bare
       *  minus put "-0.00" on every bet that paid none. */
      return {
        stakePortion: 0,
        returned: deduct(commissionPence(Math.max(0, netWinningsSoFar), pct)),
        voided: 0,
        terminal: false,
      };
    }
    case 'promo_refund':
    case 'manual_correction':
      // Adjusts profit and the balance, never the original odds or the result.
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
    /*  A place is its own result and is never read off the money. It used to
     *  fall through to the line below, which asks whether realised is
     *  negative, so the each way pair for a horse that came third reported
     *  Won on the place part and Lost on the win part and the word "placed"
     *  appeared nowhere. Both halves are true about the cash and both are
     *  wrong about the race. */
    if (result.type === 'placed') return 'placed';
    return realised >= 0 ? 'won' : 'lost';
  }
  if (cashPart && remaining === 0) return cashLabel();
  return null;
}

/** What one event did, kept so a bet can show its own working.
 *
 *  The sheet that reveals the maths behind a settled bet needs the same two
 *  numbers per event that the fold consumed. Deriving them a second time in
 *  the view would put a second implementation of settlement in the browser,
 *  which rule 2 exists to prevent and which would let a bet's working
 *  disagree with the figure printed above it. So the fold emits them and the
 *  view reads them. */
export type Step = {
  event: SettlementEvent;
  /** How much of the risk still standing this event consumed. */
  stakePortion: number;
  /** Money that came back because of it, signed. */
  returned: number;
  voided: number;
  /** The risk still standing after it, and the profit folded so far. */
  remainingAfter: number;
  realisedAfter: number;
  /** A result that arrived after the bet had already closed. Kept for leg
   *  statistics and shown as such, never folded twice. */
  ignored: boolean;
};

/** The fold, with its working shown. `recompute` is this and its state. */
export function explain(
  bet: Bet, events: SettlementEvent[], now: string,
): { state: BetState; steps: Step[] } {
  const ordered = [...events].sort((a, b) => a.seq - b.seq);
  const risk = riskPence(bet);

  let remaining = risk;
  let realised = 0;
  let returnedTotal = 0;
  let voided = 0;
  let stakeConsumed = 0;
  let terminated = false;
  const steps: Step[] = [];

  for (const ev of ordered) {
    // A terminal event closes the bet. Later leg grading is still kept for
    // leg statistics, but it stops determining the outcome. Adjustments
    // (a Rule 4, commission, a promo refund landing a week later) still land.
    if (terminated && !ADJUSTMENT_TYPES.has(ev.type)) {
      steps.push({
        event: ev, stakePortion: 0, returned: 0, voided: 0,
        remainingAfter: remaining, realisedAfter: realised, ignored: true,
      });
      continue;
    }

    const netWinningsSoFar = returnedTotal - stakeConsumed;
    const a = applyEvent(bet, ev, remaining, risk, netWinningsSoFar);

    remaining = Math.max(0, remaining - a.stakePortion);
    stakeConsumed += a.stakePortion;
    returnedTotal += a.returned;
    voided += a.voided;
    realised += a.returned - (bet.isFreeBet ? 0 : a.stakePortion);
    if (a.terminal) terminated = true;

    steps.push({
      event: ev, stakePortion: a.stakePortion, returned: a.returned, voided: a.voided,
      remainingAfter: remaining, realisedAfter: realised, ignored: false,
    });
  }

  const status: BetStatus =
    terminated || (risk > 0 && remaining === 0) ? 'settled'
      : remaining < risk ? 'part_settled'
        : 'open';

  const unit = bet.unitPenceAtPlacement || 1;

  return {
    state: {
      betId: bet.id,
      status,
      remainingStakePence: remaining,
      realisedPlPence: realised,
      returnedPence: returnedTotal,
      voidedStakePence: voided,
      units: Number((realised / unit).toFixed(4)),
      outcome: outcomeOf(ordered, realised, remaining),
      updatedAt: now,
    },
    steps,
  };
}

/** The recompute. Nothing else may write bet_state. */
export function recompute(bet: Bet, events: SettlementEvent[], now: string): BetState {
  return explain(bet, events, now).state;
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

/** How much of the risk has been settled, and what the bet is up on it.
 *
 *  This is the same pair the fold works in, read back off a finished state,
 *  so the base a commission is charged on is the base the fold would charge
 *  it on and there is no second definition of "net winnings" to disagree. */
function netWinnings(bet: Bet, state: BetState): number {
  const consumed = riskPence(bet) - state.remainingStakePence;
  return state.returnedPence - consumed;
}

/** The rate a commission event should be appended at, or null for none.
 *
 *  The AMOUNT is deliberately not returned. The fold works it out when the
 *  event lands, from the state at that moment, which is what keeps one
 *  commission formula in the build.
 *
 *  Nothing is appended when there is nothing to charge. A losing bet owes no
 *  commission, so a zero row in somebody's settlement history would be a line
 *  they have to ask about, and a second sweep over a bet that has already
 *  been charged must not charge it twice. */
export function commissionDue(bet: Bet, events: SettlementEvent[], state: BetState): number | null {
  const pct = bet.commissionPct ?? 0;
  if (pct <= 0) return null;
  if (events.some((e) => e.type === 'commission')) return null;
  if (commissionPence(netWinnings(bet, state), pct) <= 0) return null;
  return pct;
}
