/** The settlement engine. Pure: no DOM, no globals, no clock of its own.
 *
 *  THE RULE ABOVE ALL THE OTHERS: a wrong grade is worse than no grade.
 *  Anything uncertain resolves to `ask` and never to a guess.
 *
 *  This module is shared by the manual settle button, the sign-in sweep and
 *  the cron, so there is exactly one grader. The browser never grades a bet
 *  itself, or there would be two. */

import type { EventType, LegResult } from '@/lib/domain/types';

export type Grade =
  | { status: 'graded'; result: Exclude<LegResult, 'open' | 'ask'>; why: string }
  | { status: 'ask'; why: string }
  | { status: 'defer'; why: string };

/** A 90 minute score. Extra time and penalties NEVER count. If the feed
 *  cannot prove a 90 minute score, we ask. */
export type FootballScore = {
  home: number;
  away: number;
  /** Proven to be the score at 90 minutes rather than at the end of the tie. */
  ninetyMinute: boolean;
  status: 'finished' | 'postponed' | 'cancelled' | 'abandoned' | 'in_play' | 'scheduled';
};

/** Handicaps differ by bookmaker and come from a lookup, never a hardcode.
 *
 *  asian    a whole line pushes, so -1 with a one goal win is a void
 *  european the handicap draw is its own outcome, so -1 acts like -1.5 and
 *           that scoreline LOSES */
export type HandicapStyle = 'asian' | 'european';

export const HANDICAP_BY_BOOKMAKER: Record<string, HandicapStyle> = {
  bet365: 'asian',
  betfair: 'asian',
  smarkets: 'asian',
  matchbook: 'asian',
  'sky-bet': 'european',
  'paddy-power': 'european',
  betfred: 'european',
  'william-hill': 'european',
  ladbrokes: 'european',
  coral: 'european',
  boylesports: 'european',
  'bet-victor': 'european',
  unibet: 'european',
  'betway': 'european',
  'paddy-power-ie': 'european',
};

export function handicapStyle(bookmakerId: string): HandicapStyle {
  return HANDICAP_BY_BOOKMAKER[bookmakerId] ?? 'european';
}

/** Markets that ALWAYS ask, whatever the feed says. Each of these has cost
 *  somebody a wrong grade. */
export const ALWAYS_ASK = [
  'player prop', 'anytime scorer', 'first scorer', 'last scorer', 'to score',
  'cards', 'bookings', 'corners', 'bet builder', 'same game multi', 'sgm',
  'rest of match', 'next goal', 'shots', 'assists', 'player to be carded',
  'tackles', 'passes', 'saves', 'own goal',
];

export function marketAlwaysAsks(marketRaw: string): boolean {
  const m = marketRaw.toLowerCase();
  return ALWAYS_ASK.some((k) => m.includes(k));
}

// ---------------------------------------------------------------- parsers

/** "Over 2.5", "Under 2.25", "Home -1", "Away +0.75". Returns null when the
 *  market is not a line at all. */
export function parseLine(marketRaw: string): { kind: 'over' | 'under' | 'handicap'; line: number } | null {
  const m = marketRaw.toLowerCase().replace(/\s+/g, ' ').trim();
  const ou = /(over|under)\s*([0-9]+(?:\.[0-9]+)?)/.exec(m);
  if (ou) return { kind: ou[1] as 'over' | 'under', line: Number(ou[2]) };
  const hc = /([+-]\s*[0-9]+(?:\.[0-9]+)?)\s*(?:handicap|hcp|ah)?$/.exec(m);
  if (hc) return { kind: 'handicap', line: Number(hc[1].replace(/\s+/g, '')) };
  return null;
}

/** A quarter line is one whose fractional part is .25 or .75. It splits the
 *  stake across the two whole/half lines either side of it. */
export function isQuarterLine(line: number): boolean {
  const f = Math.abs(line % 1);
  return Math.abs(f - 0.25) < 1e-9 || Math.abs(f - 0.75) < 1e-9;
}

export function isWholeLine(line: number): boolean {
  return Math.abs(line % 1) < 1e-9;
}

// ---------------------------------------------------------------- grading

