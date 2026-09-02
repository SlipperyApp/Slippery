/** What a shared balance link is allowed to say.
 *
 *  THIS MODULE IS THE BOUNDARY, and it is the whole of the boundary. The
 *  public page renders what this returns and has no other source: it never
 *  sees the account, the other balances, the bets or a single figure in
 *  money. That is deliberate and it is why the shape below is what it is.
 *
 *  NOT ONE FIGURE HERE IS IN MONEY. Every value is a count, a percentage or
 *  a number of units, and units are dimensionless: they are the same measure
 *  the leaderboard has always ranked people in for exactly this reason. A
 *  shared record says how somebody has done. It does not say what they stake,
 *  what is in their account or what they can afford to lose, and there is no
 *  field on the returned type through which any of that could travel.
 *
 *  THE TOKEN IS THE PERMISSION. There is no second flag, no expiry and no
 *  visibility column that could disagree with it. Turning sharing off sets
 *  the token to null, and the next request finds nothing: revocation is
 *  immediate because there is nothing else to check. */

import { demoData, type DemoData } from './demo';
import { summarise, byDay } from './analytics';
import { inBalance } from '@/lib/domain/balances';
import { isShareToken } from '@/lib/server/codes';
import { DEFAULT_TZ, type TimeZone } from '@/lib/format';

/** One day, in HUNDREDTHS OF A UNIT. Not pence, not any currency: the page
 *  that draws these has no currency to draw them in. */
export type ShareDay = { day: string; units100: number; count: number };

export type ShareView = {
  /** The balance's name, which its owner chose. */
  name: string;
  /** Who keeps it, by the handle they are already known by on the
   *  leaderboard. Their email, their display name and every other balance
   *  they own are not here and cannot be reached from here. */
  handle: string;
  bets: number;
  settled: number;
  /** Net, in units. The one figure that says how it has gone. */
  units: number;
  /** Net over turnover. A ratio, so it carries no currency either. */
  roi: number;
  winRate: number;
  wins: number;
  losses: number;
  /** Every settled day, for the calendar, and the running total for the
   *  curve. Both in hundredths of a unit. */
  days: ShareDay[];
  curve: { day: string; units100: number }[];
  /** The account's zone, so the calendar draws the days it was told about. */
  timeZone: TimeZone;
  weekStart: 0 | 1;
};

/** The balance behind a token, or nothing at all.
 *
 *  Nothing at all is the answer for a token that was never issued, for one
 *  that has been revoked, and for a string that is not a token. The caller
 *  gets one null for all three, because telling a stranger which of the
 *  three they hit is telling them something. */
export function sharedView(
  token: string,
  now = new Date(),
  /*  The record to look in. It is a parameter so that revocation can be
      tested through this exact function rather than through a copy of it:
      tests/share.test.ts clears the token on every balance and asserts the
      same call that worked a line earlier now finds nothing. A revocation
      that is only tested against a reimplementation of the lookup is not
      tested. */
  data: DemoData = demoData(now),
): ShareView | null {
  /*  Shape first, so a request with a hundred characters of junk in it never
      touches the record at all. */
  if (!isShareToken(token)) return null;

  /*  The null guard is not decoration. Every balance that is NOT shared
      carries null here, and a comparison that let null match anything would
      hand a stranger the first unshared balance on the account. */
  const balance = data.balances.find((b) => b.shareToken !== null && b.shareToken === token);
  if (!balance) return null;

  const bets = inBalance(data.bets, balance.id);
  const s = summarise(bets);
  const tz = data.account.timeZone || DEFAULT_TZ;
  const unit = balance.unitMinor || 1;

  /*  Days in units rather than in money, converted HERE so the page has no
      money to convert. A day's net over the balance's own unit, times a
      hundred, which is the precision the calendar draws to. */
  const days: ShareDay[] = byDay(bets, tz).map((d) => ({
    day: d.day,
    units100: Math.round((d.netPence / unit) * 100),
    count: d.count,
  }));

  let running = 0;
  const curve = days.map((d) => {
    running += d.units100;
    return { day: d.day, units100: running };
  });

  return {
    name: balance.name,
    handle: data.account.handle,
    bets: s.count,
    settled: s.settled,
    units: s.units,
    roi: s.roi,
    winRate: s.winRate,
    wins: s.wins,
    losses: s.losses,
    days,
    curve,
    timeZone: tz,
    weekStart: data.account.weekStart,
  };
}

/** The public address of a shared balance. One place, so the page, the copy
 *  button and any link in an email cannot drift apart. */
export function sharePath(token: string): string {
  return `/b/${token}`;
}
