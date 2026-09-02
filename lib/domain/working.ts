/** The working behind a bet, in the words a bettor uses.
 *
 *  "One tap on any settled bet reveals the maths. This builds trust in every
 *  other number." What the sheet listed instead was the settlement events by
 *  their type names: `half_won`, `cash_out_partial`, `rule4`. Every one of
 *  those is the correct name for what happened and none of them is an
 *  explanation, so the screen that exists to make a figure believable was
 *  reading as the inside of the database.
 *
 *  Two rules hold this together.
 *
 *  Nothing is recomputed here. The per event numbers come from `explain()`,
 *  which is the fold itself, so the working cannot disagree with the profit
 *  printed above it. A second settlement implementation in the view is
 *  exactly the defect rule 2 of this codebase is written against.
 *
 *  Nothing is formatted here. A line carries integer minor units, a decimal
 *  price or plain text, and the view formats it through lib/format.ts. That
 *  is what stops this module quietly becoming a second opinion on what a
 *  pound looks like. */

import { effectiveOdds, explain, riskPence, turnoverPence, type Step } from './fold';
import { placeTerms } from '@/lib/odds';
import { ewTerms } from '@/lib/format';
import { isImportedSource } from './types';
import type { Bet, BetLeg, BetState, SettlementEvent } from './types';

/** A bet with the state folded from its events, which is every bet a screen
 *  ever holds. */
export type WorkingBet = Bet & { state: BetState; events: SettlementEvent[] };

export type WorkingLine = {
  /** A subheading this line sits under. Empty means the bet's own figures. */
  group: string;
  /** What makes this group a DIFFERENT group from the one above it.
   *
   *  Two pulls on the same bet can be four eighths each, so their headings
   *  are word for word identical, and a view that started a new group when
   *  the heading text changed drew one heading over six lines: two cash outs
   *  read as one, with the second pull's stake looking like part of the
   *  first. The key is per event, so the same words twice are still two
   *  groups. */
  groupKey: string;
  label: string;
  /** Exactly one of the four carries the value. */
  minor: number | null;
  odds: number | null;
  units: number | null;
  text: string | null;
  /** Print the sign. A profit wants it; an amount that came back does not. */
  sign: boolean;
  /** A summary line, drawn under a rule. */
  foot: boolean;
  hint: string | null;
  /** When it happened and who entered it, for a line that came from a
   *  settlement event. The change history is the other half of trusting a
   *  figure: a correction made after the result was known is a different
   *  fact from one made before it. */
  at: string | null;
  by: string | null;
  late: boolean;
};

export type Working = {
  lines: WorkingLine[];
  /** From bet_state, never from the lines. Every displayed figure reads the
   *  fold's own output. */
  netPence: number;
  units: number;
  /** The denominator of the return figure, which is turnover and not stake:
   *  voided stake is out of it everywhere in the product, or a bet that was
   *  never at risk flatters the percentage beside it. Zero when nothing was
   *  turned over, and a zero denominator has no percentage rather than a
   *  0.0% somebody did not earn. */
  turnoverPence: number;
  /** Plain sentences. No figures in them: the figures are in the lines, and
   *  a number written twice is a number that can be wrong in one place. */
  notes: string[];
  /** One half of an each way bet, shown without the other half. */
  halfOnly: boolean;
};

const blank = {
  group: '', groupKey: '', minor: null, odds: null, units: null, text: null,
  sign: false, foot: false, hint: null, at: null, by: null, late: false,
};

const cash = (label: string, minor: number, over: Partial<WorkingLine> = {}): WorkingLine =>
  ({ ...blank, label, minor, ...over });

const price = (label: string, odds: number, over: Partial<WorkingLine> = {}): WorkingLine =>
  ({ ...blank, label, odds, ...over });

/** What one settlement event did, said out loud.
 *
 *  A partial cash out is the only one that needs more than a line, because
 *  the eighths are of what was LEFT rather than of the original stake, and
 *  that is the single thing about it people get wrong. */
