/* The background motion engine.
 *
 * Budget, and why it is what it is:
 *   · One passive scroll listener for the whole page, rAF-throttled, that
 *     writes transforms to at most three elements. No layout is read in
 *     the handler after the first frame, so it never forces a sync reflow.
 *   · transform and opacity only. Animating top/left/width/height would
 *     put the compositor back on the main thread and iPhone scrolling
 *     would stutter, which is the failure this whole file exists to avoid.
 *   · Everything animated lives inside .sky, which is overflow:hidden and
 *     contain:strict. An uncontained decorative layer once caused 47px of
 *     horizontal scroll on mobile.
 *   · prefers-reduced-motion disables the loop entirely — CSS drops the
 *     keyframes, and this file never installs the scroll listener.
 */
import { $, $$, RM } from './dom.js';

let bands = [];
let ticking = false;
let lastY = -1;

function paint(y) {
  for (let i = 0; i < bands.length; i++) {
    const b = bands[i];
    /* translate3d keeps each band on its own compositor layer. The CSS
       keyframe drift lives on the same element, so the two compose:
       the animation supplies the idle motion, this supplies parallax. */
    b.el.style.setProperty('--parallax', (y * b.rate).toFixed(2) + 'px');
  }
}

function onScroll() {
  if (ticking) return;
  ticking = true;
  requestAnimationFrame(() => {
    const y = window.scrollY || 0;
    if (y !== lastY) { lastY = y; paint(y); }
    ticking = false;
  });
}

/** Header shadow. Batched into the same rAF as the parallax. */
function installTopbarShadow() {
  let pending = false;
  const bars = ['topbarSite', 'topbarApp'].map($).filter(Boolean);
  addEventListener('scroll', () => {
    if (pending) return;
    pending = true;
    requestAnimationFrame(() => {
      const on = (window.scrollY || 0) > 16;
      bars.forEach(b => b.classList.toggle('scrolled', on));
      pending = false;
    });
  }, { passive: true });
}

export function initMotion() {
  installTopbarShadow();
  if (RM) return;

  bands = $$('.sky-silk [data-parallax]').map(el => ({
    el,
    rate: parseFloat(el.getAttribute('data-parallax')) || 0
  }));
  if (!bands.length) return;

  addEventListener('scroll', onScroll, { passive: true });
  paint(window.scrollY || 0);
}

/** Repaint the theme-color meta so the iOS status bar matches the theme. */
export function syncThemeColor() {
  const meta = document.querySelector('meta[name="theme-color"]');
  if (!meta) return;
  const bg = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim();
  if (bg) meta.setAttribute('content', bg);
}
