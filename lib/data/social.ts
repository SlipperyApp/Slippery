/** Groups, leagues and the people in them.
 *
 *  Other Slippery users are Slippers, never "users". Members is kept for
 *  people inside a specific group, because that is a role rather than an
 *  identity.
 *
 *  Ranked in units, never in pounds: a bigger bankroll should not be a bigger
 *  score. Outside a group only units are ever visible, never stakes. */

import { demoData } from './demo';
import { summarise, select, DEFAULT_SCOPE } from './analytics';

export type Slipper = {
  handle: string;
  name: string;
  unitsMonth: number;
  unitsAllTime: number;
  slipBackedPct: number;
  bets: number;
  lateEdits: number;
  following: boolean;
  followsYou: boolean;
  groups: string[];
  joined: string;
};

export type LeagueRow = Slipper & { position: number };

export type GroupSummary = {
  id: string;
  name: string;
  members: number;
  joinMode: 'open' | 'code' | 'approval';
  rankingPeriod: 'month' | 'year' | 'all';
  slipBackedOnly: boolean;
  showEditAudit: boolean;
  inviteCode: string;
  division: string;
  /** Where you sit, and how many are in the field. */
  yourPosition: number;
  blurb: string;
};

/** Divisions move quietly at the end of a month. "Moving to League One next
 *  month", never "RELEGATED": state the number and stop. */
export const DIVISIONS = ['Premier', 'Championship', 'League One', 'League Two'] as const;

const PEOPLE: Omit<Slipper, 'unitsMonth' | 'unitsAllTime' | 'bets'>[] = [
  { handle: 'rowan', name: 'Rowan', slipBackedPct: 94, lateEdits: 0, following: true, followsYou: true, groups: ['thursday-coupon', 'accas-only'], joined: '2026-02-11T09:00:00Z' },
  { handle: 'priya_b', name: 'Priya', slipBackedPct: 100, lateEdits: 0, following: true, followsYou: true, groups: ['thursday-coupon'], joined: '2026-01-04T09:00:00Z' },
  { handle: 'tester123', name: 'Tester', slipBackedPct: 88, lateEdits: 2, following: false, followsYou: false, groups: ['thursday-coupon', 'the-nap', 'accas-only'], joined: '2026-03-02T09:00:00Z' },
  { handle: 'dev_k', name: 'Dev', slipBackedPct: 71, lateEdits: 5, following: false, followsYou: true, groups: ['thursday-coupon'], joined: '2026-04-19T09:00:00Z' },
  { handle: 'marcus', name: 'Marcus', slipBackedPct: 96, lateEdits: 1, following: true, followsYou: false, groups: ['thursday-coupon', 'the-nap'], joined: '2026-02-27T09:00:00Z' },
  { handle: 'niamh', name: 'Niamh', slipBackedPct: 82, lateEdits: 0, following: false, followsYou: true, groups: ['the-nap'], joined: '2026-05-08T09:00:00Z' },
  { handle: 'ade', name: 'Ade', slipBackedPct: 91, lateEdits: 0, following: true, followsYou: true, groups: ['accas-only'], joined: '2026-03-21T09:00:00Z' },
  { handle: 'siobhan', name: 'Siobhan', slipBackedPct: 77, lateEdits: 3, following: false, followsYou: false, groups: ['the-nap', 'accas-only'], joined: '2026-06-02T09:00:00Z' },
  { handle: 'callum', name: 'Callum', slipBackedPct: 89, lateEdits: 0, following: false, followsYou: false, groups: ['thursday-coupon'], joined: '2026-01-30T09:00:00Z' },
  { handle: 'ffion', name: 'Ffion', slipBackedPct: 100, lateEdits: 0, following: true, followsYou: false, groups: ['the-nap'], joined: '2026-04-02T09:00:00Z' },
  { handle: 'jonty', name: 'Jonty', slipBackedPct: 64, lateEdits: 7, following: false, followsYou: false, groups: ['accas-only'], joined: '2026-05-19T09:00:00Z' },
  { handle: 'eilidh', name: 'Eilidh', slipBackedPct: 93, lateEdits: 1, following: false, followsYou: true, groups: ['thursday-coupon'], joined: '2026-02-02T09:00:00Z' },
];

/** Deterministic per person, so a name always carries the same figures. */
function seeded(handle: string, salt: number): number {
  let h = salt;
  for (let i = 0; i < handle.length; i++) h = (h * 31 + handle.charCodeAt(i)) >>> 0;
  return (h % 10000) / 10000;
}