function stepLines(bet: WorkingBet, step: Step): WorkingLine[] {
  const e = step.event;
  const from = {
    at: e.occurredAt,
    by: e.enteredBy,
    late: e.afterResultKnown,
  };

  if (step.ignored) {
    return [{
      ...blank, ...from, label: 'A later result, not counted', text: e.type.replace(/_/g, ' '),
      hint: 'The bet had already closed when this landed, so it changed nothing.',
    }];
  }

  switch (e.type) {
    case 'won':
    case 'placed':
      return [cash(e.type === 'placed' ? 'Came back on the place' : 'Came back', step.returned, {
        ...from,
        hint: bet.side === 'lay'
          ? 'Your liability back, plus the stake the backer put up.'
          : bet.isFreeBet
            ? 'The winnings only. A free bet stake stays with the bookmaker.'
            : 'Stake times price.',
      })];

    case 'lost':
      return [cash('Came back', step.returned, { ...from, hint: 'Nothing, so the loss is the stake.' })];

    case 'void':
    case 'push':
      return [cash('Stake returned', step.returned, {
        ...from,
        hint: 'A void pays nothing and takes nothing, and the stake leaves your turnover.',
      })];

    case 'half_won':
    case 'half_lost':
      return [cash('Came back', step.returned, {
        ...from,
        hint: e.type === 'half_won'
          ? 'Half the stake won at the price, and half came back because that half of the line pushed.'
          : 'Half the stake was lost, and half came back because that half of the line pushed.',
      })];

    case 'cash_out_full':
      return [cash('Cashed out in full', step.returned, {
        ...from, hint: 'A price you took instead of a result.',
      })];

    case 'cash_out_partial': {
      const group = `Cashed out ${e.fractionEighths} of 8 of what was still standing`;
      const groupKey = `pull-${e.id}`;
      /*  The when and the who go on the money line alone. Carried on all
          three, one pull printed "5 Apr, 21:45 · by you" three times in six
          inches, which is the page insisting on a fact nobody asked twice
          about. */
      return [
        cash('Stake it came out of', step.stakePortion, { group, groupKey }),
        cash('The bookmaker paid', step.returned, { ...from, group, groupKey }),
        cash('Still standing after it', step.remainingAfter, { group, groupKey }),
      ];
    }

    case 'rule4':
      return [cash(`Rule 4, ${e.deductionPence}p in the pound`, step.returned, {
        ...from, sign: true, hint: 'Off the winnings only, never off the stake.',
      })];

    case 'commission':
      return [cash(`Commission at ${e.commissionPct ?? bet.commissionPct}%`, step.returned, {
        ...from, sign: true, hint: 'On the winnings only, so a losing bet pays none.',
      })];

    case 'promo_refund':
      return [cash('Refund from the bookmaker', step.returned, { ...from, sign: true })];

    case 'manual_correction':
      return [cash('Correction', step.returned, {
        ...from, sign: true,
        hint: 'A correction is a new entry rather than an edit, so the record stays true.',
      })];

    default:
      return [];
  }
}

/** The stake and the price, which every bet starts from. */
function openingLines(bet: WorkingBet, group = ''): WorkingLine[] {
  const groupKey = group;
  const odds = effectiveOdds(bet);
  const voidLeg = bet.legs.some((l) => l.legResult === 'void');
  const lines: WorkingLine[] = [
    cash(bet.side === 'lay' ? 'Your liability' : 'Stake', riskPence(bet), {
      group, groupKey,
      hint: bet.side === 'lay'
        ? 'A lay risks the liability, not the stake.'
        : bet.isFreeBet ? 'A free bet, so none of it is your money.' : null,
    }),
    price('Price', odds, {
      group, groupKey,
      hint: voidLeg ? 'A void leg dropped out and the price recalculated.' : null,
    }),
  ];
  if (bet.side === 'lay') {
    lines.splice(1, 0, cash('The backer put up', bet.stakePence, { group, groupKey }));
  }
  return lines;
}

