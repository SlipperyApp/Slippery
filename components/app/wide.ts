'use client';

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';

/** Whether the window is wide enough for a detail pane beside a list.
 *
 *  THE PANE IS A LAYOUT DECISION AND CSS OWNS IT. This exists only because
 *  the component on the other side of the breakpoint is a different
 *  component: over the line the bet, the slip or the Slipper renders inside
 *  the pane, and under it the same thing renders as a sheet over the page.
 *  Rendering both and hiding one would put two copies of the same ids in the
 *  document, which is a real defect the sweep checks for.
 *
 *  useSyncExternalStore rather than an effect, because an effect that reads
 *  matchMedia sets state after the first paint and the pane flashes in.
 *  The server has no viewport so it answers no, and nothing is open on a
 *  first paint anyway: this is only read after somebody presses a row. */
export function useWide(px: number): boolean {
  /*  Memoised on the width, because useSyncExternalStore resubscribes every
      time the subscribe function changes identity: built inline it would
      tear down and rebuild the listener on every render of the page. */
  const store = useMemo(() => {
    const query = `(min-width: ${px}px)`;
    return {
      subscribe: (cb: () => void) => {
        const m = window.matchMedia(query);
        m.addEventListener('change', cb);
        return () => m.removeEventListener('change', cb);
      },
      isWide: () => window.matchMedia(query).matches,
    };
  }, [px]);
  return useSyncExternalStore(store.subscribe, store.isWide, notWide);
}

const notWide = () => false;

/** Whether a horizontal scroller is over its frame, and whether there is
 *  anything past its right edge right now.
 *
 *  TWO ANSWERS, AND THEY ARE NOT THE SAME QUESTION. `over` is whether the
 *  table is wider than its frame at all, which is what a sentence under it
 *  reports; `right` is whether there is more to the right at this scroll
 *  position, which is what draws the fade. At the far right the first is
 *  still true and the second is not.
 *
 *  Measured rather than assumed, because the answer moves: one axis at 1440
 *  fits exactly, the same table crossed with a second does not, and a hint
 *  that is wrong in either direction is worse than none. */
export function useSideways<T extends HTMLElement>(deps: unknown[] = []) {
  const ref = useRef<T | null>(null);
  const [reach, setReach] = useState({ over: false, right: false });

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const check = () => setReach({
      over: el.scrollWidth - el.clientWidth > 2,
      right: el.scrollWidth - el.clientWidth - el.scrollLeft > 2,
    });
    check();
    el.addEventListener('scroll', check, { passive: true });
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', check);
      return () => {
        el.removeEventListener('scroll', check);
        window.removeEventListener('resize', check);
      };
    }
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => {
      el.removeEventListener('scroll', check);
      ro.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { ref, ...reach };
}
