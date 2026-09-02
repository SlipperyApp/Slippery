/** Groups, leagues and the people in them.
 *
 *  Other Slippery users are Slippers, never "users". Members is kept for
 *  people inside a specific group, because that is a role rather than an
 *  identity.
 *
 *  Ranked in units, never in pounds: a bigger balance should not be a bigger
 *  score. Outside a group only units are ever visible, never stakes.
 *
 *  ONE LIST OF BETS PER SLIPPER, COUNTED MANY WAYS. Every figure a row shows
 *  comes out of `recordOver()` folding one array, the same shape rule 5 of
 *  the codebase applies to the ledger: the facet total equals the row total
 *  because they are the same fold. The previous version drew units from one
 *  seed and would have had to draw a return from another, and two independent
 *  draws produce a row saying +18.4u beside a return that could not have
 *  produced it. */

import { demoData } from './demo';
import { summarise, select, periodStart, DEFAULT_SCOPE, THIN_BETS } from './analytics';
import { TRACKING_DEFAULT_ON } from './settings';
import { bookmakerName } from './reference';

export type LeaguePeriod = 'month' | 'year' | 'all';

export const LEAGUE_PERIODS: { id: LeaguePeriod; label: string }[] = [
  { id: 'month', label: 'This month' },
  { id: 'year', label: 'This year' },
  { id: 'all', label: 'All time' },
];

/** What one Slipper did over one window.
 *
 *  Units and the return are folded from the same array in the same pass, so
 *  a row cannot print a return that disagrees with the units beside it.
 *  Staked is in UNITS, not pence: this is the one figure that is compared
 *  across people, and pounds and euros are never summed. */
export type SlipperRecord = {
  bets: number;
  wins: number;
  losses: number;
  /** Voided stake is out of the denominator, the same rule analytics
   *  applies to turnover. A void is not a bet that returned nothing. */
  stakedUnits: number;
  units: number;
  roi: number;
};

/** WHETHER A RETURN IS A RETURN, in one place, counted over the right bets.
 *
 *  DECISIONS.md: "A return over fewer than five bets is left out. It is not
 *  a return, it is the price of one of those bets." The league table
 *  enforced it with its own literal 5 and the Social page's This month card
 *  did not enforce it at all, so on the second of a month that card read
 *  "+5.9u ... 1 won, 1 lost, over 7 bets. +66.9% return." beside a table
 *  that had struck the same figure out.
 *
 *  IT COUNTS THE SETTLED ONES. The league's own literal was `bets < 5`,
 *  which is every bet in the window including the five that have not run
 *  yet, and the return is folded over the settled non void ones only: that
 *  card had seven bets and a denominator of two. Wins plus losses is the
 *  denominator the figure was actually divided by, so it is what the gate
 *  has to look at. Voids are in neither, which is the same rule turnover
 *  applies. */
export function thinReturn(r: { wins: number; losses: number }): boolean {
  return r.wins + r.losses < THIN_BETS;
}

export type Slipper = {
  handle: string;
  name: string;
  slipBackedPct: number;
  lateEdits: number;
  following: boolean;
  followsYou: boolean;
  groups: string[];
  joined: string;
  /** Whether this Slipper shows what they are tracking before kick off.
   *  OPT IN, DEFAULT OFF. Somebody who has not turned it on appears nowhere
   *  in that list, which is why it is a stored fact per person rather than a
   *  filter applied at the point of reading. */
  tracking: boolean;
  month: SlipperRecord;
  year: SlipperRecord;
  all: SlipperRecord;
};

/** The record for the ranked period travels WITH the row. A component that
 *  had to pick a field by period would be a second place the period is
 *  decided, and the two would eventually disagree. */
export type LeagueRow = Slipper & { position: number; record: SlipperRecord };

