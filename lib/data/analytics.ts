/** Every figure the product reports.
 *
 *  One module, so a banner, a ledger and a facet row cannot disagree. The
 *  previous build had a banner saying 486 bets, a ledger saying 482 and
 *  facets summing to 474. Here, `select()` produces one array and everything
 *  else counts that same array: the facet total equals the row total by
 *  construction.
 *
 *  Voided stake is excluded from turnover and from the ROI denominator
 *  everywhere. Free bet stakes are excluded from turnover. Arb pairs count to
 *  net and turnover but never to win rate, streaks or average odds. */

import { turnoverPence, riskPence, effectiveOdds } from '@/lib/domain/fold';
import { balanceMinor, type Movement } from '@/lib/domain/movements';
import { isImportedSource } from '@/lib/domain/types';
import type { Currency, Outcome, SportId } from '@/lib/domain/types';
import type { DemoBet } from './demo';
import { dayKey, zonedParts, startOfDay, DEFAULT_TZ, type TimeZone } from '@/lib/format';
import { ODDS_BANDS, STAKE_BANDS, oddsBand, stakeBand, marketGroupFor, marketGroupName, bookmakerName } from './reference';

export type Period = 'today' | 'week' | 'month' | 'year' | 'all';

/*  TWO NAMES FOR A PERIOD, and they are not the same job.
 *
 *  `label` reads inside a sentence: "Net, this month", "385 bets · This
 *  week". `chip` is the strip, where the group is already labelled Period
 *  and the word "This" is therefore on three of the five chips carrying
 *  nothing at all.
 *
 *  Five periods at their sentence length do not fit across a phone, so the
 *  strip scrolled and opened on All time with Today parked off the left
 *  edge, one letter of it showing under the fade: a word dissolving mid
 *  letter reads as a rendering fault rather than as an affordance. At chip
 *  length all five fit at 390 and there is nothing to scroll. */
export const PERIODS: { id: Period; label: string; chip: string }[] = [
  { id: 'today', label: 'Today', chip: 'Today' },
  { id: 'week', label: 'This week', chip: 'Week' },
  { id: 'month', label: 'This month', chip: 'Month' },
  { id: 'year', label: 'This year', chip: 'Year' },
  { id: 'all', label: 'All time', chip: 'All' },
];

export type Scope = {
  period: Period;
  bookmakerId: string | 'all';
  sportId: SportId | 'all';
};

export const DEFAULT_SCOPE: Scope = { period: 'month', bookmakerId: 'all', sportId: 'all' };

export function scopeFromParams(
  sp: Record<string, string | string[] | undefined>,
  /** The example account opens on all time. It is a showcase, and on the
   *  first of a month "this month" is one day: every module reads empty and
   *  the product looks broken when it is working correctly. The scope bar
   *  still says All time, so nothing is being hidden. */
  fallback: Period = DEFAULT_SCOPE.period,
): Scope {
  const get = (k: string) => (Array.isArray(sp[k]) ? sp[k]![0] : (sp[k] as string | undefined));
  const period = (get('period') ?? fallback) as Period;
  return {
    period: PERIODS.some((p) => p.id === period) ? period : fallback,
    bookmakerId: get('book') ?? 'all',
    sportId: (get('sport') ?? 'all') as SportId | 'all',
  };
}

export function scopeToQuery(scope: Scope): string {
  const q = new URLSearchParams();
  if (scope.period !== DEFAULT_SCOPE.period) q.set('period', scope.period);
  if (scope.bookmakerId !== 'all') q.set('book', scope.bookmakerId);
  if (scope.sportId !== 'all') q.set('sport', scope.sportId);
  const s = q.toString();
  return s ? `?${s}` : '';
}

export function scopeLabel(scope: Scope): string {
  const p = PERIODS.find((x) => x.id === scope.period)?.label ?? 'This month';
  const bits = [p];
  if (scope.bookmakerId !== 'all') bits.push(bookmakerName(scope.bookmakerId));
  if (scope.sportId !== 'all') bits.push(scope.sportId.replace('-', ' '));
  return bits.join(' · ');
}

// ------------------------------------------------------------------ window