export function slippers(now = new Date()): Slipper[] {
  const data = demoData(now);
  const you = summarise(select(data.bets, { ...DEFAULT_SCOPE, period: 'month' }, now));
  const youAll = summarise(select(data.bets, { ...DEFAULT_SCOPE, period: 'all' }, now));

  return PEOPLE.map((p) => {
    if (p.handle === 'tester123') {
      return {
        ...p,
        unitsMonth: Number(you.units.toFixed(2)),
        unitsAllTime: Number(youAll.units.toFixed(2)),
        bets: youAll.count,
      };
    }
    const a = seeded(p.handle, 7);
    const b = seeded(p.handle, 13);
    return {
      ...p,
      unitsMonth: Number(((a - 0.42) * 46).toFixed(2)),
      unitsAllTime: Number(((b - 0.4) * 130).toFixed(2)),
      bets: 40 + Math.round(b * 260),
    };
  });
}

export const GROUPS: Omit<GroupSummary, 'members' | 'yourPosition'>[] = [
  {
    id: 'thursday-coupon', name: 'Thursday Coupon', joinMode: 'code', rankingPeriod: 'month',
    slipBackedOnly: false, showEditAudit: true, inviteCode: 'K7QM2X', division: 'Championship',
    blurb: 'Midweek European nights, mostly. Nobody takes it seriously until about March.',
  },
  {
    id: 'the-nap', name: 'The Nap', joinMode: 'approval', rankingPeriod: 'month',
    slipBackedOnly: true, showEditAudit: true, inviteCode: 'P4RB9J', division: 'Premier',
    blurb: 'One horse a day, slip backed only. The strictest group on Slippery.',
  },
  {
    id: 'accas-only', name: 'Accas Only', joinMode: 'open', rankingPeriod: 'month',
    slipBackedOnly: false, showEditAudit: false, inviteCode: 'W2HN6T', division: 'League One',
    blurb: 'Four legs minimum. Losses are expected and the leaderboard shows it.',
  },
];

export function groupSummaries(now = new Date()): GroupSummary[] {
  const people = slippers(now);
  return GROUPS.map((g) => {
    const members = people.filter((p) => p.groups.includes(g.id));
    const board = league(members, g.rankingPeriod);
    const you = board.find((r) => r.handle === 'tester123');
    return { ...g, members: members.length, yourPosition: you?.position ?? members.length };
  });
}

export function league(people: Slipper[], period: 'month' | 'year' | 'all' = 'month'): LeagueRow[] {
  const key = period === 'month' ? 'unitsMonth' : 'unitsAllTime';
  return [...people]
    .sort((a, b) => (b[key] as number) - (a[key] as number))
    .map((p, i) => ({ ...p, position: i + 1 }));
}

export function groupMembers(groupId: string, now = new Date()): Slipper[] {
  return slippers(now).filter((p) => p.groups.includes(groupId));
}

export function findSlipper(handle: string, now = new Date()): Slipper | undefined {
  return slippers(now).find((p) => p.handle === handle);
}

/** The feed celebrates app actions, never betting outcomes. Nothing here
 *  says who won what. */
export type FeedItem = { id: string; handle: string; name: string; kind: string; text: string; at: string };

export function feed(now = new Date()): FeedItem[] {
  const people = slippers(now);
  const at = (h: number) => new Date(now.getTime() - h * 3600000).toISOString();
  const pick = (i: number) => people[i % people.length];
  const items: { kind: string; text: string; h: number }[] = [
    { kind: 'streak', text: 'captured a slip every day for 30 days', h: 2 },
    { kind: 'join', text: 'joined Thursday Coupon', h: 5 },
    { kind: 'import', text: 'imported 412 bets from an old spreadsheet', h: 9 },
    { kind: 'slip-backed', text: 'reached 100% slip backed this month', h: 14 },
    { kind: 'group', text: 'started a group, The Nap', h: 26 },
    { kind: 'streak', text: 'captured a slip every day for 14 days', h: 33 },
    { kind: 'break', text: 'is taking a break, back on the 12th', h: 41 },
    { kind: 'join', text: 'joined Accas Only', h: 52 },
    { kind: 'unit', text: 'changed unit size, so figures from here on use the new one', h: 66 },
  ];
  return items.map((it, i) => {
    const p = pick(i + 1);
    return { id: `f${i}`, handle: p.handle, name: p.name, kind: it.kind, text: it.text, at: at(it.h) };
  });
}
