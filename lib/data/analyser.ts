/** The analyser: any two of the record's dimensions, crossed.
 *
 *  WHAT THE BREAKDOWN COULD NOT DO. The dashboard's breakdown answers "which
 *  sport" and "which bookmaker" one at a time, which is the shape of the
 *  question somebody asks first and never the shape of the one they ask
 *  second. The second question is always a pair: this tipster on the
 *  handicaps, the short prices at the weekend, the football at the exchange.
 *  A list per dimension cannot answer any of those, and the way people
 *  currently answer them is by exporting to a spreadsheet and building a
 *  pivot, which is a tracker admitting it is not the tool.
 *
 *  RULE 5, AND IT IS WHAT STOPS AN ANALYSER LYING. Every cell here is folded
 *  from the SAME array the page selected, split once, by summarise(): the
 *  same function the ledger, the dashboard and the balance sheet read. The
 *  cells therefore partition the selection, so the rows add up to the total
 *  row by construction rather than by luck, and there is a test that says so
 *  for every axis and every pair of axes. An analyser whose rows do not sum
 *  to its own total is worse than no analyser, because it looks like one.
 *
 *  A THIN ROW SAYS SO. A return over three bets is a coin landing the same
 *  way twice, and printing it in the same weight as a row of four hundred is
 *  the single most misleading thing a tracker can do. The figures are shown,
 *  because hiding them is a different lie, and the row is marked. */

import { summarise, THIN_BETS } from './analytics';
import { effectiveOdds, riskPence } from '@/lib/domain/fold';
import { isInPlay } from '@/lib/domain/types';
import {
  ODDS_BANDS, STAKE_BANDS, oddsBand, stakeBand, bookmakerName,
  marketGroupFor, marketGroupName,
} from './reference';
import { zonedParts, type TimeZone } from '@/lib/format';
import type { DemoBet } from './demo';

export type Axis =
  | 'sport' | 'competition' | 'bookmaker' | 'tipster' | 'market' | 'shape'
  | 'odds' | 'stake' | 'weekday' | 'clock'
  | 'eachWay' | 'freeBet' | 'side' | 'live';

/** Every axis, with the ones whose ORDER carries the meaning marked.
 *
 *  An ordered axis is never sorted by value in the single axis view and it
 *  draws its empty bands, because "you place nothing over 5.00" is an answer
 *  and a missing row is not. Crossed with a second axis it drops the empties:
 *  six odds bands against seven days is forty two rows of which thirty are
 *  blank, and a table of blanks is not a reading of anything. */
export const AXES: { id: Axis; label: string; ordered?: boolean }[] = [
  { id: 'sport', label: 'Sport' },
  { id: 'competition', label: 'Competition' },
  { id: 'bookmaker', label: 'Bookmaker' },
  { id: 'tipster', label: 'Tipster' },
  { id: 'market', label: 'Market' },
  { id: 'shape', label: 'Bet type' },
  { id: 'odds', label: 'Odds band', ordered: true },
  { id: 'stake', label: 'Stake band', ordered: true },
  { id: 'weekday', label: 'Day of the week', ordered: true },
  { id: 'clock', label: 'Time of day', ordered: true },
  { id: 'eachWay', label: 'Each way or not' },
  { id: 'freeBet', label: 'Free bet or not' },
  { id: 'side', label: 'Back or lay' },
  { id: 'live', label: 'In play or pre match' },
];

export const AXIS_IDS = AXES.map((a) => a.id);

/** An axis id from a query string, or null. Matched against the list rather
 *  than looked up in an object, so `?dim=toString` is not an axis: a plain
 *  object literal inherits from Object.prototype and every prototype key
 *  reads as a hit. That defect took /api/share down for weeks. */
export function axisFromParam(value: unknown): Axis | null {
  return typeof value === 'string' && AXIS_IDS.includes(value as Axis) ? (value as Axis) : null;
}

export function axisLabel(a: Axis): string {
  return AXES.find((x) => x.id === a)?.label ?? a;
}

export function isOrdered(a: Axis): boolean {
  return AXES.find((x) => x.id === a)?.ordered === true;
}

/*  --------------------------------------------------------- the two clocks
 *
 *  Both of these read the ACCOUNT'S zone, not the server's. A Saturday in
 *  Dublin and a Saturday in UTC disagree for the first hour of every summer
 *  Saturday, and "which day of the week am I good on" answered in the wrong
 *  zone moves a chunk of every Friday night into Saturday. */

