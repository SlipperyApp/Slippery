'use client';

import { useEffect, useRef } from 'react';
import { useTheme } from '@/components/ThemeProvider';

/** The moving ground behind the hero.
 *
 *  A field of horizontal polylines, each displaced by three sine terms
 *  running at different speeds. Where the lines bunch they read as a bright
 *  ribbon and where they spread they read as haze, so a few hundred cheap
 *  strokes give the impression of something folding. No blur filter, no
 *  gradient mesh, no per-pixel work: a live filter: blur() on a full width
 *  canvas costs more than every other thing on this page put together.
 *
 *  RULES IT KEEPS
 *    - It is drawn in --accent, so it belongs to whichever of the eight
 *      themes you are on rather than being a purple import.
 *    - It is erased entirely from the part of the hero the words are in,
 *      in screen space, after drawing. The copy on top has to stay at 4.5:1
 *      and a hairline through a paragraph is a contrast defect.
 *    - prefers-reduced-motion draws ONE frame and stops. Not slower: stopped.
 *    - It stops when the tab is hidden and when it scrolls off screen, which
 *      is most of the time somebody is on this page.
 *    - It is aria-hidden and pointer-events: none. It is a texture. */

const REDUCED = '(prefers-reduced-motion: reduce)';

export function WaveField() {
  const ref = useRef<HTMLCanvasElement>(null);
  const { theme } = useTheme();

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const reduce = window.matchMedia(REDUCED).matches;

    // The accent, resolved once per theme. getComputedStyle in the draw loop
    // is a forced style recalculation sixty times a second.
    const accent = getComputedStyle(document.documentElement)
      .getPropertyValue('--accent').trim() || '#D9D4C7';
    const [ar, ag, ab] = parseColour(accent);

    let w = 0;
    let h = 0;
    let dpr = 1;
    let lines = 56;
    let steps = 96;

    const size = () => {
      const r = canvas.getBoundingClientRect();
      // Two is as much device pixel ratio as this is worth; three on a modern
      // phone is nine times the fill for no visible gain.
      dpr = Math.min(2, window.devicePixelRatio || 1);
      w = Math.max(1, Math.round(r.width));
      h = Math.max(1, Math.round(r.height));
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const small = w < 720;
      lines = small ? 34 : 56;
      steps = small ? 56 : 96;
    };

    /** One frame. t is seconds. */
    const draw = (t: number) => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      //  The whole field is tilted. Horizontal lines read as a chart; tilted
      //  ones read as cloth. Drawn oversize so the rotation does not leave
      //  the corners bare.
      const tilt = -0.16;
      ctx.translate(w / 2, h / 2);
      ctx.rotate(tilt);
      ctx.translate(-w / 2, -h / 2);
      const over = 0.34;
      const x0 = -w * over;
      const x1 = w * (1 + over);
      const span = x1 - x0;

      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      //  The bright core drifts up and down over about ninety seconds, so
      //  the ribbon is never in the same place twice in a sitting.
      const core = 0.62 + Math.sin(t * 0.068) * 0.15;

      /*  THE BODY, drawn first and filled.
       *
       *  Hairlines on their own read as wire. What makes the reference look
       *  like silk is that the bright part is a SHAPE with soft edges, not a
       *  bundle of strokes. So four bands are filled between two wavy edges,
       *  each with a vertical gradient that is brightest in its middle and
       *  transparent at both edges, and the hairlines go on top for detail.
       *  Four filled paths a frame; still no blur filter. */
      const wave = (p: number, u: number, amp: number, base: number) => base
        + Math.sin(p * 3.1 + t * 0.21 + u * 3.6) * amp
        + Math.sin(p * 5.9 - t * 0.15 + u * 6.2) * amp * 0.42
        + Math.sin(p * 1.4 + t * 0.33 - u * 2.1) * amp * 0.66;

      const bandTop = -h * 0.25;
      const bandH = h * 1.6;

      for (let bIdx = 0; bIdx < 4; bIdx++) {
        const u0 = core + (bIdx - 2) * 0.075;
        const u1 = u0 + 0.075;
        if (u1 < -0.1 || u0 > 1.1) continue;

        const amp0 = h * 0.15 * (0.35 + 1);
        ctx.beginPath();
        for (let sIdx = 0; sIdx <= steps; sIdx++) {
          const x = x0 + (sIdx / steps) * span;
          const y = wave((x - x0) / span, u0, amp0, bandTop + u0 * bandH);
          if (sIdx === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        for (let sIdx = steps; sIdx >= 0; sIdx--) {
          const x = x0 + (sIdx / steps) * span;
          ctx.lineTo(x, wave((x - x0) / span, u1, amp0, bandTop + u1 * bandH));
        }
        ctx.closePath();

        //  Brightest in the middle band, fading out over the two on either
        //  side, and along the length the same way the hairlines do.
        const near = 1 - Math.abs(bIdx - 1.5) / 2.2;
        const g2 = ctx.createLinearGradient(x0, 0, x1, 0);
        const a2 = 0.052 * near;
        g2.addColorStop(0, `rgba(${ar},${ag},${ab},0)`);
        g2.addColorStop(0.45, `rgba(${ar},${ag},${ab},${(a2 * 0.5).toFixed(4)})`);
        g2.addColorStop(0.82, `rgba(${ar},${ag},${ab},${a2.toFixed(4)})`);
        g2.addColorStop(1, `rgba(${ar},${ag},${ab},0)`);
        ctx.fillStyle = g2;
        ctx.fill();
      }

      for (let i = 0; i < lines; i++) {
        const u = i / (lines - 1);

        //  Evenly spaced lines read as a comb no matter how they wave. A slow
        //  sine on the SPACING makes them converge in places and open up in
        //  others, and the bunched places are what the eye reads as a fold.
        const bunch = Math.sin(u * 5.4 + t * 0.047) * 0.055
          + Math.sin(u * 11.3 - t * 0.031) * 0.022;
        const baseY = bandTop + (u + bunch) * bandH;

        //  A narrow band is bright and the rest falls away fast. This is what
        //  makes it a ribbon rather than a grid: exponent 2.2 on the distance
        //  puts most of the light in about a fifth of the field.
        const d = Math.abs(u - core) / 0.34;
        const env = Math.max(0, 1 - Math.min(1, d) ** 2.2);
        if (env <= 0.004) continue;

        const amp = h * 0.15 * (0.35 + env);

        ctx.beginPath();
        for (let sIdx = 0; sIdx <= steps; sIdx++) {
          const x = x0 + (sIdx / steps) * span;
          const p = (x - x0) / span;

          //  Three terms, deliberately non harmonic. Harmonically related
          //  frequencies re-align every few seconds and the whole field
          //  pulses in time, which looks mechanical.
          const y = baseY
            + Math.sin(p * 3.1 + t * 0.21 + u * 3.6) * amp
            + Math.sin(p * 5.9 - t * 0.15 + u * 6.2) * amp * 0.42
            + Math.sin(p * 1.4 + t * 0.33 - u * 2.1) * amp * 0.66;

          if (sIdx === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }

        //  Brightest at the core of the band and towards the right, which is
        //  where the copy is not. The left third is where the headline sits,
        //  and a line under a headline is a contrast problem.
        const a = 0.66 * env;

        ctx.lineWidth = 0.7 + env * 0.8;
        const g = ctx.createLinearGradient(x0, 0, x1, 0);
        g.addColorStop(0, `rgba(${ar},${ag},${ab},0)`);
        g.addColorStop(0.3, `rgba(${ar},${ag},${ab},${(a * 0.18).toFixed(4)})`);
        g.addColorStop(0.62, `rgba(${ar},${ag},${ab},${(a * 0.7).toFixed(4)})`);
        g.addColorStop(0.86, `rgba(${ar},${ag},${ab},${a.toFixed(4)})`);
        g.addColorStop(1, `rgba(${ar},${ag},${ab},0)`);
        ctx.strokeStyle = g;
        ctx.stroke();
      }

      //  THE KEEP-OUT, and the reason the gradient above is not enough on its
      //  own: the field is rotated, so "left" inside that gradient is not the
      //  left of the screen and the copy ends up with lines through it.
      //
      //  It is an ellipse over the words rather than a column, because a
      //  column also erases the empty space BELOW the words, which is exactly
      //  where there is room for the ribbon to show. Soft edged, so nothing
      //  has a visible boundary.
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.globalCompositeOperation = 'destination-out';
      const wide = w >= 900;
      ctx.translate(w * (wide ? 0.30 : 0.5), h * (wide ? 0.40 : 0.30));
      ctx.scale(1, wide ? 0.80 : 1.15);
      const rad = wide ? w * 0.44 : w * 0.92;
      const keep = ctx.createRadialGradient(0, 0, rad * 0.42, 0, 0, rad);
      keep.addColorStop(0, 'rgba(0,0,0,1)');
      keep.addColorStop(0.7, 'rgba(0,0,0,0.55)');
      keep.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = keep;
      ctx.fillRect(-w * 2, -h * 2, w * 4, h * 4);
      ctx.globalCompositeOperation = 'source-over';
    };

    let raf = 0;
    let start = 0;
    let running = false;

    const frame = (ms: number) => {
      if (!start) start = ms;
      draw((ms - start) / 1000);
      raf = requestAnimationFrame(frame);
    };

    const play = () => {
      if (running || reduce) return;
      running = true;
      raf = requestAnimationFrame(frame);
    };
    const stop = () => {
      running = false;
      cancelAnimationFrame(raf);
    };

    size();
    draw(0);
    canvas.dataset.ready = '1';

    if (reduce) return () => { /* one frame, and nothing to tear down */ };

    // Off screen and hidden tabs do not get frames. Somebody reading the
    // pricing section is not looking at this.
    const io = new IntersectionObserver(
      ([e]) => (e.isIntersecting ? play() : stop()),
      { threshold: 0 },
    );
    io.observe(canvas);

    const onVis = () => (document.hidden ? stop() : play());
    document.addEventListener('visibilitychange', onVis);

    const ro = new ResizeObserver(() => { size(); if (!running) draw(0); });
    ro.observe(canvas);

    return () => {
      stop();
      io.disconnect();
      ro.disconnect();
      document.removeEventListener('visibilitychange', onVis);
    };
    // The accent is read at mount, so a theme change has to remount the loop.
  }, [theme]);

  return <canvas ref={ref} className="wavefield" aria-hidden="true" />;
}

/** #rgb, #rrggbb or rgb(). Anything else falls back to bone, because a
 *  background that throws is worse than a background that is the wrong
 *  colour. */
function parseColour(v: string): [number, number, number] {
  const hex = v.replace('#', '');
  if (/^[0-9a-f]{6}$/i.test(hex)) {
    return [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];
  }
  if (/^[0-9a-f]{3}$/i.test(hex)) {
    return [0, 1, 2].map((i) => parseInt(hex[i] + hex[i], 16)) as [number, number, number];
  }
  const m = v.match(/(\d+)[,\s]+(\d+)[,\s]+(\d+)/);
  if (m) return [Number(m[1]), Number(m[2]), Number(m[3])];
  return [217, 212, 199];
}