/** `event_at` owns profit and drives every period total. `placed_at` is
 *  stored and filterable but never used for period maths.
 *
 *  THE WINDOW IS THE ACCOUNT'S OWN MIDNIGHT, not the server's. This assembled
 *  the zoned year, month and day and handed them straight to Date.UTC, which
 *  is that day's midnight in UTC and an hour later than that day's midnight
 *  anywhere on summer time. Every bet in that hour fell into the period
 *  before its own: an Irish account's 00:40 Saturday kick off is 23:40 Friday
 *  in UTC, so the calendar drew it on Saturday and "Today" left it out.
 *  startOfDay() resolves the offset instead of assuming there is none. */
export function periodStart(
  period: Period, now: Date, weekStart: 0 | 1 = 1, tz: TimeZone = DEFAULT_TZ,
): Date | null {
  const p = zonedParts(now, tz);
  switch (period) {
    case 'today': return startOfDay(p.year, p.month, p.day, tz);
    case 'week': {
      /*  Which day of the week it is, asked of the account's own calendar
          date rather than of the instant, so the answer cannot slip a day
          for the same reason the boundary could. */
      const dow = new Date(Date.UTC(p.year, p.month - 1, p.day)).getUTCDay();
      const back = (dow - weekStart + 7) % 7;
      return startOfDay(p.year, p.month, p.day - back, tz);
    }
    case 'month': return startOfDay(p.year, p.month, 1, tz);
    case 'year': return startOfDay(p.year, 1, 1, tz);
    default: return null;
  }
}

/** THE one query. Everything else counts what this returns. */
export function select(
  bets: DemoBet[], scope: Scope, now = new Date(), weekStart: 0 | 1 = 1, tz: TimeZone = DEFAULT_TZ,
): DemoBet[] {
  const from = periodStart(scope.period, now, weekStart, tz);
  return bets.filter((b) => {
    if (from && new Date(b.eventAt) < from) return false;
    if (scope.bookmakerId !== 'all' && b.bookmakerId !== scope.bookmakerId) return false;
    if (scope.sportId !== 'all' && b.sportId !== scope.sportId) return false;
    return true;
  });
}

// ----------------------------------------------------------------- summary

export type Summary = {
  count: number;
  settled: number;
  open: number;
  stakedPence: number;
  turnoverPence: number;
  returnedPence: number;
  netPence: number;
  /** Split out, because "up £1,184" means something different when £890 of
   *  it came from sign-up offers. */
  netRealPence: number;
  netPromoPence: number;
  voidedStakePence: number;
  roi: number;
  winRate: number;
  wins: number;
  losses: number;
  /** A place is neither a win nor a loss, so it is counted apart from both.
   *  See `summarise` for why. */
  placed: number;
  voids: number;
  avgOdds: number;
  avgStakePence: number;
  units: number;
  openStakePence: number;
  longestWin: number;
  longestLoss: number;
};

/** A PLACE COUNTS AS NEITHER A WIN NOR A LOSS, here and everywhere.
 *
 *  It is out of the win rate on both sides, exactly like a void, and it has
 *  its own count instead. Two reasons, and the second is the one that
 *  decided it.
 *
 *  A place is not a claim about winning. The selection did not win. Calling
 *  it a win puts a horse that came third in the same column as one that came
 *  first, and calling it a loss says the bet returned nothing when it
 *  returned the place terms.
 *
 *  And an each way bet is TWO rows in this ledger, a win part and a place
 *  part. Count the place as a win and one bet lands in both columns at once:
 *  one horse, third of twelve, would read as a 50% win rate off a single
 *  bet. Out of both columns, the pair reads 0 wins and 1 loss, which is the
 *  true statement that the selection did not win, and the money is reported
 *  by net, return and units, which is where money belongs. */
