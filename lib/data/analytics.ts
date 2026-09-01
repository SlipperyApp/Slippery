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
import type { Currency, Outcome, SportId } from '@/lib/domain/types';
import type { DemoBet } from './demo';
import { londonDay, londonParts } from '@/lib/format';
import { ODDS_BANDS, STAKE_BANDS, oddsBand, stakeBand, marketGroupFor, marketGroupName, bookmakerName } from './reference';

export type Period = 'today' | 'week' | 'month' | 'year' | 'all';

export const PERIODS: { id: Period; label: string }[] = [
  { id: 'today', label: 'Today' },
  { id: 'week', label: 'This week' },
  { id: 'month', label: 'This month' },
  { id: 'year', label: 'This year' },
  { id: 'all', label: 'All time' },
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
 *  stored and filterable but never used for period maths. */
export function periodStart(period: Period, now: Date, weekStart: 0 | 1 = 1): Date | null {
  const p = londonParts(now);
  const startOfDay = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d, 0, 0, 0));
  switch (period) {
    case 'today': return startOfDay(p.year, p.month, p.day);
    case 'week': {
      const dow = new Date(Date.UTC(p.year, p.month - 1, p.day)).getUTCDay();
      const back = (dow - weekStart + 7) % 7;
      const d = new Date(Date.UTC(p.year, p.month - 1, p.day - back));
      return d;
    }
    case 'month': return startOfDay(p.year, p.month, 1);
    case 'year': return startOfDay(p.year, 1, 1);
    default: return null;
  }
}

/** THE one query. Everything else counts what this returns. */
export function select(bets: DemoBet[], scope: Scope, now = new Date(), weekStart: 0 | 1 = 1): DemoBet[] {
  const from = periodStart(scope.period, now, weekStart);
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
  voids: number;
  avgOdds: number;
  avgStakePence: number;
  units: number;
  openStakePence: number;
  longestWin: number;
  longestLoss: number;
};

export function summarise(rows: DemoBet[]): Summary {
  let stakedPence = 0, turn = 0, returned = 0, net = 0, netPromo = 0, voided = 0;
  let wins = 0, losses = 0, voids = 0, settled = 0, open = 0, units = 0;
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
    wins, losses, voids,
    avgOdds: oddsN > 0 ? oddsSum / oddsN : 0,
    avgStakePence: rows.length ? Math.round(stakedPence / rows.length) : 0,
    units: Number(units.toFixed(3)),
    openStakePence: openStake,
    longestWin, longestLoss,
  };
}

// -------------------------------------------------------------- breakdowns

export type Dimension = 'sport' | 'market' | 'tipster' | 'bookmaker';

export const DIMENSIONS: { id: Dimension; label: string }[] = [
  { id: 'sport', label: 'Sport' },
  { id: 'market', label: 'Market' },
  { id: 'tipster', label: 'Tipster' },
  { id: 'bookmaker', label: 'Bookmaker' },
];

export type BreakRow = {
  key: string;
  label: string;
  count: number;
  netPence: number;
  turnoverPence: number;
  roi: number;
  units: number;
  /** Rows under five bets are greyed: profit without volume ranks one lucky
   *  bet above forty disciplined ones. */
  thin: boolean;
  /** Running total for this row alone, oldest first, resampled to at most
   *  SPARK_POINTS. The net figure says where the row ended; this says whether
   *  it got there steadily or on one Saturday, which is a different fact and
   *  the more useful one. Empty when the row has fewer than two settled bets:
   *  a line through one point is not a trend. */
  spark: number[];
};