export type GroupSummary = {
  id: string;
  name: string;
  members: number;
  joinMode: 'open' | 'code' | 'approval';
  rankingPeriod: LeaguePeriod;
  slipBackedOnly: boolean;
  showEditAudit: boolean;
  inviteCode: string;
  division: string;
  ownerHandle: string;
  /** Where you sit, and how many are in the field. Zero when you are not a
   *  member: a position in a table you are not in is a made up number. */
  yourPosition: number;
  youAreIn: boolean;
  youOwn: boolean;
  blurb: string;
};

/** Divisions move quietly at the end of a month. "Moving to League One next
 *  month", never "RELEGATED": state the number and stop. */
export const DIVISIONS = ['Premier', 'Championship', 'League One', 'League Two'] as const;

/** The viewer. One constant rather than the string in eleven places, because
 *  "am I looking at myself" is asked on every social surface. */
export const YOU = 'tester123';

type Person = Omit<Slipper, 'month' | 'year' | 'all'>;

const PEOPLE: Person[] = [
  { handle: 'rowan', name: 'Rowan', slipBackedPct: 94, lateEdits: 0, following: true, followsYou: true, tracking: true, groups: ['thursday-coupon', 'accas-only'], joined: '2026-02-11T09:00:00Z' },
  { handle: 'priya_b', name: 'Priya', slipBackedPct: 100, lateEdits: 0, following: true, followsYou: true, tracking: true, groups: ['thursday-coupon'], joined: '2026-01-04T09:00:00Z' },
  { handle: 'tester123', name: 'Tester', slipBackedPct: 88, lateEdits: 2, following: false, followsYou: false, tracking: TRACKING_DEFAULT_ON, groups: ['thursday-coupon', 'the-nap', 'accas-only', 'sunday-singles'], joined: '2026-03-02T09:00:00Z' },
  { handle: 'dev_k', name: 'Dev', slipBackedPct: 71, lateEdits: 5, following: false, followsYou: true, tracking: false, groups: ['thursday-coupon'], joined: '2026-04-19T09:00:00Z' },
  { handle: 'marcus', name: 'Marcus', slipBackedPct: 96, lateEdits: 1, following: true, followsYou: false, tracking: true, groups: ['thursday-coupon', 'the-nap'], joined: '2026-02-27T09:00:00Z' },
  { handle: 'niamh', name: 'Niamh', slipBackedPct: 82, lateEdits: 0, following: false, followsYou: true, tracking: true, groups: ['the-nap'], joined: '2026-05-08T09:00:00Z' },
  { handle: 'ade', name: 'Ade', slipBackedPct: 91, lateEdits: 0, following: true, followsYou: true, tracking: true, groups: ['accas-only'], joined: '2026-03-21T09:00:00Z' },
  { handle: 'siobhan', name: 'Siobhan', slipBackedPct: 77, lateEdits: 3, following: false, followsYou: false, tracking: false, groups: ['the-nap', 'accas-only'], joined: '2026-06-02T09:00:00Z' },
  { handle: 'callum', name: 'Callum', slipBackedPct: 89, lateEdits: 0, following: false, followsYou: false, tracking: true, groups: ['thursday-coupon', 'friday-fivers'], joined: '2026-01-30T09:00:00Z' },
  { handle: 'ffion', name: 'Ffion', slipBackedPct: 100, lateEdits: 0, following: true, followsYou: false, tracking: true, groups: ['the-nap'], joined: '2026-04-02T09:00:00Z' },
  { handle: 'jonty', name: 'Jonty', slipBackedPct: 64, lateEdits: 7, following: false, followsYou: false, tracking: false, groups: ['accas-only'], joined: '2026-05-19T09:00:00Z' },
  { handle: 'eilidh', name: 'Eilidh', slipBackedPct: 93, lateEdits: 1, following: false, followsYou: true, tracking: false, groups: ['thursday-coupon'], joined: '2026-02-02T09:00:00Z' },
];