const WEEKDAY_LABEL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export const CLOCK_BANDS: { id: string; label: string; from: number; to: number }[] = [
  { id: 'morning', label: 'Before noon', from: 0, to: 12 },
  { id: 'afternoon', label: 'Noon to 5pm', from: 12, to: 17 },
  { id: 'evening', label: '5pm to 9pm', from: 17, to: 21 },
  { id: 'late', label: 'After 9pm', from: 21, to: 24 },
];

const SPORT_LABEL: Record<string, string> = {
  football: 'Football', tennis: 'Tennis', 'horse-racing': 'Horse racing',
};

const TIPSTER_LABEL: Record<string, string> = {
  own: 'My own', 'coupon-club': 'Coupon Club', 'value-tips': 'Value Tips', 'the-rails': 'The Rails',
};

const SHAPE_LABEL: Record<string, string> = {
  single: 'Single',
  multi_same_fixture: 'Multiple, one fixture',
  multi_cross_fixture: 'Accumulator',
  each_way: 'Each way',
  system: 'System',
};

export type AxisContext = {
  unitPence: number;
  tz: TimeZone;
  /** Sunday or Monday, so the day of the week axis starts where the
   *  account's own calendar starts. */
  weekStart: 0 | 1;
};

type Bucket = { key: string; label: string; order: number };

/** Which bucket one bet falls in, on one axis. The ONLY place a bet is
 *  turned into a group, so the table and its export cannot disagree. */
export function bucketOf(b: DemoBet, axis: Axis, ctx: AxisContext): Bucket {
  switch (axis) {
    case 'sport':
      return { key: b.sportId, label: SPORT_LABEL[b.sportId] ?? b.sportId, order: 0 };
    case 'competition': {
      /*  A blank competition is its own group and says what it is. Folding
          it into another one would move real bets into a row that did not
          have them, and dropping it would break the row total. */
      const c = b.competition ?? b.course;
      return { key: c ?? 'none', label: c ?? 'Not recorded', order: 0 };
    }
    case 'bookmaker':
      return { key: b.bookmakerId, label: bookmakerName(b.bookmakerId), order: 0 };
    case 'tipster': {
      const id = b.tipsterId ?? 'own';
      return { key: id, label: TIPSTER_LABEL[id] ?? id, order: 0 };
    }
    case 'market': {
      const g = marketGroupFor(b.marketRaw);
      return { key: g, label: marketGroupName(g), order: 0 };
    }
    case 'shape':
      return { key: b.shape, label: SHAPE_LABEL[b.shape] ?? b.shape, order: 0 };
    case 'odds': {
      const id = oddsBand(effectiveOdds(b));
      const i = ODDS_BANDS.findIndex((x) => x.id === id);
      return { key: id, label: ODDS_BANDS[i]?.label ?? id, order: i };
    }
    case 'stake': {
      const id = stakeBand(riskPence(b), b.unitPenceAtPlacement || ctx.unitPence);
      const i = STAKE_BANDS.findIndex((x) => x.id === id);
      return { key: id, label: STAKE_BANDS[i]?.label ?? id, order: i };
    }
    case 'weekday': {
      const p = zonedParts(b.eventAt, ctx.tz);
      const dow = new Date(Date.UTC(p.year, p.month - 1, p.day)).getUTCDay();
      return {
        key: String(dow),
        label: WEEKDAY_LABEL[dow],
        order: (dow - ctx.weekStart + 7) % 7,
      };
    }
    case 'clock': {
      const hour = zonedParts(b.eventAt, ctx.tz).hour;
      const i = Math.max(0, CLOCK_BANDS.findIndex((x) => hour >= x.from && hour < x.to));
      return { key: CLOCK_BANDS[i].id, label: CLOCK_BANDS[i].label, order: i };
    }
    case 'eachWay':
      return b.isEachWay
        ? { key: 'ew', label: 'Each way', order: 0 }
        : { key: 'win', label: 'Win only', order: 1 };
    case 'freeBet':
      /*  A free bet, bonus funds and a boosted price are all money the
          bookmaker put in, and the dashboard already counts them together
          under offers. Two definitions of the same split on two screens is
          how a figure ends up disagreeing with itself. */
      return (b.isFreeBet || b.isBonusFunds || b.isBoosted)
        ? { key: 'offer', label: 'Offer or free bet', order: 0 }
        : { key: 'own', label: 'Your own stake', order: 1 };
    case 'side':
      return b.side === 'lay'
        ? { key: 'lay', label: 'Lay', order: 1 }
        : { key: 'back', label: 'Back', order: 0 };
    case 'live':
      return isInPlay(b)
        ? { key: 'live', label: 'In play', order: 1 }
        : { key: 'pre', label: 'Pre match', order: 0 };
    default:
      return { key: 'all', label: 'All', order: 0 };
  }
}

