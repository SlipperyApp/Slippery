import type { DemoBet } from '@/lib/data/demo';
import { isImportedSource } from '@/lib/domain/types';
import { summarise, byDay } from '@/lib/data/analytics';
import { DEFAULT_TZ, type TimeZone } from '@/lib/format';

/** The figures the backend's summarise() returns, by the names it returns
 *  them under.
 *
 *  THIS IS A SEAM, and it is temporary on purpose. The ingestion branch
 *  puts summarise() in lib/server/ledger.ts and it comes back with these
 *  seventeen figures from ONE selection, which is what makes the facets
 *  agree with the row total. Its handoff is explicit that nothing may be
 *  computed client side.
 *
 *  That branch is not merged here yet, so the screens have nothing real to
 *  read. Rather than build them against the demo's own vocabulary and
 *  rename everything later, they are built against the CONTRACT'S
 *  vocabulary now and this adapter supplies it from the demo account. When
 *  the branch lands, this file is deleted and the import moves to
 *  lib/server/ledger: not one component changes.
 *
 *  One figure is honestly absent rather than invented. heldOut counts bets
 *  excluded from every other figure because a question is open on them. The
 *  demo has no unanswered questions, so it is zero, and zero is the truth
 *  here rather than a placeholder.
 *
 *  CLOSING LINE VALUE USED TO BE A SECOND ONE, AND IT IS GONE. It was here
 *  as a shape with a null in it and on the dashboard as a module, and no
 *  closing price feed is wired to anything, so what it did on every account,
 *  every day, was print "Not measured" and explain why. A module that exists
 *  to say it has nothing to say is worse than no module: it takes a slot on
 *  the first screen and teaches the reader that some of the figures here do
 *  not work. It comes back with a price feed behind it and not before. */

export type LedgerSummary = {
  bets: number;
  settled: number;
  running: number;
  netPence: number;
  turnoverPence: number;
  roi: number;
  winRate: number;
  units: number;
  /** Bets left out of every figure above because a question is open. */
  heldOut: number;
  importedBets: number;
  /*  These three never count imported history. That is deliberate on the
      branch and it is deliberate here: a best day you did not have while
      using this product is not a fact about using this product. */
  bestDayPence: number;
  worstDayPence: number;
  longestWinStreak: number;
  exposurePence: number;
  tradedLegs: number;
  trades: number;
};

/*  The set itself lives beside BetSource in lib/domain/types.ts. It was a
    literal here and a second literal in the ledger's facets, and the day a
    sixth source is added a dashboard that excludes it and a chip that
    includes it are two screens disagreeing about the same bet. */
export const isImported = (b: DemoBet) => isImportedSource(b.source);

export function ledgerSummary(rows: DemoBet[], tz: TimeZone = DEFAULT_TZ): LedgerSummary {
  const s = summarise(rows);

  /*  Best day, worst day and the streak are computed off the bets this
      product actually watched happen. Trade legs come out too: a scalp is
      one position, and reporting its two halves as a winner and a loser is
      four wrong numbers at once. */
  const own = rows.filter((b) => !isImported(b) && !b.arbGroupId);
  const days = byDay(own, tz);
  const best = days.reduce((a, d) => Math.max(a, d.netPence), 0);
  const worst = days.reduce((a, d) => Math.min(a, d.netPence), 0);

  const traded = rows.filter((b) => b.arbGroupId);
  const trades = new Set(traded.map((b) => b.arbGroupId)).size;

  return {
    bets: s.count,
    settled: s.settled,
    running: s.open,
    netPence: s.netPence,
    turnoverPence: s.turnoverPence,
    roi: s.roi,
    winRate: s.winRate,
    units: s.units,
    heldOut: 0,
    importedBets: rows.filter(isImported).length,
    bestDayPence: best,
    worstDayPence: worst,
    longestWinStreak: summarise(own).longestWin,
    exposurePence: s.openStakePence,
    tradedLegs: traded.length,
    trades,
  };
}

/** What held-out bets mean, in the one place that has to say it. */
export function heldOutSentence(n: number): string {
  if (n === 0) return 'Every settled bet is counted.';
  return `${n} ${n === 1 ? 'bet is' : 'bets are'} left out of every figure here while a question is open on ${n === 1 ? 'it' : 'them'}.`;
}