/** Deterministic per person, so a name always carries the same figures. */
function seeded(handle: string, salt: number): number {
  let h = salt;
  for (let i = 0; i < handle.length; i++) h = (h * 31 + handle.charCodeAt(i)) >>> 0;
  return (h % 10000) / 10000;
}

/** THE SALT IS AVALANCHED BEFORE IT IS USED, and that is not tidiness.
 *
 *  `seeded()` is linear in its salt: for one handle it computes
 *  salt * 31^n + C, so two salts a fixed distance apart produce values a
 *  fixed distance apart. The price of a bet and the roll that settles it were
 *  drawn from salts exactly 7919 apart, which made the second one the first
 *  one plus a constant: every Slipper either won nearly everything or lost
 *  nearly everything, and the table read plus forty nine per cent against
 *  minus fifty six. The mix is one round of an integer hash, so the two
 *  draws are independent and the returns land where a real ledger's do.
 *
 *  The salt still carries both the bet's index and which field is being
 *  drawn, so two fields of one bet never collide and adding a field later
 *  cannot shift the ones already drawn. */
function draw(handle: string, i: number, field: number): number {
  return seeded(handle, avalanche(i * 977 + field * 31 + 11));
}

function avalanche(n: number): number {
  let h = n >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x7feb352d) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x846ca68b) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
}

const round2 = (n: number) => Number(n.toFixed(2));

/** A bet somebody else placed, as far as a league needs to know it. There is
 *  no money on this type at all: a stake reaches a league in units or it does
 *  not reach it. */
type SocialBet = {
  at: string;
  stakeUnits: number;
  netUnits: number;
  result: 'won' | 'lost' | 'void';
  slipBacked: boolean;
};

const STAKES = [0.25, 0.5, 1, 1, 1, 1, 2, 3];

/** How far back a Slipper's history runs. Longer than a year, so This year
 *  and All time are genuinely different tables rather than the same one
 *  twice. */
const BOOK_DAYS = 420;

/** Everything one Slipper has done, generated once and then counted.
 *
 *  A price and a strike rate rather than a profit figure: units then fall out
 *  of the bets instead of being asserted over them, which is what makes the
 *  return, the win and loss record and the units agree by construction. */
const BOOKS_BY_DAY = new Map<string, SocialBet[]>();

function bookOf(p: Person, now: Date): SocialBet[] {
  /*  Cached per handle per day. A page reads five group boards and a table,
      and each of those walks every Slipper's whole history: without this the
      same four hundred bets are generated eleven times for one render. The
      key carries the day because the dates are relative to it. */
  const key = `${p.handle}:${Math.floor(now.getTime() / 86400000)}`;
  const had = BOOKS_BY_DAY.get(key);
  if (had) return had;
  if (BOOKS_BY_DAY.size > 64) BOOKS_BY_DAY.clear();

  const total = 90 + Math.round(seeded(p.handle, 13) * 330);
  /*  A multiplier on the price-implied strike rate. Under 1 loses over time
      and over 1 wins, which is what puts some Slippers above the line and
      some under it without a separate draw deciding the answer first. The
      band is narrow on purpose and it straddles one: most people who bet lose
      slowly, a few do not, and a table of Slippers all returning twenty five
      per cent would be ranked by who was invented luckiest rather than by
      anything a reader could believe of a real ledger. */
  const skill = 0.88 + seeded(p.handle, 7) * 0.3;
  const out: SocialBet[] = [];
  for (let i = 0; i < total; i += 1) {
    const daysAgo = Math.floor(draw(p.handle, i, 1) * BOOK_DAYS);
    const stakeUnits = STAKES[Math.floor(draw(p.handle, i, 2) * STAKES.length)];
    const price = 1.4 + draw(p.handle, i, 3) * 4.6;
    const result: SocialBet['result'] = draw(p.handle, i, 5) < 0.03
      ? 'void'
      : draw(p.handle, i, 4) < Math.min(0.9, skill / price) ? 'won' : 'lost';
    out.push({
      at: new Date(now.getTime() - daysAgo * 86400000).toISOString(),
      stakeUnits,
      netUnits: result === 'void' ? 0 : result === 'won' ? round2(stakeUnits * (price - 1)) : -stakeUnits,
      result,
      slipBacked: draw(p.handle, i, 6) * 100 < p.slipBackedPct,
    });
  }
  BOOKS_BY_DAY.set(key, out);
  return out;
}