export function summarise(rows: DemoBet[]): Summary {
  let stakedPence = 0, turn = 0, returned = 0, net = 0, netPromo = 0, voided = 0;
  let wins = 0, losses = 0, placed = 0, voids = 0, settled = 0, open = 0, units = 0;
  let oddsSum = 0, oddsN = 0, openStake = 0;

  const settledOrder: DemoBet[] = [];

  for (const b of rows) {
    const s = b.state;
    if (s.status === 'open') { open += 1; openStake += riskPence(b); }
    if (s.status !== 'open') { settled += 1; settledOrder.push(b); }

    stakedPence += riskPence(b);
    turn += turnoverPence(b, s);
    returned += s.returnedPence;
    net += s.realisedPlPence;
    units += s.units;
    voided += s.voidedStakePence;
    if (b.isFreeBet || b.isBonusFunds || b.isBoosted) netPromo += s.realisedPlPence;

    if (!b.arbGroupId) {
      if (s.outcome === 'won' || s.outcome === 'cash-profit') wins += 1;
      else if (s.outcome === 'lost' || s.outcome === 'cash-loss') losses += 1;
      else if (s.outcome === 'placed') placed += 1;
      else if (s.outcome === 'void') voids += 1;
      if (s.status !== 'open') { oddsSum += effectiveOdds(b); oddsN += 1; }
    }
  }

  settledOrder.sort((a, b) => new Date(a.eventAt).getTime() - new Date(b.eventAt).getTime());
  let longestWin = 0, longestLoss = 0, runW = 0, runL = 0;
  for (const b of settledOrder) {
    const o = b.state.outcome;
    if (o === 'won' || o === 'cash-profit') { runW += 1; runL = 0; }
    else if (o === 'lost' || o === 'cash-loss') { runL += 1; runW = 0; }
    else continue;
    longestWin = Math.max(longestWin, runW);
    longestLoss = Math.max(longestLoss, runL);
  }

  const decided = wins + losses;
  return {
    count: rows.length,
    settled, open,
    stakedPence,
    turnoverPence: turn,
    returnedPence: returned,
    netPence: net,
    netRealPence: net - netPromo,
    netPromoPence: netPromo,
    voidedStakePence: voided,
    roi: turn > 0 ? (net / turn) * 100 : 0,
    winRate: decided > 0 ? (wins / decided) * 100 : 0,
    wins, losses, placed, voids,
    avgOdds: oddsN > 0 ? oddsSum / oddsN : 0,
    avgStakePence: rows.length ? Math.round(stakedPence / rows.length) : 0,
    units: Number(units.toFixed(3)),
    openStakePence: openStake,
    longestWin, longestLoss,
  };
}

// -------------------------------------------------------------- breakdowns

/*  Six ways to slice the record, in one module.
 *
 *  Odds and stake used to be two separate modules beside the breakdown, which
 *  meant three cards on the dashboard doing the same job with the same row
 *  and the same bar. They are dimensions, so they are dimensions.
 *
 *  The two ORDERED ones keep their band order and are never sorted by value:
 *  the whole read of "which price range are you good at" is the order. */
export type Dimension = 'sport' | 'market' | 'tipster' | 'bookmaker' | 'odds' | 'stake';

export const DIMENSIONS: { id: Dimension; label: string; ordered?: boolean }[] = [
  { id: 'sport', label: 'Sport' },
  { id: 'market', label: 'Market' },
  { id: 'bookmaker', label: 'Bookmaker' },
  { id: 'tipster', label: 'Tipster' },
  { id: 'odds', label: 'Odds', ordered: true },
  { id: 'stake', label: 'Stake', ordered: true },
];

export const ORDERED_DIMENSIONS = new Set<Dimension>(['odds', 'stake']);

export type BreakRow = {
  key: string;
  label: string;
  count: number;
  netPence: number;
  turnoverPence: number;
  roi: number;
  units: number;
  /** Rows under THIN_BETS are greyed: profit without volume ranks one lucky
   *  bet above forty disciplined ones. */
  thin: boolean;
  /** Running total for this row alone, oldest first, in CAPPED units,
   *  resampled to at most SPARK_POINTS. The net figure says where the row
   *  ended; this says whether it got there steadily or on one Saturday, which
   *  is a different fact and the more useful one. Empty when the row has
   *  fewer than two settled bets: a line through one point is not a trend. */
  spark: number[];
  /** True when at least one bet in this row was drawn at the cap rather than
   *  at its own size. The row says so, because the shape is then not the
   *  record and nobody should have to guess which. */
  capped: boolean;
};

/** Enough to show a shape at 74px wide, few enough to stay one path. */
export const SPARK_POINTS = 18;

/*  HOW FEW BETS MAKES A ROW NOISE.
 *
 *  Five. A return over three bets is a coin landing the same way twice and
 *  printing it beside a row of forty, in the same weight, ranks one lucky
 *  afternoon above a season of discipline. The figures are still shown,
 *  because hiding them would be a different lie, and the row says what it is.
 *
 *  It is a constant because the breakdown and the analyser both draw that
 *  line and two of them would drift: a row that is thin on one screen and
 *  ordinary on the next is worse than either rule on its own. */
export const THIN_BETS = 5;

