'use client';

import { useEffect } from 'react';

/** Entrance animations, fired once and never reversed.
 *
 *  WHAT WAS HERE. `animation-timeline: view()`, which ties the animation to
 *  scroll POSITION: scroll back up and every section plays its entrance
 *  backwards, forever, which is motion the page keeps doing at you. This
 *  fires each element once, on the way in, and then stops observing it.
 *
 *  TRANSFORM ONLY, never opacity, and this is the load bearing part. An
 *  earlier build faded in from opacity 0 and everything below the fold sat at
 *  0 until it was scrolled to: axe measured 46 calendar figures at 1:1 on
 *  /demo and was right to. Content invisible until a scroll is content
 *  invisible to anything that does not scroll, which includes printing, a
 *  short viewport that cannot reach it, and a screenshot.
 *
 *  The class goes on <html>, so with JavaScript off, or before this mounts,
 *  nothing is offset and nothing is hidden. The offset only exists once
 *  something is able to remove it. */
export function Reveal() {
  useEffect(() => {
    const root = document.documentElement;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (!('IntersectionObserver' in window)) return;

    const targets = [...document.querySelectorAll<HTMLElement>('.sect > .wrap > *')]
      .filter((el) => !el.closest('.hero'));
    if (!targets.length) return;

    root.classList.add('js-reveal');
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        e.target.classList.add('is-in');
        io.unobserve(e.target);          // once, and never again
      }
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.01 });

    for (const el of targets) io.observe(el);
    return () => io.disconnect();
  }, []);

  return null;
}