/** THE fold. Units, the return, the record and the count all come from this
 *  one pass over one array, so no two of them can be counted over different
 *  sets of bets. */
function recordOver(rows: SocialBet[]): SlipperRecord {
  let units = 0, staked = 0, wins = 0, losses = 0;
  for (const b of rows) {
    units += b.netUnits;
    if (b.result === 'void') continue;
    staked += b.stakeUnits;
    if (b.result === 'won') wins += 1; else losses += 1;
  }
  const u = round2(units);
  const s = round2(staked);
  return { bets: rows.length, wins, losses, stakedUnits: s, units: u, roi: s > 0 ? (u / s) * 100 : 0 };
}

/** The viewer's own record, from the viewer's own ledger.
 *
 *  `select()` is the product's one query and `summarise()` is its one count,
 *  so the position on the leaderboard is folded from exactly the array the
 *  dashboard and the ledger read. A second derivation here is how a league
 *  ends up disagreeing with the page that produced it. */
function yourRecord(period: LeaguePeriod, now: Date, slipBackedOnly: boolean): SlipperRecord {
  const data = demoData(now);
  const rows = select(data.bets, { ...DEFAULT_SCOPE, period }, now)
    .filter((b) => !slipBackedOnly || b.slipBacked);

  /*  FOLDED PER BALANCE AND ADDED UP IN UNITS.
   *
   *  This is the one place in the product that reads an account's whole
   *  book, because a league ranks a person rather than a pot, and it is
   *  therefore the one place that could add a euro turnover to a sterling
   *  one. It does not: turnover is divided by ITS OWN balance's unit first,
   *  and what is added is the dimensionless figure that comes out. Units
   *  were already safe, because a bet stores the unit it was placed with.
   *
   *  The return comes from the two figures beside it rather than from
   *  summarise(), for the same reason: net over turnover would be pence over
   *  pence across two currencies, and units over units is neither. */
  let bets = 0, wins = 0, losses = 0, units = 0, stakedUnits = 0;
  for (const bal of data.balances) {
    const mine = rows.filter((b) => b.balanceId === bal.id);
    if (!mine.length) continue;
    const s = summarise(mine);
    bets += s.count;
    wins += s.wins;
    losses += s.losses;
    units += s.units;
    stakedUnits += s.turnoverPence / (bal.unitMinor || 1);
  }

  return {
    bets,
    wins,
    losses,
    stakedUnits: round2(stakedUnits),
    units: round2(units),
    roi: stakedUnits > 0 ? (units / stakedUnits) * 100 : 0,
  };
}

/** Everybody, with a record for each of the three periods.
 *
 *  `slipBackedOnly` is passed down from the group being looked at rather than
 *  applied afterwards: a board that filtered rows after counting would show a
 *  return worked out over bets it says it is not counting. */
export function slippers(now = new Date(), opts: { slipBackedOnly?: boolean } = {}): Slipper[] {
  const backedOnly = opts.slipBackedOnly === true;
  return PEOPLE.map((p) => {
    if (p.handle === YOU) {
      return {
        ...p,
        month: yourRecord('month', now, backedOnly),
        year: yourRecord('year', now, backedOnly),
        all: yourRecord('all', now, backedOnly),
      };
    }
    const book = bookOf(p, now).filter((b) => !backedOnly || b.slipBacked);
    const inPeriod = (period: LeaguePeriod) => {
      const from = periodStart(period, now);
      return book.filter((b) => !from || new Date(b.at) >= from);
    };
    return {
      ...p,
      month: recordOver(inPeriod('month')),
      year: recordOver(inPeriod('year')),
      all: recordOver(inPeriod('all')),
    };
  });
}