function noteList(bet: WorkingBet, steps: Step[], eachWay: boolean): string[] {
  const has = (t: SettlementEvent['type']) => steps.some((s) => !s.ignored && s.event.type === t);
  const notes: string[] = [];

  if (eachWay) notes.push('An each way bet is two bets: half the stake on the win, half on the place.');
  if (bet.side === 'lay') notes.push('Laying risks the liability and wins the stake the backer put up.');
  if (bet.isFreeBet) notes.push('A free bet returns the winnings and not the stake, so the stake is not in the profit.');
  if (has('half_won') || has('half_lost')) notes.push('A quarter line splits the stake: half settles at the price and half comes back.');
  if (has('void') || has('push')) notes.push('A void leaves your turnover as well as your profit, so it cannot flatter your return.');
  /*  Two sentences, not one. The eighths clause is about a partial pull and
      was being printed under a full cash out, where there are no eighths to
      be of anything and the sentence answers a question nobody asked. */
  if (has('cash_out_partial') || has('cash_out_full')) {
    notes.push('A cash out is a price you took rather than a result, so the profit is what you were paid less the stake it came out of.');
  }
  if (has('cash_out_partial')) {
    notes.push('The eighths are always of the stake still standing, never of the original stake.');
  }
  if (has('rule4')) notes.push('A Rule 4 is the deduction a bookmaker makes when a runner comes out after you bet.');
  if (steps.some((s) => s.ignored)) notes.push('One later result is shown without being counted, because the bet had already closed.');
  return notes;
}

/** The working for one bet, or for both halves of an each way bet.
 *
 *  `other` is the sibling half. It comes from the whole book rather than from
 *  the filtered rows on purpose: a facet that hides the losing win half would
 *  otherwise leave the place half claiming to be the whole bet, which is the
 *  one number on this screen a reader has no way to check. */
export function working(bet: WorkingBet, other?: WorkingBet | null): Working {
  const pair = other && other.ewGroupId && other.ewGroupId === bet.ewGroupId ? other : null;

  if (pair) {
    const win = bet.ewPart === 'win' ? bet : pair;
    const place = bet.ewPart === 'win' ? pair : bet;
    const terms = placeTerms(place.ewPlaceFraction ?? win.ewPlaceFraction);
    const lines: WorkingLine[] = [];

    for (const [half, label] of [[win, 'The win half'], [place, 'The place half']] as const) {
      const opening = openingLines(half, label);
      if (label === 'The place half' && terms) {
        opening[opening.length - 1].hint = `${terms} of the win price, which is what a place pays.`;
      }
      lines.push(...opening);
      for (const step of explain(half, half.events, half.state.updatedAt).steps) {
        lines.push(...stepLines(half, step).map((l) => ({
          ...l,
          group: l.group || label,
          groupKey: l.groupKey || label,
        })));
      }
    }

    const netPence = win.state.realisedPlPence + place.state.realisedPlPence;
    lines.push(
      cash('Staked in total', riskPence(win) + riskPence(place), { foot: true }),
      cash('Back in total', win.state.returnedPence + place.state.returnedPence, { foot: true }),
      cash('Profit', netPence, { foot: true, sign: true }),
      { ...blank, label: 'In units', units: Number((win.state.units + place.state.units).toFixed(4)), foot: true },
    );

    return {
      lines,
      netPence,
      units: Number((win.state.units + place.state.units).toFixed(4)),
      turnoverPence: turnoverPence(win, win.state) + turnoverPence(place, place.state),
      notes: [
        ...new Set([
          ...noteList(win, explain(win, win.events, win.state.updatedAt).steps, true),
          ...noteList(place, explain(place, place.events, place.state.updatedAt).steps, true),
        ]),
      ],
      halfOnly: false,
    };
  }

  const { steps } = explain(bet, bet.events, bet.state.updatedAt);
  const lines = openingLines(bet);
  for (const step of steps) lines.push(...stepLines(bet, step));

  const s = bet.state;
  const counted = steps.filter((x) => !x.ignored);
  /*  "Back in total" is only worth a line when something added up. On a
      single winner it would repeat the line above it, and a summary that
      restates its only input is the shape that makes a table read as a
      dump. */
  const multipart = counted.length > 1;

  if (steps.length === 0) {
    lines.push(cash('To return if it wins', Math.round(riskPence(bet) * effectiveOdds(bet)), {
      foot: true, hint: 'Nothing has settled yet, so there is no profit to show.',
    }));
    return {
      lines, netPence: 0, units: 0, turnoverPence: 0,
      notes: noteList(bet, steps, false), halfOnly: false,
    };
  }

  if (s.remainingStakePence > 0) {
    lines.push(cash('Still standing', s.remainingStakePence, { foot: true }));
  }
  if (multipart) lines.push(cash('Back in total', s.returnedPence, { foot: true }));
  lines.push(
    cash('Profit', s.realisedPlPence, { foot: true, sign: true }),
    { ...blank, label: 'In units', units: s.units, foot: true },
  );

  return {
    lines,
    netPence: s.realisedPlPence,
    units: s.units,
    turnoverPence: turnoverPence(bet, s),
    notes: noteList(bet, steps, false),
    halfOnly: Boolean(bet.ewGroupId),
  };
}

