'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { money, pct, units as fmtUnits } from '@/lib/format';
import type { Currency } from '@/lib/domain/types';

/*  useLayoutEffect on the client, useEffect on the server.
 *
 *  The count has to be started BEFORE the first paint or the first painted
 *  frame is the final number, which then drops to zero and climbs back: a
 *  flicker, and a worse one than no animation at all. useLayoutEffect runs
 *  before paint and does exactly that; it also warns when React renders it
 *  on the server, which this component is, so the choice is made once at
 *  module load and the same hook is therefore called on every render in a
 *  given environment. */
const useBeforePaint = typeof window === 'undefined' ? useEffect : useLayoutEffect;

/** A figure that counts to its value, and counts AGAIN from wherever it was
 *  whenever the value changes.
 *
 *  It used to run once and never again, guarded by a ref: a figure that
 *  counts up on arrival and then jumps when the period changes is animating
 *  the page load rather than the number. Changing the scope now rolls the
 *  figure from the old answer to the new one, which is the only moment on
 *  the dashboard where a number genuinely moves.
 *
 *  Server rendered as the finished value, so with no JavaScript the number
 *  is simply the number, and the element carries the finished text for a
 *  screen reader either way. Under prefers-reduced-motion it lands
 *  immediately. */
export function CountUp({
  to, render, duration = 460,
}: {
  to: number;
  render: (value: number) => string;
  duration?: number;
}) {
  const [value, setValue] = useState(to);
  /** Where the next count starts. Zero for the first one, and the figure
   *  that is currently on screen for every one after it. */
  const from = useRef(0);
  const frame = useRef(0);

  useBeforePaint(() => {
    if (typeof window === 'undefined') return;
    const start = from.current;
    from.current = to;
    if (start === to) { setValue(to); return; }
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setValue(to); return; }

    setValue(start);
    const t0 = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / duration);
      // Ease out, so it lands rather than stops.
      const eased = 1 - (1 - p) ** 3;
      setValue(Math.round(start + (to - start) * eased));
      if (p < 1) frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame.current);
  }, [to, duration]);

  return (
    <>
      <span aria-hidden="true">{render(value)}</span>
      <span className="sr-only">{render(to)}</span>
    </>
  );
}

/*  A function cannot cross the boundary from a server component to a client
 *  one, so a page that wants a counting figure cannot pass `render`. These
 *  three take only numbers and strings and do the formatting on the client,
 *  through lib/format like everything else. */

export function MoneyUp({
  minor, currency, sign = false,
}: { minor: number; currency: Currency; sign?: boolean }) {
  return <CountUp to={minor} render={(v) => money(v, currency, { sign })} />;
}

export function PctUp({ value, sign = false }: { value: number; sign?: boolean }) {
  /*  Tenths, because pct() rounds to one decimal place and counting in whole
      per cent would land on a different number from the one it started for. */
  return <CountUp to={Math.round(value * 10)} render={(v) => pct(v / 10, { sign })} />;
}

export function UnitsUp({ value, sign = false }: { value: number; sign?: boolean }) {
  /*  Hundredths, for the same reason, and units are shown to two places. */
  return <CountUp to={Math.round(value * 100)} render={(v) => fmtUnits(v / 100, { sign })} />;
}