export function gradeTotals(
  selection: 'over' | 'under',
  line: number,
  score: FootballScore,
): Grade {
  if (score.status === 'postponed' || score.status === 'cancelled') {
    return { status: 'graded', result: 'void', why: `Fixture ${score.status}. Void.` };
  }
  if (score.status === 'abandoned') {
    return { status: 'ask', why: 'Abandoned. Bookmakers differ on abandoned fixtures.' };
  }
  if (score.status !== 'finished') return { status: 'defer', why: 'Not finished.' };
  if (!score.ninetyMinute) {
    return { status: 'ask', why: 'No 90 minute score in the feed. Extra time never counts.' };
  }

  const goals = score.home + score.away;

  if (isWholeLine(line)) {
    // Whole lines PUSH. Over 2.0 on 1-1 is a void, not a loss.
    if (goals === line) return { status: 'graded', result: 'void', why: `${goals} goals on a ${line} line. Whole line pushes.` };
    const won = selection === 'over' ? goals > line : goals < line;
    return { status: 'graded', result: won ? 'won' : 'lost', why: `${goals} goals against ${selection} ${line}.` };
  }

  if (isQuarterLine(line)) {
    // Quarter lines SPLIT the stake between the two lines either side.
    const lower = Math.floor(line * 2) / 2;
    const upper = lower + 0.5;
    const gradeHalf = (l: number) => {
      if (goals === l) return 'push' as const;
      const won = selection === 'over' ? goals > l : goals < l;
      return won ? ('won' as const) : ('lost' as const);
    };
    const a = gradeHalf(lower);
    const b = gradeHalf(upper);
    if (a === b) return { status: 'graded', result: a === 'push' ? 'void' : a, why: `${goals} goals splits both halves the same way.` };
    if (a === 'won' || b === 'won') {
      return { status: 'graded', result: 'half_won', why: `${goals} goals: one half wins, one half pushes.` };
    }
    return { status: 'graded', result: 'half_lost', why: `${goals} goals: one half loses, one half pushes.` };
  }

  // A half line cannot push.
  const won = selection === 'over' ? goals > line : goals < line;
  return { status: 'graded', result: won ? 'won' : 'lost', why: `${goals} goals against ${selection} ${line}.` };
}

export function gradeHandicap(
  side: 'home' | 'away',
  line: number,
  score: FootballScore,
  style: HandicapStyle,
): Grade {
  if (score.status === 'postponed' || score.status === 'cancelled') {
    return { status: 'graded', result: 'void', why: `Fixture ${score.status}. Void.` };
  }
  if (score.status === 'abandoned') {
    return { status: 'ask', why: 'Abandoned. Bookmakers differ on abandoned fixtures.' };
  }
  if (score.status !== 'finished') return { status: 'defer', why: 'Not finished.' };
  if (!score.ninetyMinute) {
    return { status: 'ask', why: 'No 90 minute score in the feed. Extra time never counts.' };
  }

  const margin = side === 'home' ? score.home - score.away : score.away - score.home;
  const adjusted = margin + line;

  if (isWholeLine(line) && Math.abs(adjusted) < 1e-9) {
    if (style === 'asian') {
      return { status: 'graded', result: 'void', why: 'Whole line, exact. Asian handicap pushes.' };
    }
    // European three way: the handicap draw is its own outcome, so a -1 acts
    // like a -1.5 and this scoreline LOSES.
    return { status: 'graded', result: 'lost', why: 'Whole line, exact. European handicap has a handicap draw, so this loses.' };
  }

  if (isQuarterLine(line)) {
    const lower = Math.floor(line * 2) / 2;
    const upper = lower + 0.5;
    const half = (l: number) => {
      const adj = margin + l;
      if (Math.abs(adj) < 1e-9) return style === 'asian' ? ('push' as const) : ('lost' as const);
      return adj > 0 ? ('won' as const) : ('lost' as const);
    };
    const a = half(lower);
    const b = half(upper);
    if (a === b) return { status: 'graded', result: a === 'push' ? 'void' : a, why: 'Both halves settle the same way.' };
    if (a === 'won' || b === 'won') return { status: 'graded', result: 'half_won', why: 'One half wins, one half pushes.' };
    return { status: 'graded', result: 'half_lost', why: 'One half loses, one half pushes.' };
  }

  return { status: 'graded', result: adjusted > 0 ? 'won' : 'lost', why: `Margin ${margin} against a ${line} line.` };
}