/*  ---------------------------------------------------- the three unit cap
 *
 *  THE SHAPE CHARTS DRAW UNITS, AND A UNIT IS CAPPED AT THREE.
 *
 *  A running total in raw money has one shape whenever a single bet is much
 *  bigger than the rest: one vertical wall and a flat line either side of it.
 *  Every other bet in the row is then drawn at a pixel, so the chart that
 *  exists to say "steadily, or on one Saturday" can no longer say either.
 *
 *  Worse than unreadable, it is flattering. A forty unit win is a forty unit
 *  STAKE that came in, and drawn at full size it looks like the shape of
 *  somebody's judgement when it is the shape of one afternoon's nerve. This
 *  product's whole argument is that a record which flatters itself is
 *  worthless.
 *
 *  So the DISPLAYED contribution of one bet is clamped to plus or minus three
 *  units and nothing else is. The figure on the row, the figure in the sheet,
 *  the net, the return and every total stay the true ones, and a row that had
 *  to clamp anything says so, because a chart nobody can tell apart from the
 *  record is worse than no chart. Three, because a bet at three units is
 *  already a heavy one against a unit that is meant to be a normal bet, so a
 *  chart that separates half a unit from three separates everything a staking
 *  plan is about. */
export const SHAPE_UNIT_CAP = 3;

/** What one bet is allowed to contribute to a shape chart. Never used for a
 *  figure: money and units are reported at their true size everywhere. */
export function cappedUnits(units: number): number {
  if (!Number.isFinite(units)) return 0;
  return Math.max(-SHAPE_UNIT_CAP, Math.min(SHAPE_UNIT_CAP, units));
}

/** Downsample by picking evenly spaced members, always keeping the last: the
 *  end of a running total is the figure printed beside it, and a sparkline
 *  whose right hand end disagrees with the number next to it is a bug
 *  somebody will spend an afternoon on. */
function resample(series: number[], n = SPARK_POINTS): number[] {
  if (series.length <= n) return series;
  const out: number[] = [];
  for (let i = 0; i < n - 1; i++) out.push(series[Math.floor((i * (series.length - 1)) / (n - 1))]);
  out.push(series[series.length - 1]);
  return out;
}

const SPORT_LABEL: Record<string, string> = {
  football: 'Football', tennis: 'Tennis', 'horse-racing': 'Horse racing',
};

const TIPSTER_LABEL: Record<string, string> = {
  own: 'My own', 'coupon-club': 'Coupon Club', 'value-tips': 'Value Tips', 'the-rails': 'The Rails',
};

function keyOf(b: DemoBet, dim: Dimension): { key: string; label: string } {
  switch (dim) {
    case 'sport': return { key: b.sportId, label: SPORT_LABEL[b.sportId] ?? b.sportId };
    case 'market': { const g = marketGroupFor(b.marketRaw); return { key: g, label: marketGroupName(g) }; }
    case 'tipster': return { key: b.tipsterId ?? 'own', label: TIPSTER_LABEL[b.tipsterId ?? 'own'] ?? 'My own' };
    case 'bookmaker': return { key: b.bookmakerId, label: bookmakerName(b.bookmakerId) };
    /*  Never reached: orderedBreakdown handles these two, because a band list
     *  has to include the bands with no bets in them. A band that is missing
     *  reads as a band you did not bet in only if it is still drawn. */
    default: return { key: 'other', label: 'Other' };
  }
}

export function breakdown(rows: DemoBet[], dim: Dimension): BreakRow[] {
  const map = new Map<string, BreakRow>();
  /* Running totals are built in event order, not in the order the rows
     happen to arrive. A sparkline off a shuffled list is noise that looks
     like information, which is worse than no sparkline. */
  const series = new Map<string, number[]>();
  const running = new Map<string, number>();
  const ordered = [...rows].sort((a, b) => +a.eventAt - +b.eventAt);

  for (const b of ordered) {
    const { key, label } = keyOf(b, dim);
    const cur = map.get(key) ?? { key, label, count: 0, netPence: 0, turnoverPence: 0, roi: 0, units: 0, thin: false, spark: [], capped: false };
    cur.count += 1;
    cur.netPence += b.state.realisedPlPence;
    cur.turnoverPence += turnoverPence(b, b.state);
    cur.units += b.state.units;

    if (b.state.status !== 'open') {
      /*  The SHAPE is capped and the figures above are not. See
          SHAPE_UNIT_CAP: one forty unit bet draws a wall and a flat line, and
          nothing else in the row is then visible at all. */
      if (Math.abs(b.state.units) > SHAPE_UNIT_CAP) cur.capped = true;
      const acc = (running.get(key) ?? 0) + cappedUnits(b.state.units);
      running.set(key, acc);
      const list = series.get(key) ?? [];
      list.push(acc);
      series.set(key, list);
    }
    map.set(key, cur);
  }

  return [...map.values()]
    .map((r) => {
      const raw = series.get(r.key) ?? [];
      return {
        ...r,
        roi: r.turnoverPence > 0 ? (r.netPence / r.turnoverPence) * 100 : 0,
        thin: r.count < THIN_BETS,
        units: Number(r.units.toFixed(2)),
        spark: raw.length > 1 ? resample(raw) : [],
      };
    })
    .sort((a, b) => b.netPence - a.netPence);
}

