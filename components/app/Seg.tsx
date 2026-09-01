'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/** A segmented control that can be wider than the phone it is on.
 *
 *  Five periods do not fit across 390px, so the strip scrolls. Two things
 *  follow from that, and neither was true before:
 *
 *    THE SELECTED ONE MUST BE VISIBLE. The dashboard opens on All time,
 *    which is the fifth of five, so on a phone the bar showed four periods
 *    and none of them was the one in force. A control that hides its own
 *    state is worse than no control. It is scrolled into view on mount, by
 *    arithmetic on the strip's own scrollLeft rather than scrollIntoView,
 *    which is allowed to scroll every ancestor including the page.
 *
 *    THE SCROLL MUST BE VISIBLE TOO. A hidden scrollbar on a strip that
 *    fits looks the same as a hidden scrollbar on a strip that does not.
 *    The edges fade only while there is something past them, so the fade is
 *    a fact about this strip rather than decoration on every strip.
 */
export function Seg({
  label, className = '', children,
}: { label: string; className?: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [edge, setEdge] = useState('');

  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const room = el.scrollWidth - el.clientWidth;
    if (room < 2) { setEdge(''); return; }
    const start = el.scrollLeft > 2;
    const end = el.scrollLeft < room - 2;
    setEdge(`${start ? ' seg--fadeL' : ''}${end ? ' seg--fadeR' : ''}`);
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const on = el.querySelector<HTMLElement>('[aria-pressed="true"]');
    if (on && el.scrollWidth > el.clientWidth) {
      // Centre it where there is room, clamped to the ends.
      const want = on.offsetLeft - (el.clientWidth - on.offsetWidth) / 2;
      el.scrollLeft = Math.max(0, Math.min(want, el.scrollWidth - el.clientWidth));
    }
    measure();
    el.addEventListener('scroll', measure, { passive: true });
    window.addEventListener('resize', measure, { passive: true });
    return () => {
      el.removeEventListener('scroll', measure);
      window.removeEventListener('resize', measure);
    };
  }, [measure]);

  return (
    <div ref={ref} className={`seg${edge}${className ? ` ${className}` : ''}`} role="group" aria-label={label}>
      {children}
    </div>
  );
}