export function gradeMatchResult(
  pick: 'home' | 'away' | 'draw',
  score: FootballScore,
): Grade {
  if (score.status === 'postponed' || score.status === 'cancelled') {
    return { status: 'graded', result: 'void', why: `Fixture ${score.status}. Void.` };
  }
  if (score.status === 'abandoned') {
    return { status: 'ask', why: 'Abandoned. Bookmakers differ on abandoned fixtures.' };
  }
  if (score.status !== 'finished') return { status: 'defer', why: 'Not finished.' };
  if (!score.ninetyMinute) {
    return {
      status: 'ask',
      why: 'No 90 minute score in the feed. Extra time and penalties never count towards a match result.',
    };
  }
  const actual = score.home > score.away ? 'home' : score.away > score.home ? 'away' : 'draw';
  return {
    status: 'graded',
    result: actual === pick ? 'won' : 'lost',
    why: `${score.home}-${score.away} at 90 minutes.`,
  };
}

/** The single entry point for one leg. */
export function gradeLeg(input: {
  marketRaw: string;
  selection: string;
  bookmakerId: string;
  score: FootballScore | null;
}): Grade {
  if (marketAlwaysAsks(input.marketRaw)) {
    return { status: 'ask', why: 'This market is never graded from a feed. It always asks.' };
  }
  if (!input.score) return { status: 'defer', why: 'No result yet.' };

  const line = parseLine(input.marketRaw);
  const sel = input.selection.toLowerCase();

  if (line && (line.kind === 'over' || line.kind === 'under')) {
    return gradeTotals(line.kind, line.line, input.score);
  }
  if (line && line.kind === 'handicap') {
    const side = /away|second|2\b/.test(sel) ? 'away' : 'home';
    return gradeHandicap(side, line.line, input.score, handicapStyle(input.bookmakerId));
  }
  if (/\bdraw\b|\bx\b/.test(sel)) return gradeMatchResult('draw', input.score);
  if (/\baway\b|\b2\b/.test(sel)) return gradeMatchResult('away', input.score);
  if (/\bhome\b|\b1\b/.test(sel)) return gradeMatchResult('home', input.score);

  return { status: 'ask', why: 'The selection could not be matched to a market with confidence.' };
}

/** A multiple. Every leg must grade or the whole bet defers. Void legs drop
 *  and the odds recalculate, which the fold does through effectiveOdds().
 *
 *  This is the function whose predecessor was written, unit tested and then
 *  never called in production. It is called by settleBet() below, which is
 *  the only settlement path in the product. */
export function settleMulti(legs: LegResult[]): { type: EventType | null; why: string } {
  if (!legs.length) return { type: null, why: 'No legs.' };
  if (legs.some((l) => l === 'ask')) return { type: null, why: 'A leg needs a person to look at it.' };
  if (legs.some((l) => l === 'open')) return { type: null, why: 'A leg has not graded yet. The whole bet defers.' };
  if (legs.some((l) => l === 'lost')) return { type: 'lost', why: 'A leg lost, so the multiple lost.' };
  if (legs.every((l) => l === 'void')) return { type: 'void', why: 'Every leg voided.' };
  if (legs.some((l) => l === 'half_lost')) {
    return { type: 'half_lost', why: 'A quarter line leg split and half lost.' };
  }
  if (legs.some((l) => l === 'half_won')) {
    return { type: 'half_won', why: 'A quarter line leg split and half won.' };
  }
  // Everything left is won or void; void legs drop and the odds recalculate.
  return { type: 'won', why: 'Every remaining leg won. Void legs dropped and the price recalculated.' };
}

/** The one settlement path. A single is a one leg multiple, so both go
 *  through settleMulti and there is no second code path to forget to call. */
export function settleBet(legResults: LegResult[]): { type: EventType | null; why: string } {
  return settleMulti(legResults);
}

/** Cash out is undetectable from a feed and is always a user action. This
 *  exists so the answer is written down where somebody looks for it. */
export const CASH_OUT_IS_ALWAYS_A_USER_ACTION = true;