/** Ordered dimensions get their own module, because their read depends on the
 *  order being preserved. Never sorted by value. */
export function orderedBreakdown(rows: DemoBet[], kind: 'odds' | 'stake', unitPence: number): BreakRow[] {
  const bands = kind === 'odds' ? ODDS_BANDS : STAKE_BANDS;
  const base = new Map<string, BreakRow>(
    bands.map((b) => [b.id, { key: b.id, label: b.label, count: 0, netPence: 0, turnoverPence: 0, roi: 0, units: 0, thin: true, spark: [], capped: false }]),
  );
  const series = new Map<string, number[]>();
  const running = new Map<string, number>();

  for (const b of [...rows].sort((a, c) => +a.eventAt - +c.eventAt)) {
    const id = kind === 'odds' ? oddsBand(effectiveOdds(b)) : stakeBand(riskPence(b), b.unitPenceAtPlacement || unitPence);
    const cur = base.get(id);
    if (!cur) continue;
    cur.count += 1;
    cur.netPence += b.state.realisedPlPence;
    cur.turnoverPence += turnoverPence(b, b.state);
    cur.units += b.state.units;

    if (b.state.status !== 'open') {
      if (Math.abs(b.state.units) > SHAPE_UNIT_CAP) cur.capped = true;
      const acc = (running.get(id) ?? 0) + cappedUnits(b.state.units);
      running.set(id, acc);
      const list = series.get(id) ?? [];
      list.push(acc);
      series.set(id, list);
    }
  }
  return bands.map((band) => {
    const r = base.get(band.id)!;
    const raw = series.get(band.id) ?? [];
    return {
      ...r,
      roi: r.turnoverPence > 0 ? (r.netPence / r.turnoverPence) * 100 : 0,
      thin: r.count < THIN_BETS,
      units: Number(r.units.toFixed(2)),
      spark: raw.length > 1 ? resample(raw) : [],
    };
  });
}

/** All four dimensions at once, so the segmented control switches without a
 *  round trip and every tab counts the same rows. */
export function buildBreakdowns(rows: DemoBet[], unitPence: number): Record<Dimension, BreakRow[]> {
  return {
    sport: breakdown(rows, 'sport'),
    market: breakdown(rows, 'market'),
    tipster: breakdown(rows, 'tipster'),
    bookmaker: breakdown(rows, 'bookmaker'),
    odds: orderedBreakdown(rows, 'odds', unitPence),
    stake: orderedBreakdown(rows, 'stake', unitPence),
  };
}

// ------------------------------------------------------------------ series

export type DayPoint = { day: string; netPence: number; count: number; turnoverPence: number };

export function byDay(rows: DemoBet[], tz: TimeZone = DEFAULT_TZ): DayPoint[] {
  const map = new Map<string, DayPoint>();
  for (const b of rows) {
    if (b.state.status === 'open') continue;
    const day = dayKey(b.eventAt, tz);
    const cur = map.get(day) ?? { day, netPence: 0, count: 0, turnoverPence: 0 };
    cur.netPence += b.state.realisedPlPence;
    /*  Carried per day for the same reason byMonth carries it: a return is a
        ratio and a ratio needs its denominator. The dashboard's tiles draw a
        running return, and computing the turnover a second time in the page
        would be a second definition of it. */
    cur.turnoverPence += turnoverPence(b, b.state);
    cur.count += 1;
    map.set(day, cur);
  }
  return [...map.values()].sort((a, b) => a.day.localeCompare(b.day));
}

