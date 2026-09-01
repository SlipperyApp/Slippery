'use client';

import { useEffect, useRef, useState } from 'react';

/** Counts a figure up to its value once, over the settlement moment's 320ms.
 *
 *  Once, never repeated on scroll: the ref guards it. Under
 *  prefers-reduced-motion the final value is rendered immediately, and the
 *  element carries the finished text for a screen reader either way. */
export function CountUp({
  to, render, duration = 320,
}: {
  to: number;
  render: (value: number) => string;
  duration?: number;
}) {
  const [value, setValue] = useState(to);
  const done = useRef(false);

  useEffect(() => {
    if (done.current) return;
    done.current = true;
    if (typeof window === 'undefined') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setValue(to); return; }

    const from = 0;
    const start = performance.now();
    let frame = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / duration);
      // Ease out, so it lands rather than stops.
      const eased = 1 - (1 - p) ** 3;
      setValue(Math.round(from + (to - from) * eased));
      if (p < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [to, duration]);

  return (
    <>
      <span aria-hidden="true">{render(value)}</span>
      <span className="sr-only">{render(to)}</span>
    </>
  );
}