export function recordFor(p: Slipper, period: LeaguePeriod): SlipperRecord {
  return p[period];
}

export const GROUPS: Omit<GroupSummary, 'members' | 'yourPosition' | 'youAreIn' | 'youOwn'>[] = [
  {
    id: 'the-nap', name: 'The Nap', joinMode: 'approval', rankingPeriod: 'year',
    slipBackedOnly: true, showEditAudit: true, inviteCode: 'P4RB9J', division: 'Premier',
    ownerHandle: YOU,
    blurb: 'One horse a day, slip backed only. The strictest group on Slippery.',
  },
  {
    id: 'thursday-coupon', name: 'Thursday Coupon', joinMode: 'code', rankingPeriod: 'month',
    slipBackedOnly: false, showEditAudit: true, inviteCode: 'K7QM2X', division: 'Championship',
    ownerHandle: 'rowan',
    blurb: 'Midweek European nights, mostly. Nobody takes it seriously until about March.',
  },
  {
    id: 'accas-only', name: 'Accas Only', joinMode: 'open', rankingPeriod: 'all',
    slipBackedOnly: false, showEditAudit: false, inviteCode: 'W2HN6T', division: 'League One',
    ownerHandle: 'ade',
    blurb: 'Four legs minimum. Losses are expected and the leaderboard shows it.',
  },
  {
    id: 'friday-fivers', name: 'Friday Fivers', joinMode: 'open', rankingPeriod: 'month',
    slipBackedOnly: false, showEditAudit: false, inviteCode: 'RVN83C', division: 'League Two',
    ownerHandle: 'callum',
    blurb: 'Started last week. One Slipper in it so far, and it is not you.',
  },
  {
    id: 'sunday-singles', name: 'Sunday Singles', joinMode: 'code', rankingPeriod: 'month',
    slipBackedOnly: true, showEditAudit: true, inviteCode: 'TCJ47W', division: 'League Two',
    ownerHandle: YOU,
    blurb: 'One bet a week, no multiples. Started and not yet shared with anybody.',
  },
];

export function groupSummaries(now = new Date()): GroupSummary[] {
  return GROUPS.map((g) => {
    const members = groupMembers(g.id, now);
    const board = league(members, g.rankingPeriod);
    const you = board.find((r) => r.handle === YOU);
    return {
      ...g,
      members: members.length,
      yourPosition: you?.position ?? 0,
      youAreIn: Boolean(you),
      youOwn: g.ownerHandle === YOU,
    };
  });
}

export function findGroup(id: string, now = new Date()): GroupSummary | undefined {
  return groupSummaries(now).find((g) => g.id === id);
}

/** A code is typed from a photograph of somebody's screen, so it is matched
 *  case insensitively and with the spaces people put in it taken out. */
export function groupByCode(code: string, now = new Date()): GroupSummary | undefined {
  const wanted = code.trim().toUpperCase().replace(/[\s-]+/g, '');
  if (!wanted) return undefined;
  return groupSummaries(now).find((g) => g.inviteCode === wanted);
}

export function league(people: Slipper[], period: LeaguePeriod = 'month'): LeagueRow[] {
  return people
    .map((p) => ({ ...p, record: recordFor(p, period), position: 0 }))
    /*  Units first, then who actually bet, then the handle.
        Everybody with nothing in the window sits on exactly 0.0u, and on the
        second of a month that is most of the field. Ranking them above a
        Slipper who is a unit down for having played would be a table that
        rewards not turning up. The handle is last so two Slippers level on
        both never swap places between one render and the next: a table that
        reorders itself while nothing changed is a table nobody trusts. */
    .sort((a, b) => b.record.units - a.record.units
      || b.record.bets - a.record.bets
      || a.handle.localeCompare(b.handle))
    .map((row, i) => ({ ...row, position: i + 1 }));
}

