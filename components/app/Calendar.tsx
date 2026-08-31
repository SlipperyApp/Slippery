import { londonDay, londonParts, MONTH_LONG, money } from '@/lib/format';
import type { Currency } from '@/lib/domain/types';

/** The calendar is always the month shown, so it ignores the scope bar and
 *  says so in its own header.
 *
 *  Day boundaries are Europe/London, or a 23:00 bet lands on the wrong day.
 *  A future day never carries a value. */
export function MonthCalendar({
  days, now, weekStart = 1, showDates = true, currency = 'GBP',
}: {
  days: { day: string; netPence: number; count: number }[];
  now: Date;
  weekStart?: 0 | 1;
  showDates?: boolean;
  currency?: Currency;
}) {
  const p = londonParts(now);
  const today = londonDay(now);
  const first = new Date(Date.UTC(p.year, p.month - 1, 1));
  const daysInMonth = new Date(Date.UTC(p.year, p.month, 0)).getUTCDate();
  const lead = (first.getUTCDay() - weekStart + 7) % 7;

  const byDay = new Map(days.map((d) => [d.day, d]));
  const magnitudes = days.map((d) => Math.abs(d.netPence));
  const peak = Math.max(1, ...magnitudes);

  const DOW_MON = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  const DOW_SUN = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  const dow = weekStart === 1 ? DOW_MON : DOW_SUN;

  const cells: React.ReactNode[] = [];
  for (let i = 0; i < lead; i++) {
    cells.push(<div key={`pad${i}`} className="cal__cell cal__cell--out" aria-hidden="true" />);
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const key = `${p.year}-${String(p.month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const rec = byDay.get(key);
    const future = key > today;
    const net = future ? 0 : rec?.netPence ?? 0;
    // The ramp jumps the dead band rather than fading into it, so a small day
    // is still visible and the number on top stays readable.
    const strength = net === 0 ? 0 : 0.22 + (Math.abs(net) / peak) * 0.58;
    const colour = net > 0 ? 'var(--pos)' : 'var(--neg)';
    const title = future
      ? `${d} ${MONTH_LONG[p.month - 1]}, not yet`
      : `${d} ${MONTH_LONG[p.month - 1]}, ${rec ? `${money(net, currency, { sign: true })} from ${rec.count} bet${rec.count === 1 ? '' : 's'}` : 'no bets'}`;
    cells.push(
      <div
        key={key}
        className={`cal__cell${future ? ' cal__cell--future' : ''}${key === today ? ' cal__cell--today' : ''}`}
        title={title}
      >
        {net !== 0 ? (
          <span className="cal__fill" style={{ background: colour, opacity: strength }} aria-hidden="true" />
        ) : null}
        {showDates ? <span className="cal__n">{d}</span> : <span className="sr-only">{d}</span>}
        <span className="sr-only">{title}</span>
      </div>,
    );
  }

  return (
    <div>
      <div className="cal" role="grid" aria-label={`${MONTH_LONG[p.month - 1]} ${p.year}`}>
        {dow.map((l, i) => <div key={`${l}${i}`} className="cal__dow" aria-hidden="true">{l}</div>)}
        {cells}
      </div>
    </div>
  );
}