/** Enough to show a shape at 74px wide, few enough to stay one path. */
export const SPARK_POINTS = 18;

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
    const cur = map.get(key) ?? { key, label, count: 0, netPence: 0, turnoverPence: 0, roi: 0, units: 0, thin: false, spark: [] };
    cur.count += 1;
    cur.netPence += b.state.realisedPlPence;
    cur.turnoverPence += turnoverPence(b, b.state);
    cur.units += b.state.units;
    map.set(key, cur);

    if (b.state.status !== 'open') {
      const acc = (running.get(key) ?? 0) + b.state.realisedPlPence;
      running.set(key, acc);
      const list = series.get(key) ?? [];
      list.push(acc);
      series.set(key, list);
    }
  }

  return [...map.values()]
    .map((r) => {
      const raw = series.get(r.key) ?? [];
      return {
        ...r,
        roi: r.turnoverPence > 0 ? (r.netPence / r.turnoverPence) * 100 : 0,
        thin: r.count < 5,
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
    bands.map((b) => [b.id, { key: b.id, label: b.label, count: 0, netPence: 0, turnoverPence: 0, roi: 0, units: 0, thin: true, spark: [] }]),
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
      const acc = (running.get(id) ?? 0) + b.state.realisedPlPence;
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
      thin: r.count < 5,
      units: Number(r.units.toFixed(2)),
      spark: raw.length > 1 ? resample(raw) : [],
    };
  });
}

/** All four dimensions at once, so the segmented control switches without a
 *  round trip and every tab counts the same rows. */
export function buildBreakdowns(rows: DemoBet[]): Record<Dimension, BreakRow[]> {
  return {
    sport: breakdown(rows, 'sport'),
    market: breakdown(rows, 'market'),
    tipster: breakdown(rows, 'tipster'),
    bookmaker: breakdown(rows, 'bookmaker'),
  };
}

// ------------------------------------------------------------------ series

export type DayPoint = { day: string; netPence: number; count: number };

export function byDay(rows: DemoBet[]): DayPoint[] {
  const map = new Map<string, DayPoint>();
  for (const b of rows) {
    if (b.state.status === 'open') continue;
    const day = londonDay(b.eventAt);
    const cur = map.get(day) ?? { day, netPence: 0, count: 0 };
    cur.netPence += b.state.realisedPlPence;
    cur.count += 1;
    map.set(day, cur);
  }
  return [...map.values()].sort((a, b) => a.day.localeCompare(b.day));
}

export function cumulative(points: DayPoint[]): { day: string; netPence: number }[] {
  let acc = 0;
  return points.map((p) => { acc += p.netPence; return { day: p.day, netPence: acc }; });
}

export type MonthPoint = { key: string; label: string; netPence: number; count: number; turnoverPence: number };

export function byMonth(rows: DemoBet[]): MonthPoint[] {
  const map = new Map<string, MonthPoint>();
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  for (const b of rows) {
    if (b.state.status === 'open') continue;
    const p = londonParts(b.eventAt);
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
  { id: 'lost', label: 'Lost' },
  { id: 'cash-profit', label: 'Cashed out, ahead' },
  { id: 'cash-loss', label: 'Cashed out, behind' },
  { id: 'cash-flat', label: 'Cashed out, flat' },
  { id: 'void', label: 'Void' },
];

export type Facet = { id: string; label: string; count: number };

/** Facets are counted from the SAME array the rows come from, and
 *  zero-count facets are hidden, so the facet total equals the row total. */
export function facets(rows: DemoBet[]): { list: Facet[]; total: number } {
  const counts = new Map<string, number>();
  for (const b of rows) {
    const id = b.state.status === 'open' ? 'open' : (b.state.outcome ?? 'open');
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  const list = OUTCOMES
    .map((o) => ({ id: o.id as string, label: o.label, count: counts.get(o.id as string) ?? 0 }))
    .filter((f) => f.count > 0);
  return { list, total: list.reduce((a, f) => a + f.count, 0) };
}

export function filterByOutcome(rows: DemoBet[], outcome: string | null): DemoBet[] {
  if (!outcome || outcome === 'all') return rows;
  return rows.filter((b) => (b.state.status === 'open' ? 'open' : b.state.outcome) === outcome);
}

// ------------------------------------------------------------- running now

export function runningNow(bets: DemoBet[]): DemoBet[] {
  return bets
    .filter((b) => b.state.status === 'open')
    .sort((a, b) => new Date(a.eventAt).getTime() - new Date(b.eventAt).getTime());
}

export function settledToday(bets: DemoBet[], now = new Date()): DemoBet[] {
  const today = londonDay(now);
  return bets
    .filter((b) => b.state.status !== 'open' && londonDay(b.eventAt) === today)
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

// ---------------------------------------------------------------- bankroll

export function bankroll(bets: DemoBet[], startPence: number): number {
  return bets.reduce((acc, b) => acc + b.state.realisedPlPence, startPence);
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