export function groupMembers(groupId: string, now = new Date()): Slipper[] {
  const g = GROUPS.find((x) => x.id === groupId);
  return slippers(now, { slipBackedOnly: g?.slipBackedOnly })
    .filter((p) => p.groups.includes(groupId));
}

/** How many bets a slip backed only group is leaving out, over its own
 *  ranking period. The board says the number rather than quietly counting
 *  fewer bets than the profiles behind it. */
export function slipBackedExcluded(groupId: string, now = new Date()): number {
  const g = GROUPS.find((x) => x.id === groupId);
  if (!g?.slipBackedOnly) return 0;
  const all = slippers(now).filter((p) => p.groups.includes(groupId));
  const backed = groupMembers(groupId, now);
  const count = (list: Slipper[]) => list.reduce((a, p) => a + recordFor(p, g.rankingPeriod).bets, 0);
  return Math.max(0, count(all) - count(backed));
}

export function findSlipper(handle: string, now = new Date()): Slipper | undefined {
  return slippers(now).find((p) => p.handle === handle);
}

// ------------------------------------------------------------ the two feeds

/** The activity feed celebrates app actions, never betting outcomes. Nothing
 *  here says who won what. */
export type FeedItem = { id: string; handle: string; name: string; kind: string; text: string; at: string };

export function feed(now = new Date()): FeedItem[] {
  const people = slippers(now);
  const at = (h: number) => new Date(now.getTime() - h * 3600000).toISOString();
  const pick = (i: number) => people[i % people.length];
  /*  NO STREAK LINE, AND NOTHING COUNTING CONSECUTIVE DAYS.
   *
   *  "captured a slip every day for 30 days" was the first item in this list.
   *  It reads as an app action and it is not one: nobody holds it without
   *  placing a bet on thirty consecutive days, and this list is published to
   *  other people, so it rewarded volume in front of an audience. Everything
   *  here is now either a thing you did once, or a completeness figure, which
   *  rises by recording better rather than by betting more. */
  const items: { kind: string; text: string; h: number }[] = [
    { kind: 'slip-backed', text: 'brought last month to nine in ten slip backed', h: 2 },
    { kind: 'join', text: 'joined Thursday Coupon', h: 5 },
    { kind: 'import', text: 'imported 412 bets from an old spreadsheet', h: 9 },
    { kind: 'slip-backed', text: 'reached 100% slip backed this month', h: 14 },
    { kind: 'group', text: 'started a group, The Nap', h: 26 },
    { kind: 'settle', text: 'settled everything that was waiting on them', h: 33 },
    { kind: 'break', text: 'is taking a break, back on the 12th', h: 41 },
    { kind: 'join', text: 'joined Accas Only', h: 52 },
    { kind: 'unit', text: 'changed unit size, so figures from here on use the new one', h: 66 },
  ];
  return items.map((it, i) => {
    const p = pick(i + 1);
    return { id: `f${i}`, handle: p.handle, name: p.name, kind: it.kind, text: it.text, at: at(it.h) };
  });
}

/** A bet somebody captured before it started, and nothing about how it went.
 *
 *  THE TYPE CARRIES NO OUTCOME AND NO MONEY, and that is the enforcement
 *  rather than a rule somebody has to remember at the point of rendering.
 *  There is nowhere on this object to put a result, so no screen reading it
 *  can print one, and the stake is in units because a stake in pounds is the
 *  one thing a Slipper never shows another Slipper. */
export type TrackedBet = {
  id: string;
  handle: string;
  name: string;
  selection: string;
  eventName: string;
  /** Decimal, as the slip carried it. */
  price: number;
  stakeUnits: number;
  bookmakerId: string;
  bookmaker: string;
  capturedAt: string;
  startsAt: string;
};

/** A finite number, and then it stops. A list that never ends is an
 *  engagement mechanic, and this product's whole argument is that it is a
 *  record rather than a place to spend an evening. */