export function cumulative(points: DayPoint[]): { day: string; netPence: number }[] {
  let acc = 0;
  return points.map((p) => { acc += p.netPence; return { day: p.day, netPence: acc }; });
}

/** A running total, as a plain series, for the shapes that only need numbers.
 *
 *  The tiles draw one of these each and none of them draws an axis, so what
 *  they want is the arithmetic and not a second copy of a DayPoint. */
export function runningTotal(values: number[]): number[] {
  let acc = 0;
  return values.map((v) => { acc += v; return acc; });
}

/** The return as it stood after each day, not the return of each day.
 *
 *  A per day ratio is noise: one settled bet on a Tuesday is plus or minus a
 *  hundred per cent and says nothing. The running one is the figure the tile
 *  prints, drawn as it arrived at it, and its last point IS that figure. */
export function runningRoi(points: DayPoint[]): number[] {
  let net = 0;
  let turn = 0;
  const out: number[] = [];
  for (const p of points) {
    net += p.netPence;
    turn += p.turnoverPence;
    out.push(turn > 0 ? (net / turn) * 100 : 0);
  }
  return out;
}

export type MonthPoint = { key: string; label: string; netPence: number; count: number; turnoverPence: number };

export function byMonth(rows: DemoBet[], tz: TimeZone = DEFAULT_TZ): MonthPoint[] {
  const map = new Map<string, MonthPoint>();
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  for (const b of rows) {
    if (b.state.status === 'open') continue;
    const p = zonedParts(b.eventAt, tz);
    const key = `${p.year}-${String(p.month).padStart(2, '0')}`;
    const cur = map.get(key) ?? { key, label: MONTHS[p.month - 1], netPence: 0, count: 0, turnoverPence: 0 };
    cur.netPence += b.state.realisedPlPence;
    cur.turnoverPence += turnoverPence(b, b.state);
    cur.count += 1;
    map.set(key, cur);
  }
  return [...map.values()].sort((a, b) => a.key.localeCompare(b.key));
}

// ------------------------------------------------------------------ facets

export const OUTCOMES: { id: Outcome | 'open'; label: string }[] = [
  { id: 'open', label: 'Running' },
  { id: 'won', label: 'Won' },
  { id: 'placed', label: 'Placed' },
  { id: 'lost', label: 'Lost' },
  { id: 'cash-profit', label: 'Cashed out, ahead' },
  { id: 'cash-loss', label: 'Cashed out, behind' },
  { id: 'cash-flat', label: 'Cashed out, flat' },
  { id: 'void', label: 'Void' },
];

export type Facet = { id: string; label: string; count: number };

/** Which facet a bet belongs to.
 *
 *  ONE EXPRESSION, because the count and the filter were two.
 *
 *  A bet with a partial cash out on it and stake still standing is
 *  `part_settled` with no outcome yet. The counter fell back to `open` for
 *  it, which is right: part of it is still running. The filter did not, so
 *  the Running chip on the example account promised ten and delivered three,
 *  and the seven it dropped were exactly the bets whose maths is the most
 *  interesting on the screen. Invisible under the default month scope, which
 *  is why the test only found it once it ran every period. */
const facetOf = (b: DemoBet): string =>
  (b.state.status === 'open' ? 'open' : (b.state.outcome ?? 'open'));

/** Facets are counted from the SAME array the rows come from, and
 *  zero-count facets are hidden, so the facet total equals the row total. */
export function facets(rows: DemoBet[]): { list: Facet[]; total: number } {
  const counts = new Map<string, number>();
  for (const b of rows) {
    counts.set(facetOf(b), (counts.get(facetOf(b)) ?? 0) + 1);
  }
  const list = OUTCOMES
    .map((o) => ({ id: o.id as string, label: o.label, count: counts.get(o.id as string) ?? 0 }))
    .filter((f) => f.count > 0);
  return { list, total: list.reduce((a, f) => a + f.count, 0) };
}

export function filterByOutcome(rows: DemoBet[], outcome: string | null): DemoBet[] {
  if (!outcome || outcome === 'all') return rows;
  return rows.filter((b) => facetOf(b) === outcome);
}