/** Every band an ordered axis has, in order, including ones with no bets.
 *
 *  A band that is missing reads as a band you did not bet in only if it is
 *  still drawn. Empty for the unordered axes, which have no band list: their
 *  groups are whatever the record contains. */
function emptyBands(axis: Axis, ctx: AxisContext): Bucket[] {
  switch (axis) {
    case 'odds': return ODDS_BANDS.map((b, i) => ({ key: b.id, label: b.label, order: i }));
    case 'stake': return STAKE_BANDS.map((b, i) => ({ key: b.id, label: b.label, order: i }));
    case 'clock': return CLOCK_BANDS.map((b, i) => ({ key: b.id, label: b.label, order: i }));
    case 'weekday': return WEEKDAY_LABEL.map((label, dow) => ({
      key: String(dow), label, order: (dow - ctx.weekStart + 7) % 7,
    }));
    default: return [];
  }
}

// ------------------------------------------------------------------- cells

export type Cell = {
  key: string;
  /** The first axis's group, and the second's when there is one. */
  label: string;
  label2: string | null;
  order: number;
  bets: number;
  won: number;
  lost: number;
  placed: number;
  voided: number;
  stakedMinor: number;
  turnoverMinor: number;
  returnedMinor: number;
  netMinor: number;
  roi: number;
  units: number;
  winRate: number;
  avgOdds: number;
  /** Fewer than THIN_BETS bets. The figures are still here. */
  thin: boolean;
};

export type CrossTab = {
  rows: Cell[];
  /** The whole selection, folded the same way. Every row sums to this. */
  total: Cell;
  axis: Axis;
  axis2: Axis | null;
};

/*  Every column a row can be read by, and the only list of them.
    The table's headers, its sort and the export all come from here, so a
    column that sorts and a column that exports cannot come apart. */
export type Column = {
  id: string;
  label: string;
  /** How the value is drawn, which is also how it is exported. */
  kind: 'text' | 'count' | 'money' | 'pct' | 'units' | 'odds';
  /** Takes a plus in front of a positive. True for the figures that can go
   *  either way and false for the ones that cannot: "+£2,270.25 staked" is
   *  not a thing anybody says. */
  signed?: boolean;
  get: (c: Cell) => number | string;
};

export const COLUMNS: Column[] = [
  { id: 'bets', label: 'Bets', kind: 'count', get: (c) => c.bets },
  { id: 'won', label: 'Won', kind: 'count', get: (c) => c.won },
  { id: 'lost', label: 'Lost', kind: 'count', get: (c) => c.lost },
  { id: 'void', label: 'Void', kind: 'count', get: (c) => c.voided },
  { id: 'staked', label: 'Staked', kind: 'money', get: (c) => c.stakedMinor },
  { id: 'returned', label: 'Returned', kind: 'money', get: (c) => c.returnedMinor },
  { id: 'net', label: 'Net', kind: 'money', signed: true, get: (c) => c.netMinor },
  { id: 'roi', label: 'Return', kind: 'pct', get: (c) => c.roi },
  { id: 'units', label: 'Units', kind: 'units', get: (c) => c.units },
  { id: 'winRate', label: 'Win rate', kind: 'pct', get: (c) => c.winRate },
  { id: 'avgOdds', label: 'Average price', kind: 'odds', get: (c) => c.avgOdds },
];

export const COLUMN_IDS = ['group', ...COLUMNS.map((c) => c.id)];

/** A column id from a query string, or null. Checked against the list rather
 *  than against an object, for the same reason axisFromParam is. */
export function columnFromParam(value: unknown): string | null {
  return typeof value === 'string' && COLUMN_IDS.includes(value) ? value : null;
}

