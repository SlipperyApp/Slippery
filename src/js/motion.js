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
 *   · prefers-reduced-motion disables the loop entirely, CSS drops the
 *     keyframes, and this file never installs the scroll listener.
 */
import { $, $$, RM } from './dom.js';

let bands = [];
let ticking = false;
let lastY = -1;

/* ── the scroll-jacked sequence ──
   Geometry is measured once and on resize, never inside the scroll
   handler. Reading offsetTop while scrolling forces a synchronous
   reflow every frame, which is precisely how a compositor-only
   animation ends up back on the main thread. */
const jack = {
  el: null, track: null, caps: [], h: null, p: null, n: null,
  top: 0, span: 1, scene: -1, swapping: false
};

function measureJack() {
  if (!jack.el) return;
  const r = jack.track.getBoundingClientRect();
  jack.top = r.top + (window.scrollY || 0);
  /* The stage is one viewport tall and sticks, so the distance actually
     available to the sequence is the track minus that viewport. */
  jack.span = Math.max(1, jack.track.offsetHeight - window.innerHeight);
}

/* Presence of a scene whose beat centre is `c`, given progress `p`.
   One beat either side, clamped, so exactly one scene is solid at each
   snap point and neighbours cross-fade between them. */
const clamp = (v, lo, hi) => v < lo ? lo : v > hi ? hi : v;

function paintJack(y) {
  if (!jack.el) return;
  const p = clamp((y - jack.top) / jack.span, 0, 1);
  const st = jack.el.style;
  for (let i = 0; i < 3; i++) {
    const s = clamp((p - i / 2) * 2, -1, 1);          /* signed position  */
    st.setProperty('--s' + (i + 1), s.toFixed(4));
    st.setProperty('--a' + (i + 1), (1 - Math.abs(s)).toFixed(4));
  }
  const scene = clamp(Math.round(p * 2), 0, 2);
  if (scene !== jack.scene) swapCaption(scene);
}

/* The caption is text, so it cannot cross-fade on the compositor the way
   the scenes do. Fade it out, swap, fade it back, 200ms each way, which
   is short enough not to lag the scene behind it. */
function swapCaption(scene) {
  jack.scene = scene;
  jack.el.setAttribute('data-scene', String(scene));
  const step = jack.caps[scene];
  if (!step) return;
  const write = () => {
    jack.n.textContent = '0' + (scene + 1);
    jack.h.textContent = step.getAttribute('data-h');
    jack.p.textContent = step.getAttribute('data-p');
  };
  if (jack.swapping) { write(); return; }
  jack.swapping = true;
  jack.el.style.setProperty('--fade', '0');
  setTimeout(() => {
    write();
    jack.el.style.setProperty('--fade', '1');
    jack.swapping = false;
  }, 190);
}

function paint(y) {
  for (let i = 0; i < bands.length; i++) {
    const b = bands[i];
    /* translate3d keeps each band on its own compositor layer. The CSS
       keyframe drift lives on the same element, so the two compose:
       the animation supplies the idle motion, this supplies parallax. */
    b.el.style.setProperty('--parallax', (y * b.rate).toFixed(2) + 'px');
  }
  paintJack(y);
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
  /* Reduced motion: no parallax, no pinned sequence. CSS has already
     collapsed the track and stacked the scenes, so there is nothing for
     a scroll handler to drive and none is installed. */
  if (RM) return;

  bands = $$('.sky-silk [data-parallax]').map(el => ({
    el,
    rate: parseFloat(el.getAttribute('data-parallax')) || 0
  }));

  const el = $('jack');
  if (el) {
    jack.el = el;
    jack.track = el.querySelector('.jack-track');
    jack.caps = $$('.jack-step', el);
    jack.h = $('jackH'); jack.p = $('jackP'); jack.n = $('jackN');
    jack.el.setAttribute('data-scene', '0');
    measureJack();
    /* The web fonts land after first paint and change the track's
       position; re-measure rather than run the sequence against stale
       geometry. Same for orientation changes and the iOS toolbar. */
    addEventListener('resize', measureJack, { passive: true });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(measureJack);
  }

  if (!bands.length && !jack.el) return;
  addEventListener('scroll', onScroll, { passive: true });
  paint(window.scrollY || 0);
}

/* ---------------- the headline count-up ----------------
 *
 * The one number on the dashboard everybody looks at, and it used to
 * change by replacing its text. A figure that jumps from one value to
 * another asks the reader to notice a difference they did not see happen;
 * counting makes the change itself legible, which is the only reason to
 * animate a number at all.
 *
 * Three rules keep it from being decoration:
 *   · Skipped when the change is under a pound. Counting from £94.20 to
 *     £94.25 is a twitch, not information.
 *   · Skipped under reduced motion, and skipped on first paint, where
 *     there is no previous value to have changed from.
 *   · Tabular figures already, so nothing reflows while it runs, and the
 *     final frame writes the exact string the formatter produced rather
 *     than a rounded reconstruction of it.
 */
const COUNT_MS = 420;
const counting = new WeakMap();

export function countTo(el, pence, format) {
  if (!el) return;
  const from = counting.get(el);
  const text = format(pence);
  counting.set(el, pence);

  if (RM || from == null || Math.abs(pence - from) < 100) { el.innerHTML = text; return; }

  const started = performance.now();
  const span = pence - from;
  const run = now => {
    const t = Math.min(1, (now - started) / COUNT_MS);
    /* The same ease-out the interface uses everywhere else, as a curve
       rather than a keyword, because this is JavaScript and there is no
       cubic-bezier() to hand. */
    const eased = 1 - Math.pow(1 - t, 3);
    if (t >= 1) { el.innerHTML = text; return; }
    el.innerHTML = format(Math.round(from + span * eased));
    requestAnimationFrame(run);
  };
  requestAnimationFrame(run);
}

/** Repaint the theme-color meta so the iOS status bar matches the theme. */
export function syncThemeColor() {
  const meta = document.querySelector('meta[name="theme-color"]');
  if (!meta) return;
  const bg = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim();
  if (bg) meta.setAttribute('content', bg);
}