/*  WHERE THE BET CAME FROM, as a facet beside the outcomes.
 *
 *  Imported history was in the ledger and unmarkable. Somebody who brought in
 *  four hundred rows from a spreadsheet had them counted in every figure with
 *  no way to see the record without them, which is the question they import
 *  in order to ask: the dashboard already leaves them out of best day, worst
 *  day and the streak, and until now the ledger could not agree with it.
 *
 *  Two facets rather than five, because five source names are how the row
 *  was written and this is the only distinction anybody filters on. They
 *  partition the rows: a bet is imported or it is not, so the pair sums to
 *  the row total the same way the outcomes do. */
export const SOURCES: { id: 'own' | 'imported'; label: string }[] = [
  { id: 'own', label: 'Placed here' },
  { id: 'imported', label: 'Imported' },
];

const sourceOf = (b: DemoBet) => (isImportedSource(b.source) ? 'imported' : 'own');

export function sourceFacets(rows: DemoBet[]): { list: Facet[]; total: number } {
  const counts = new Map<string, number>();
  for (const b of rows) {
    const id = sourceOf(b);
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  const list = SOURCES
    .map((s) => ({ id: s.id as string, label: s.label, count: counts.get(s.id) ?? 0 }))
    .filter((f) => f.count > 0);
  return { list, total: list.reduce((a, f) => a + f.count, 0) };
}

export function filterBySource(rows: DemoBet[], source: string | null): DemoBet[] {
  if (!source || source === 'all') return rows;
  return rows.filter((b) => sourceOf(b) === source);
}

// ------------------------------------------------------------- running now

export function runningNow(bets: DemoBet[]): DemoBet[] {
  return bets
    .filter((b) => b.state.status === 'open')
    .sort((a, b) => new Date(a.eventAt).getTime() - new Date(b.eventAt).getTime());
}

export function settledToday(bets: DemoBet[], now = new Date(), tz: TimeZone = DEFAULT_TZ): DemoBet[] {
  const today = dayKey(now, tz);
  return bets
    .filter((b) => b.state.status !== 'open' && dayKey(b.eventAt, tz) === today)
    .sort((a, b) => new Date(b.eventAt).getTime() - new Date(a.eventAt).getTime());
}

// ----------------------------------------------------------------- offers

export type OfferSplit = {
  ownNetPence: number; ownCount: number;
  offerNetPence: number; offerCount: number;
  offerSharePct: number;
};

/** Always all time, and says so in its own header. */
export function offerSplit(bets: DemoBet[]): OfferSplit {
  let ownNet = 0, ownCount = 0, offerNet = 0, offerCount = 0;
  for (const b of bets) {
    if (b.state.status === 'open') continue;
    if (b.isFreeBet || b.isBonusFunds || b.isBoosted) { offerNet += b.state.realisedPlPence; offerCount += 1; }
    else { ownNet += b.state.realisedPlPence; ownCount += 1; }
  }
  const total = ownNet + offerNet;
  return {
    ownNetPence: ownNet, ownCount,
    offerNetPence: offerNet, offerCount,
    offerSharePct: total > 0 ? (offerNet / total) * 100 : 0,
  };
}

// ----------------------------------------------------------------- balance

/** Every realised profit and loss in this set, in minor units. The one input
 *  the balance takes from the betting side. */
export function realisedPence(bets: DemoBet[]): number {
  return bets.reduce((acc, b) => acc + b.state.realisedPlPence, 0);
}

/** The account balance: their own money in, plus every realised profit and
 *  loss.
 *
 *  The word was "bankroll" on eleven surfaces and "Balance" on the one the
 *  top bar draws, which is two names for one figure. And it was profit only,
 *  so it could say what an account had won and could not say how much of the
 *  money in there was the account holder's own: somebody £400 up who has
 *  topped up £600 is £200 down in the only sense their current account cares
 *  about. Deposits and withdrawals move it and touch nothing else. See
 *  lib/domain/movements.ts for why that separation is the whole design. */
export function balance(bets: DemoBet[], movements: Movement[], startPence: number): number {
  return balanceMinor(startPence, movements, realisedPence(bets));
}

export type CurrencyTotals = Record<Currency, number>;

/** One currency per account, and pounds and euros are never summed into one
 *  net figure. This returns them apart so a caller cannot add them by
 *  accident. */
export function netByCurrency(bets: DemoBet[]): CurrencyTotals {
  const out: CurrencyTotals = { GBP: 0, EUR: 0 };
  for (const b of bets) out[b.currency] += b.state.realisedPlPence;
  return out;
}