/** WHAT A MULTI IS, IN ONE LINE, and it has to name the matches.
 *
 *  A five fold read "Over 2.5 goals / Over 2.5 goals / Over 2.5 goals /
 *  Over 2.5 goals / Over 2.5 goals" in the ledger and the same again in the
 *  export's legs column: five identical markets, no fixtures, no day.
 *  Somebody looking for last Saturday's acca could not find it, and a column
 *  of repeated market names reads as generated data rather than as a record
 *  of something that happened.
 *
 *  The fixture was there the whole time. `BetLeg.eventName` is populated and
 *  the bet sheet has always printed it. One function, so the row and the
 *  export cannot describe the same acca two ways. */
export function legLine(legs: Pick<BetLeg, 'selection' | 'eventName'>[]): string {
  return legs
    .map((l) => (l.eventName && l.eventName !== l.selection ? `${l.selection}, ${l.eventName}` : l.selection))
    .join(' · ');
}

/** What the ledger row and the export both call this bet.
 *
 *  One list, because the row's markers and the export's `tags` column were
 *  about to be two lists of the same facts, and the day somebody adds a
 *  marker to one of them the export starts describing a different bet from
 *  the row above it. */
export function betTags(bet: Pick<Bet,
  'isFreeBet' | 'isBonusFunds' | 'isBoosted' | 'side' | 'isEachWay' | 'slipBacked' | 'source' | 'arbGroupId'
  | 'ewPlaceFraction' | 'placesPaid'>,
): string[] {
  /*  The each way terms travel with the marker. A row that says Placed and
      does not say what a place was worth or how many there were is the
      outcome without the terms that produced it, and the export would have
      the same hole. Whichever half of the terms is missing, ewTerms leaves
      it out rather than guessing, and a bet with neither is still Each way. */
  const terms = bet.isEachWay ? ewTerms(bet.ewPlaceFraction, bet.placesPaid) : '';
  return [
    bet.isFreeBet ? 'Free bet' : null,
    bet.isBonusFunds ? 'Bonus funds' : null,
    bet.isBoosted ? 'Boosted' : null,
    bet.side === 'lay' ? 'Lay' : null,
    bet.isEachWay ? (terms ? `Each way, ${terms}` : 'Each way') : null,
    bet.arbGroupId ? 'Arb' : null,
    /*  Imported before typed in, and never both. Every imported bet is also
        not slip backed, so a row that said "Imported · Typed in" would be
        saying one thing twice, and the vaguer of the two is the one that
        loses. */
    isImportedSource(bet.source) ? 'Imported' : bet.slipBacked ? null : 'Typed in',
  ].filter((t): t is string => t !== null);
}