export const TRACKING_FEED_MAX = 12;

const TRACKING_FIXTURES: { eventName: string; selection: string }[] = [
  { eventName: 'Arsenal v Brentford', selection: 'Arsenal, match result' },
  { eventName: 'Celtic v Hibernian', selection: 'Over 2.5 goals' },
  { eventName: 'Shamrock Rovers v Bohemians', selection: 'Both teams to score' },
  { eventName: '15:05 Leopardstown', selection: 'Galopin Des Champs, win' },
  { eventName: 'Napoli v Roma', selection: 'Draw, match result' },
  { eventName: 'Sinner v Medvedev', selection: 'Sinner 2-0' },
  { eventName: '14:30 Cheltenham', selection: 'Constitution Hill, win' },
  { eventName: 'Leeds v Norwich', selection: 'Leeds, Asian handicap -1' },
  { eventName: 'Derry City v Shelbourne', selection: 'Under 3.5 goals' },
  { eventName: 'Inter v Atalanta', selection: 'Inter, double chance 1X' },
];

const TRACKING_BOOKS = ['bet365', 'sky-bet', 'paddy-power', 'william-hill', 'boylesports', 'coral'];

/** Kick off times, in UTC minutes from midnight, and a fixture list is not a
 *  uniform spread over a day. Drawing an offset in continuous hours put an
 *  Inter v Atalanta at 03:25 and a Cheltenham race at 05:07, which is not a
 *  thing that happens and is the sort of detail that tells a reader the
 *  screen was generated rather than recorded. These are the real shapes of a
 *  card: a lunchtime kick off, the afternoon, and the evening ones. */
const KICK_OFFS = [11 * 60 + 45, 12 * 60 + 30, 13 * 60, 14 * 60, 14 * 60 + 30, 16 * 60 + 30, 18 * 60, 18 * 60 + 45, 19 * 60];

/** THE GATE, and it is the whole feature.
 *
 *  A bet captured after the event started is not a prediction, it is a claim,
 *  and this product exists because a record written afterwards is a record of
 *  the bets somebody felt like writing down. So an item is shown only while
 *  both halves hold: it was captured before the off, and the off has not
 *  happened yet. When the event starts the item ages out and is never
 *  revisited, which is why there is no code anywhere that could give it a
 *  result later. */
export function trackable(item: TrackedBet, now: Date): boolean {
  const start = new Date(item.startsAt).getTime();
  return new Date(item.capturedAt).getTime() < start && start > now.getTime();
}

/** Everything a Slipper who has opted in might show, before the gate.
 *
 *  ANCHORED TO THE DAY, NOT TO THE MOMENT OF READING. The first version put
 *  every kick off a few hours after `now`, which meant the whole list moved
 *  forward every time somebody loaded the page and not one item could ever
 *  age out: the gate would have been unfalsifiable, and the property it
 *  exists to enforce is exactly that an item runs out of time. Times are
 *  offsets from midnight of the day being read, so within a day they are
 *  fixed and the list genuinely empties as the afternoon goes on.
 *
 *  Exported because the gate is only demonstrable against a list that
 *  contains the things it has to refuse. Candidate 2 is captured a quarter of
 *  an hour AFTER an event that is at least twenty hours away, so it is
 *  refused for the one reason that matters rather than for having run out of
 *  time, and candidate 3 is always still to come, so there is always
 *  something the gate lets through. */