/** One bucket of bets, folded. Every figure comes from summarise(), so a
 *  cell here and the same selection on the ledger are the same numbers. */
function cell(key: string, label: string, label2: string | null, order: number, rows: DemoBet[]): Cell {
  const s = summarise(rows);
  return {
    key, label, label2, order,
    bets: s.count,
    won: s.wins,
    lost: s.losses,
    placed: s.placed,
    voided: s.voids,
    stakedMinor: s.stakedPence,
    turnoverMinor: s.turnoverPence,
    returnedMinor: s.returnedPence,
    netMinor: s.netPence,
    roi: s.roi,
    units: s.units,
    winRate: s.winRate,
    avgOdds: s.avgOdds,
    thin: s.count < THIN_BETS,
  };
}

/** The cross tab. One array in, one set of cells out, and they partition it.
 *
 *  The second axis is optional. With one axis the ordered ones draw their
 *  empty bands; crossed, they do not, because six bands against seven days
 *  is forty two rows of which most are blank. */
export function crosstab(
  rows: DemoBet[], axis: Axis, axis2: Axis | null, ctx: AxisContext,
): CrossTab {
  const groups = new Map<string, { label: string; label2: string | null; order: number; rows: DemoBet[] }>();

  if (!axis2) {
    for (const band of emptyBands(axis, ctx)) {
      groups.set(band.key, { label: band.label, label2: null, order: band.order, rows: [] });
    }
  }

  for (const b of rows) {
    const one = bucketOf(b, axis, ctx);
    const two = axis2 ? bucketOf(b, axis2, ctx) : null;
    const key = two ? `${one.key} ${two.key}` : one.key;
    const cur = groups.get(key) ?? {
      label: one.label,
      label2: two ? two.label : null,
      /*  The first axis's order dominates, so a crossed table reads down the
          first axis with the second nested inside it. A thousand is room for
          any band list this product has. */
      order: two ? one.order * 1000 + two.order : one.order,
      rows: [] as DemoBet[],
    };
    cur.rows.push(b);
    groups.set(key, cur);
  }

  const cells = [...groups.entries()].map(([key, g]) => cell(key, g.label, g.label2, g.order, g.rows));

  return {
    rows: cells,
    /*  The total is folded from the WHOLE array rather than added up from
        the cells. That is the point: if the two ever disagree, the table is
        wrong and it will say so on its own face. */
    total: cell('all', 'All', null, 0, rows),
    axis,
    axis2,
  };
}

// ------------------------------------------------------------------- sort

export type Dir = 'asc' | 'desc';

/** Sort the cells. Pure, and shared by the table and the export, so the file
 *  somebody downloads is in the order they were looking at.
 *
 *  An ORDERED axis sorted by its group column keeps its band order rather
 *  than going alphabetical: "1.50 to 2.00" before "10.00 and up" is the
 *  whole read of a price ladder, and A before B is not a fact about odds. */
export function sortCells(tab: CrossTab, column: string, dir: Dir): Cell[] {
  const rows = [...tab.rows];
  const sign = dir === 'asc' ? 1 : -1;

  if (column === 'group') {
    const ordered = isOrdered(tab.axis) || (tab.axis2 !== null && isOrdered(tab.axis2));
    rows.sort((a, b) => (ordered
      ? sign * (a.order - b.order)
      : sign * (`${a.label} ${a.label2 ?? ''}`).localeCompare(`${b.label} ${b.label2 ?? ''}`)));
    return rows;
  }

  const col = COLUMNS.find((c) => c.id === column);
  if (!col) return rows;
  rows.sort((a, b) => {
    const x = col.get(a);
    const y = col.get(b);
    /*  A stable tie break on the group's own order, so two rows with the
        same net cannot swap places between two renders and make a table
        look like it is shuffling itself. */
    if (x === y) return a.order - b.order || a.key.localeCompare(b.key);
    return sign * (Number(x) - Number(y));
  });
  return rows;
}

/** What the table opens on: the first axis's own order for an ordered axis,
 *  biggest net first for anything else. */
export function defaultSort(axis: Axis): { column: string; dir: Dir } {
  return isOrdered(axis) ? { column: 'group', dir: 'asc' } : { column: 'net', dir: 'desc' };
}
