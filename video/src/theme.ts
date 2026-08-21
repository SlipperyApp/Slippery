/* Carbon, copied from the one place it is defined.
 *
 * A video cannot read a custom property, so these are literals. They are
 * copied from `[data-t=carbon]` in app/proto.css and a test in the site's
 * suite fails if the two ever part, which is the only way a hardcoded
 * palette stays honest. */
export const C = {
  pos: '#7FE3A6',
  neg: '#F5A3A3',
  a: '#EEBB63',
  bg: '#0C0E13',
  p: '#6E86B8',
  s: '#A8C2E8',
  card: '#14171F',
  line: 'rgba(150,178,220,.10)',
  t1: '#E6EBF3',
  t2: '#9AA6BB',
  t3: '#7A8598',
  t4: '#545E6E',
  elev: '#191D27',
  lg1: '#6E86B8',
  lg2: '#A8C2E8',
} as const;

/* The same three faces the site uses. Loaded from Google in the render, which
   happens on a build machine rather than in anybody's browser. */
export const F = {
  serif: '"Source Serif 4", Georgia, serif',
  ui: '"Schibsted Grotesk", system-ui, sans-serif',
  mono: '"Geist Mono", ui-monospace, monospace',
} as const;

export const FPS = 30;
/* Twenty four seconds: long enough for the four beats, short enough that
   somebody watches to the end. */
export const DURATION = 24 * FPS;
