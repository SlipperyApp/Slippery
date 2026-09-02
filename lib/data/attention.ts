import type { DemoBet } from '@/lib/data/demo';

/** What needs you, and nothing else.
 *
 *  The single most useful thing a tracker can tell somebody is which of
 *  their bets is waiting on THEM rather than on a football match. That
 *  question was unanswerable from anywhere in this app: you could see a
 *  count of open bets, but not which of them were still playing and which
 *  had finished hours ago and quietly failed to settle.
 *
 *  FOUR CATEGORIES, AND TWO OF THEM ARE STILL EMPTY HERE. The prototype's
 *  sidebar has a third, "fix problem bets", and it was absent because this
 *  codebase could not honestly compute it: the fields that would carry it
 *  are null on every bet in the demo, so a count built on them would have
 *  read 364 rather than 7.
 *
 *  The ingestion branch computes it properly, and splits it in two, which
 *  is a better answer than the one I said I could not give:
 *
 *    PROPOSAL  a verdict with its evidence, waiting on a yes or a no.
 *              Thirteen markets. GET /api/proposals.
 *    ASK       a question with no proposed answer at all. The review
 *              queue. GET /api/review.
 *
 *  The distinction is the whole design of that settlement engine: a wrong
 *  grade is worse than no grade, so anything uncertain returns a question
 *  rather than a guess. Answering a proposal is one tap; answering an ask
 *  is a decision. Putting them in one row would hide the cheap work behind
 *  the expensive work.
 *
 *  Both are wired through here and both read zero until that branch merges,
 *  because the demo account has no unanswered questions. Zero is the truth,
 *  not a placeholder, and the rows hide themselves at zero.
 *
 *  THE GRACE PERIOD is why there are two categories at all. A bet on a match
 *  that kicked off twenty minutes ago is running; the same bet six hours
 *  later is a bet the settlement pass did not manage to grade, and the only
 *  person who can move it is the account holder. Three and a half hours is a
 *  football match, half time, stoppages and a generous margin, and it is the
 *  longest of the sports this product settles on ninety minute scores.
 *
 *  IT TAKES NO TIME ZONE, deliberately. Every other date computation in this
 *  product was moved onto the account's own zone, because a calendar day is a
 *  local fact and a bettor in Ireland and a server in UTC disagree about
 *  which day a 23:40 bet belongs to. This window is not a day: it is a
 *  duration measured from one instant to another, and an elapsed three and a
 *  half hours is the same three and a half hours in every zone on earth.
 *  Passing a zone in here would be a parameter nothing could read, which is
 *  the dead control this codebase refuses everywhere else. */
export const SETTLE_GRACE_MS = 3.5 * 60 * 60 * 1000;

/*  THREE STATES OF AN OPEN BET, NOT TWO.
 *
 *  "Running" was every open bet whose event was inside the grace window, and
 *  that quietly included every bet whose event had not started. A slip
 *  forwarded on Thursday for a Saturday lunchtime kick off said RUNNING for
 *  two days, with a pulsing dot beside it, on a page whose whole claim is
 *  that it tells you what is actually happening. Nothing was running. The
 *  match had not begun.
 *
 *  RESTING   placed, and the event has not started. Nothing is happening and
 *            nothing is meant to be. It is not a problem and it is not live.
 *  RUNNING   the event is underway. It needs a football match and not a
 *            person, which is why it is separated from waiting.
 *  WAITING   the event finished long enough ago that it should have graded,
 *            and the only person who can move it is the account holder.
 *
 *  The distinction is not cosmetic. Exposure on a resting bet is money
 *  committed to something that has not happened, which is a different fact
 *  from money on a match in the eightieth minute, and a reader who cannot
 *  tell them apart cannot tell what their afternoon looks like. */
export type Attention = {
  /*  Settlements with a proposed answer, waiting on a yes or a no. One tap
      each. Supplied by GET /api/proposals when the ingestion branch lands. */
  proposals: number;
  /*  Questions with no proposed answer. The review queue, GET /api/review.
      A decision each, so they are counted apart from proposals. */
  asks: number;
  /** Open, and the event has not started. */
  resting: DemoBet[];
  /** Open, the event is underway, and it has not had time to finish. */
  running: DemoBet[];
  /** Open, and the event finished long enough ago that it should have graded. */
  waiting: DemoBet[];
  /** Every open bet, whichever of the three it is in. The ledger badge counts
   *  this rather than adding two of the three lists at a call site, which is
   *  how a badge stops agreeing with the page it links to. */
  openCount: number;
  /** Stake sitting on open bets, in minor units. */
  openStakePence: number;
  /** What those open bets return if every one of them lands. */
  toReturnPence: number;
  /** Total that needs a human: waiting only. Running needs a football match
   *  and resting needs a Saturday. */
  count: number;
};

export function attention(bets: DemoBet[], now: Date = new Date()): Attention {
  const nowMs = now.getTime();
  const cutoff = nowMs - SETTLE_GRACE_MS;
  const resting: DemoBet[] = [];
  const running: DemoBet[] = [];
  const waiting: DemoBet[] = [];
  let openStakePence = 0;
  let toReturnPence = 0;

  for (const b of bets) {
    if (b.state.status !== 'open') continue;
    openStakePence += b.state.remainingStakePence;
    /*  Rounded to the penny per bet, not summed and rounded once: the figure
        beside it on screen is a sum of per bet returns, and two roundings of
        the same money that disagree by a penny is a bug report. */
    toReturnPence += Math.round(b.state.remainingStakePence * b.odds);
    const at = new Date(b.eventAt).getTime();
    /*  Strictly greater on both boundaries, so a bet exactly on its own kick
        off is running rather than resting, and a bet exactly on the grace
        period is running rather than waiting. Each state begins the tick
        after the one before it ends, and no bet can be in two. */
    if (at > nowMs) resting.push(b);
    else if (at > cutoff) running.push(b);
    else waiting.push(b);
  }

  const byTime = (a: DemoBet, b: DemoBet) =>
    new Date(a.eventAt).getTime() - new Date(b.eventAt).getTime();
  resting.sort(byTime);
  running.sort(byTime);
  waiting.sort(byTime);

  /*  Both zero until the ingestion branch merges. The demo account has no
      unanswered questions, and inventing some to fill a row is exactly the
      fabricated count this whole comment exists to refuse. */
  const proposals = 0;
  const asks = 0;

  return {
    resting, running, waiting,
    openCount: resting.length + running.length + waiting.length,
    openStakePence, toReturnPence,
    proposals, asks,
    count: waiting.length + proposals + asks,
  };
}

/** The ledger's `needs` filter, so a count in the sidebar goes somewhere. */
export const NEEDS = ['resting', 'running', 'waiting'] as const;
export type Needs = (typeof NEEDS)[number];

export function needsFromParam(v: string | string[] | undefined): Needs | null {
  return typeof v === 'string' && (NEEDS as readonly string[]).includes(v) ? (v as Needs) : null;
}

export function filterByNeeds(bets: DemoBet[], needs: Needs | null, now: Date = new Date()): DemoBet[] {
  if (!needs) return bets;
  const a = attention(bets, now);
  /*  One split, read three ways. The filter reads the same lists the counts
      came off, so a chip promising four rows cannot deliver three. */
  const list = needs === 'resting' ? a.resting : needs === 'running' ? a.running : a.waiting;
  const ids = new Set(list.map((b) => b.id));
  return bets.filter((b) => ids.has(b.id));
}

export const NEEDS_LABEL: Record<Needs, string> = {
  resting: 'Not started yet',
  running: 'Running now',
  waiting: 'Waiting on a result',
};