export function trackingCandidates(p: Slipper, now = new Date()): TrackedBet[] {
  const day = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const out: TrackedBet[] = [];
  for (let i = 0; i < 4; i += 1) {
    const f = TRACKING_FIXTURES[Math.floor(draw(p.handle, i, 21) * TRACKING_FIXTURES.length)];
    const slot = KICK_OFFS[Math.floor(draw(p.handle, i, 27) * KICK_OFFS.length)];
    /*  Candidates 2 and 3 are always tomorrow, so whatever time of day the
        page is read, one is always still to come and one is always far
        enough ahead that the only thing wrong with it is when it was
        captured. Candidates 0 and 1 fall either side of that, which is what
        puts some items past their off and out of the list. */
    const dayOffset = i >= 2 ? 1 : draw(p.handle, i, 22) < 0.5 ? 0 : 1;
    const startsAt = new Date(day + dayOffset * 86400000 + slot * 60000);
    const leadMinutes = i === 2 ? -15 : 20 + Math.floor(draw(p.handle, i, 23) * 1600);
    const bookmakerId = TRACKING_BOOKS[Math.floor(draw(p.handle, i, 26) * TRACKING_BOOKS.length)];
    out.push({
      id: `t-${p.handle}-${i}`,
      handle: p.handle,
      name: p.name,
      selection: f.selection,
      eventName: f.eventName,
      price: Number((1.45 + draw(p.handle, i, 24) * 4.2).toFixed(2)),
      stakeUnits: STAKES[Math.floor(draw(p.handle, i, 25) * STAKES.length)],
      bookmakerId,
      bookmaker: bookmakerName(bookmakerId),
      capturedAt: new Date(startsAt.getTime() - leadMinutes * 60000).toISOString(),
      startsAt: startsAt.toISOString(),
    });
  }
  return out;
}

/** What Slippers are tracking, right now, and nothing else.
 *
 *  Two filters and both are absolute: the person opted in, and the bet is
 *  through the gate. Soonest off first, because the only thing that changes
 *  about an item is that it runs out of time. */
export function trackingFeed(now = new Date()): TrackedBet[] {
  const items: TrackedBet[] = [];
  for (const p of slippers(now)) {
    if (!p.tracking) continue;
    for (const c of trackingCandidates(p, now)) if (trackable(c, now)) items.push(c);
  }
  return items
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())
    .slice(0, TRACKING_FEED_MAX);
}

/** How many Slippers have turned it on, which is the honest way to say how
 *  small this list is rather than implying everybody is in it. */
export function trackingOptedIn(now = new Date()): Slipper[] {
  return slippers(now).filter((p) => p.tracking);
}

/** What happens to a division at the end of the month, said once and then
 *  stopped.
 *
 *  "Moving to League One next month", never "RELEGATED", and never a word
 *  about what to do next. A table that shouts at somebody for a bad month is
 *  a table that asks them to bet their way out of it, which is the exact
 *  thing this product is not allowed to do.
 *
 *  Under four Slippers nothing moves, and the sentence says so rather than
 *  promoting the only person in a group of one. */
export function divisionMove(position: number, of: number, division: string): string {
  if (of < 4) return 'Divisions are set once a group has four Slippers.';
  const band = Math.max(1, Math.round(of / 4));
  const i = DIVISIONS.indexOf(division as (typeof DIVISIONS)[number]);
  const up = i > 0 ? DIVISIONS[i - 1] : null;
  const down = i >= 0 && i < DIVISIONS.length - 1 ? DIVISIONS[i + 1] : null;
  if (position <= band && up) return `Moving to ${up} next month.`;
  if (position > of - band && down) return `Moving to ${down} next month.`;
  return `Staying in ${division} next month.`;
}

/** The row a podium pins under itself, or nothing.
 *
 *  A rule rather than a condition inside the component, because it is a
 *  decision about what somebody is shown and it is worth a test. The podium
 *  already carries the top three; pinning a fourth copy of a Slipper who is
 *  standing on it put the same person on the page three times, on a plinth,
 *  in the pinned row, and in the first row of the table below. Outside the
 *  top three the pinned row is the only place their own figure appears
 *  without scrolling for it. */
export function pinnedRow(rows: LeagueRow[], you: string): LeagueRow | undefined {
  const mine = rows.find((r) => r.handle === you);
  return mine && mine.position > 3 ? mine : undefined;
}
