/* Periods, in Europe/London, from `event_at`.
 *
 * A 00:30 kick-off belongs to the day the fixture is listed under, which is
 * the London calendar day, not UTC. Computing this in UTC is how a Champions
 * League tie played late on a Tuesday lands in Wednesday's column and the
 * calendar quietly disagrees with the headline.
 *
 * Week start is Monday or Sunday from settings and moves both the calendar
 * day letters and the weekly total, or the two say different things about
 * the same seven days.
 */
export type PeriodKey = 'today' | 'W' | 'M' | 'Y' | 'All' | 'custom';

const ZONE = 'Europe/London';

/* The London wall-clock parts of an instant. Intl is the only thing in the
   platform that knows when the clocks went forward. */
function londonParts(d: Date) {
  const f = new Intl.DateTimeFormat('en-GB', {
    timeZone: ZONE, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false, weekday: 'short',
  });
  const p = Object.fromEntries(f.formatToParts(d).map((x) => [x.type, x.value]));
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return {
    year: Number(p.year), month: Number(p.month), day: Number(p.day),
    hour: Number(p.hour === '24' ? '0' : p.hour), minute: Number(p.minute), second: Number(p.second),
    weekday: days.indexOf(String(p.weekday)),
  };
}

/* The instant at which a given London wall-clock time occurs. Solved rather
   than assumed, because the offset depends on the answer. */
function londonInstant(year: number, month: number, day: number, hour = 0, minute = 0, second = 0): Date {
  let guess = Date.UTC(year, month - 1, day, hour, minute, second);
  for (let i = 0; i < 3; i++) {
    const p = londonParts(new Date(guess));
    const seen = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
    const want = Date.UTC(year, month - 1, day, hour, minute, second);
    if (seen === want) break;
    guess += want - seen;
  }
  return new Date(guess);
}

export function londonDayStart(d: Date): Date {
  const p = londonParts(d);
  return londonInstant(p.year, p.month, p.day, 0, 0, 0);
}

export function londonDayEnd(d: Date): Date {
  const start = londonDayStart(d);
  const p = londonParts(new Date(start.getTime() + 36 * 3600_000));
  return new Date(londonInstant(p.year, p.month, p.day, 0, 0, 0).getTime() - 1);
}

export function periodRange(
  period: PeriodKey,
  weekStart: number,
  customFrom?: string | null,
  customTo?: string | null,
  now = new Date(),
): { from: Date; to: Date } {
  const p = londonParts(now);

  if (period === 'custom' && customFrom && customTo) {
    return { from: new Date(customFrom), to: new Date(customTo) };
  }

  switch (period) {
    case 'today':
      return { from: londonDayStart(now), to: londonDayEnd(now) };

    case 'W': {
      /* Monday = 1, Sunday = 0 from settings. */
      const back = weekStart === 1 ? (p.weekday + 6) % 7 : p.weekday;
      const from = new Date(londonDayStart(now).getTime() - back * 86400000);
      return { from: londonDayStart(from), to: londonDayEnd(new Date(from.getTime() + 6 * 86400000)) };
    }

    case 'M':
      return {
        from: londonInstant(p.year, p.month, 1),
        to: new Date(londonInstant(p.month === 12 ? p.year + 1 : p.year, p.month === 12 ? 1 : p.month + 1, 1).getTime() - 1),
      };

    case 'Y':
      return { from: londonInstant(p.year, 1, 1), to: new Date(londonInstant(p.year + 1, 1, 1).getTime() - 1) };

    case 'All':
    default:
      return { from: new Date(0), to: new Date(Date.now() + 10 * 365 * 86400000) };
  }
}

/* The London calendar date an event belongs to, as YYYY-MM-DD. This is the
   key the calendar buckets on, so a late kick-off cannot land in the wrong
   square. */
export function londonDateKey(d: Date): string {
  const p = londonParts(d);
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
}

export const DAY_LETTERS = (weekStart: number) =>
  weekStart === 1 ? ['M', 'T', 'W', 'T', 'F', 'S', 'S'] : ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
