import type { DemoBet } from '@/lib/data/demo';

/** What needs you, and nothing else.
 *
 *  The single most useful thing a tracker can tell somebody is which of
 *  their bets is waiting on THEM rather than on a football match. That
 *  question was unanswerable from anywhere in this app: you could see a
 *  count of open bets, but not which of them were still playing and which
 *  had finished hours ago and quietly failed to settle.
 *
 *  TWO CATEGORIES, NOT THREE. The prototype's sidebar has a third, "fix
 *  problem bets", and it is not here because this codebase cannot honestly
 *  compute it. The fields that would carry it, marketGroupId on a bet and
 *  fixtureId on a leg, are null on every bet in the demo account, so a count
 *  built on them would read 364 rather than 7. A made up number in the place
 *  a real one goes is worse than an absent row: it is the row somebody
 *  clicks first. When the reader that populates those fields lands, the
 *  third category is four lines here and a row in the sidebar.
 *
 *  THE GRACE PERIOD is why there are two categories at all. A bet on a match
 *  that kicked off twenty minutes ago is running; the same bet six hours
 *  later is a bet the settlement pass did not manage to grade, and the only
 *  person who can move it is the account holder. Three and a half hours is a
 *  football match, half time, stoppages and a generous margin, and it is the
 *  longest of the sports this product settles on ninety minute scores. */
export const SETTLE_GRACE_MS = 3.5 * 60 * 60 * 1000;

export type Attention = {
  /** Open, and the event has not had time to finish. */
  running: DemoBet[];
  /** Open, and the event finished long enough ago that it should have graded. */
  waiting: DemoBet[];
  /** Stake sitting on open bets, in minor units. */
  openStakePence: number;
  /** What those open bets return if every one of them lands. */
  toReturnPence: number;
  /** Total that needs a human: waiting only. Running needs a football match. */
  count: number;
};

export function attention(bets: DemoBet[], now: Date = new Date()): Attention {
  const cutoff = now.getTime() - SETTLE_GRACE_MS;
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
    (new Date(b.eventAt).getTime() > cutoff ? running : waiting).push(b);
  }

  const byTime = (a: DemoBet, b: DemoBet) =>
    new Date(a.eventAt).getTime() - new Date(b.eventAt).getTime();
  running.sort(byTime);
  waiting.sort(byTime);

  return { running, waiting, openStakePence, toReturnPence, count: waiting.length };
}

/** The ledger's `needs` filter, so a count in the sidebar goes somewhere. */
export const NEEDS = ['running', 'waiting'] as const;
export type Needs = (typeof NEEDS)[number];

export function needsFromParam(v: string | string[] | undefined): Needs | null {
  return typeof v === 'string' && (NEEDS as readonly string[]).includes(v) ? (v as Needs) : null;
}

export function filterByNeeds(bets: DemoBet[], needs: Needs | null, now: Date = new Date()): DemoBet[] {
  if (!needs) return bets;
  const a = attention(bets, now);
  const ids = new Set((needs === 'running' ? a.running : a.waiting).map((b) => b.id));
  return bets.filter((b) => ids.has(b.id));
}

export const NEEDS_LABEL: Record<Needs, string> = {
  running: 'Running now',
  waiting: 'Waiting on a result',
};
