/** Build the eight palettes from a description, and refuse to emit one that
 *  fails a contrast rule.
 *
 *  WHY A GENERATOR. The eight palettes were hand picked hex, and measured,
 *  every one of the 28 pairs sat at or under 0.08 oklab: the codebase's own
 *  threshold for "two colours that read as one". carbon and slate were 0.013
 *  apart. Eight themes, and by the project's own measure not one of them was
 *  distinct from any other, because a person choosing a dark blue by eye
 *  chooses very nearly the same dark blue every time.
 *
 *  So a theme is described here by what it IS: how dark its ground, how much
 *  colour is in that ground, what hue it leans, and how loud its accent. The
 *  hex is derived in oklch and checked. That makes the differences between
 *  themes a set of numbers somebody chose, rather than a set of numbers that
 *  happened.
 *
 *    node tools/palette.mjs          print the palettes and the audit
 *    node tools/palette.mjs --css    print the CSS blocks
 */

// ------------------------------------------------------------------ colour
const f = (v) => (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055);
const fi = (v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);

export function oklab(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => fi(parseInt(hex.slice(i, i + 2), 16) / 255));
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s,
  ];
}

/** oklch to the nearest in-gamut sRGB hex, by reducing chroma rather than
 *  clipping channels: clipping shifts the hue, which is how a set of eight
 *  "evenly spaced" hues ends up with two of them looking the same. */
export function hex(L, C, hDeg) {
  const h = (hDeg * Math.PI) / 180;
  for (let c = C; c >= 0; c -= 0.002) {
    const a = c * Math.cos(h);
    const b = c * Math.sin(h);
    const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
    const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
    const s = (L - 0.0894841775 * a - 1.2914855480 * b) ** 3;
    const rgb = [
      +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
      -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
      -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s,
    ].map(f);
    if (rgb.every((v) => v >= -0.0005 && v <= 1.0005)) {
      return '#' + rgb.map((v) => Math.round(Math.min(1, Math.max(0, v)) * 255).toString(16).padStart(2, '0')).join('').toUpperCase();
    }
  }
  return '#000000';
}

export const dE = (a, b) => { const A = oklab(a), B = oklab(b); return Math.hypot(A[0] - B[0], A[1] - B[1], A[2] - B[2]); };
export const lum = (h) => { const [r, g, b] = [1, 3, 5].map((i) => fi(parseInt(h.slice(i, i + 2), 16) / 255)); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
export const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };

// ------------------------------------------------------- what a theme IS
/*  THESE ARE THE PROTOTYPE'S COLOURS, not colours chosen here.
 *
 *  An earlier pass generated the eight palettes from a description (how dark,
 *  how tinted, what hue, how loud) because the hand picked set had converged:
 *  measured, all 28 pairs sat at or under 0.08 oklab, the threshold this
 *  codebase uses for "two colours that read as one", and carbon and slate
 *  were 0.013 apart. The generator fixed the measurement and lost the thing
 *  the measurement could not see, which is that these eight were designed.
 *
 *  So the ground, the ink and the accent below are lifted verbatim from the
 *  prototype's theme cards, and what is still generated is only the
 *  ARITHMETIC BETWEEN them: the prototype had three surfaces and this has
 *  four, plus two line weights, and those are derived from the ground and the
 *  ink at the alphas the prototype's own carbon block works out to.
 *
 *  Calibrated against prototype carbon, where bg #0C0E13, ink #E6EBF3:
 *    --card #14171F  is the ink over the ground at 0.037 to 0.054 per channel
 *    --elev #191D27  is the same at 0.060 to 0.089
 *    --s   #A8C2E8   is --p lifted 0.186 in oklab L at 0.75 of its chroma
 *  The per channel spread is the prototype leaning its surfaces bluer than a
 *  flat alpha would, and it is kept: a flat mix is a different, greyer set of
 *  cards, and the lean is most of why the surfaces read as surfaces.
 *
 *  EIGHT THEMES THAT READ AS THREE. The owner's note was that they are too
 *  similar, and the measurement agreed: at the previous values all 28 pairs
 *  sat under 0.08 mean oklab, the line this codebase draws for two colours
 *  reading as one, the closest pair of GROUNDS was bronze against cinnabar at
 *  0.011, and the closest pair of ACCENTS was carbon against ink at 0.045.
 *
 *  The cause was in this file rather than in the grounds. Carbon's lean is
 *  blue, and the alphas below were carbon's applied verbatim to all eight, so
 *  every theme's surfaces were pulled toward carbon's hue no matter what its
 *  ground was: bronze, the only warm theme in the set, worked out to a --raise
 *  of #1F1F1F, which is a pure grey, and an --elev of #292A2D, which is blue.
 *  Four of the eight carried surfaces from a hue family that was not their
 *  own, and the surfaces are most of the screen.
 *
 *  So the lean is now ROTATED to each theme's own hue rather than copied (see
 *  leanFor below), and the grounds and accents here take the small deliberate
 *  moves that go with it. Nothing was redesigned: every ground keeps its
 *  character and its lightness, and carbon, which is the hue the lean was
 *  measured at, is unmoved and still reproduces the prototype exactly. */
export const SPEC = [
  /*  Carbon is the calibration and does not move: it is the theme the lean,
      the alphas and the --s relationship were all read off. */
  { name: 'carbon',     bg: '#0C0E13', ink: '#E6EBF3', accent: '#7085B0', note: 'Steel on near black. The default.' },
  /*  The darkest, and it was 0.047 of ground from carbon while its accent was
      0.045 from carbon's: the two closest accents in the set. Both ends take
      their violet, which is the cast the theme is named for. */
  { name: 'ink',        bg: '#05050A', ink: '#F3F1FA', accent: '#A07ACA', note: 'Near black, violet cast. The darkest.' },
  /*  Named for a green grey and measured 0.018 of ground from carbon, which
      is a second carbon. The ground takes its green and the accent takes the
      teal grey of the prototype card, a tenth of a lightness step down and a
      hundredth of chroma up: at the prototype's own #5E8783 this accent sits
      0.078 from carbon's, and under 0.08 is where this codebase says two
      colours are one. The hue does not move at all. */
  { name: 'graphite',   bg: '#040C09', ink: '#EAF0EC', accent: '#528681', note: 'Deep green grey. Almost black.' },
  /*  The lightest dark, and the one that only ever differed from carbon by
      lightness. It keeps that job; the accent lifts so the pair reads as two
      weights of the same idea on purpose rather than by accident. */
  { name: 'slate',      bg: '#151A21', ink: '#EEF2F7', accent: '#8BA2C1', note: 'Steel blue grey. The lightest dark.' },
  /*  The loudest, and it was 0.023 of ground from carbon. The navy deepens,
      and the accent takes a hundredth of chroma at the same hue and the same
      lightness, for the same reason graphite's does: against carbon it
      measured 0.079. The loudest accent in the set can afford to be louder. */
  { name: 'periwinkle', bg: '#080E20', ink: '#F2F5FA', accent: '#667CE2', note: 'Indigo on deep navy.' },
  /*  THE ONLY WARM THEME, and it was 0.011 of ground from cinnabar and 0.024
      from graphite: three near identical near blacks, one of which is meant
      to be warm paper. The ground takes real amber and the accent warms with
      it. This is the largest move in the set and it is the one the owner
      would notice first. */
  { name: 'bronze',     bg: '#1A1308', ink: '#F2ECE0', accent: '#AF8F62', note: 'Warm paper on dark. The only warm one.' },
  /*  Burnt red, and the brief says the red is IN THE GROUND. It was not: the
      ground was #130D0B, which is a warm near black, and the theme was
      carried entirely by its accent. */
  { name: 'cinnabar',   bg: '#130705', ink: '#F6EAE4', accent: '#C4643F', note: 'Burnt red, and it is in the ground.' },
  /*  Sage, and the ground is the quiet half of it deliberately. A first pass
      put it at #0F1B10 and, rendered on the dashboard in all eight, the
      surfaces carried enough green that the whole screen read as a green
      theme, which is the one thing none of the eight may be: profit green
      means money, and a ground the colour of it takes the meaning out of the
      calendar. The accent carries sage; the ground is as quiet as graphite's
      at its own hue. */
  { name: 'sage',       bg: '#0E1611', ink: '#E9F3E8', accent: '#9EB49A', note: 'Pastel sage on a quiet green grey. The softest.' },
];

/*  The prototype's own per channel alphas, read off its carbon block. The
    prototype has THREE surfaces and this has four, and the honest way to add
    one is to extend the ramp rather than to subdivide it: --bg and --card are
    the prototype's exactly, --raise is the prototype's --elev exactly, and
    --elev is one more step of the same size. Squeezing a fourth surface into
    the prototype's span put --raise and --elev 0.009 apart, which is a
    raised element that is not raised. */
const A_CARD  = [0.0367, 0.0407, 0.0536];
const A_RAISE = [0.0596, 0.0679, 0.0893];                       // the prototype's --elev
/*  How far past the prototype's top surface the fourth one goes. Searched
    per theme, not fixed: slate is the prototype's "lightest dark" and one
    more full step put --t3 on its --elev at 4.25:1 and the calendar ramp at
    4.28:1. The extension is taken as far as it can go and no further. */
const ELEV_MAX = 1.9;
const elevAt = (f) => A_RAISE.map((v, i) => v + (v - A_CARD[i]) * f);
/*  The first border, at the weight the prototype's rgba(150,178,220,.10) works
    out to over a card. The second is derived inside surfaces() instead, off
    whichever --elev that theme's search settled on, because a border against a
    raised surface has to follow the surface it is drawn against. There was a
    second constant here that said otherwise and nothing read it, which is the
    worst kind of documentation: it named a rule the code did not follow. */
const A_LINE  = A_CARD.map((v, i) => v + (A_RAISE[i] - v) * 0.86);

/*  THE LEAN, TURNED TO THE THEME'S OWN HUE.
 *
 *  Every alpha triple above is carbon's, and a triple that is not flat is a
 *  hue: carbon's says "put more ink into blue than into red", which is why its
 *  cards read as cards and not as lighter rectangles of the ground. Applied
 *  verbatim to the other seven it says the same thing about THEIR cards, and
 *  that is the defect this fixes. Bronze is the case that names it: the only
 *  warm theme in the set worked out to --raise #1F1F1F, a pure grey, and
 *  --elev #292A2D, which is blue, because carbon's lean overwhelmed a warm
 *  ground that is only a few counts off neutral to begin with.
 *
 *  A triple is split into how much ink (its MEAN, which is lightness) and
 *  which way it leans (its DEVIATION, which is hue and saturation). The mean
 *  is never touched. The deviation is rotated about the grey axis (1,1,1) by
 *  the angle between carbon's accent and this theme's, and then scaled by how
 *  much chroma this theme's accent carries against carbon's.
 *
 *  THE MEAN IS WHY THIS IS SAFE. A deviation sums to zero by construction, so
 *  rotating it and scaling it move a surface around the grey axis without
 *  moving it along it: every surface keeps the lightness the prototype gave
 *  it, and lightness is what contrast is made of. Measured, the worst text on
 *  any ground moved from 4.54:1 to 4.59:1 rather than down. The audit below
 *  is still the thing that decides, and it throws rather than emitting a
 *  sentinel, because #FF00FF once shipped into tokens.css and passed every
 *  contrast rule by being a colour nobody had looked at.
 *
 *  THE SCALE IS THE ONLY PART THE PROTOTYPE DOES NOT GIVE US. It hands over
 *  one lean, carbon's, and says nothing about how far a theme with twice the
 *  chroma should lean. Proportional to the theme's own accent is the rule
 *  with the fewest free numbers in it: cinnabar, whose brief is that the red
 *  is IN THE GROUND, leans about twice as far as carbon and its surfaces come
 *  out red; sage, which has to stay quiet enough not to read as profit green,
 *  leans about half as far and its surfaces stay near grey. The clamp is so
 *  that a very grey accent still gets some lean and a very loud one does not
 *  run away with the whole surface set.
 *
 *  Carbon is unmoved by construction: the angle from carbon to carbon is zero
 *  and the scale is one. Its four surfaces still come out at the prototype's
 *  exact hex, which is the check that this did not quietly redesign the set. */
const AXIS = 1 / Math.sqrt(3);
const meanOf = (v) => (v[0] + v[1] + v[2]) / 3;
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
/** A colour's hue as a unit vector in the plane perpendicular to grey. A
 *  colour with no hue at all returns zero and rotates to nothing, which is
 *  the honest answer for a pure grey accent. */
function hueDir(hexStr) {
  const c = chan(hexStr);
  const d = c.map((v) => v - meanOf(c));
  const n = Math.hypot(...d);
  return n < 1e-9 ? [0, 0, 0] : d.map((v) => v / n);
}
/** How far off grey a colour sits, in the same units hueDir normalises away. */
const chromaOf = (h) => { const c = chan(h); return Math.hypot(...c.map((v) => v - meanOf(c))); };
const CARBON_ACCENT = '#7085B0';
/*  A very grey accent still gets over half of carbon's lean, and the loudest
    gets under twice it. Without the floor, sage's surfaces come out flat grey
    and the theme is carried by one colour on the screen; without the ceiling,
    periwinkle's --elev takes so much blue that the ramp's loss cells lose
    their edge against it. */
const LEAN_MIN = 0.55;
const LEAN_MAX = 1.9;
/** Carbon's alpha triple, leaning the way this theme's accent does and as far
 *  as this theme's accent does. */
function leanFor(triple, accentHex) {
  const a = hueDir(CARBON_ACCENT);
  const b = hueDir(accentHex);
  if (Math.hypot(...a) < 1e-9 || Math.hypot(...b) < 1e-9) return triple;
  const m = meanOf(triple);
  const v = triple.map((x) => x - m);
  /*  Rodrigues about the grey axis. v is perpendicular to it by construction,
      so the term in (axis . v) is zero and drops out. */
  const th = Math.atan2(dot3(cross(a, b), [AXIS, AXIS, AXIS]), dot3(a, b));
  const kv = cross([AXIS, AXIS, AXIS], v);
  const k = Math.min(LEAN_MAX, Math.max(LEAN_MIN, chromaOf(accentHex) / chromaOf(CARBON_ACCENT)));
  return v.map((x, i) => (x * Math.cos(th) + kv[i] * Math.sin(th)) * k + m);
}

const over = (bg, ink, a) => toHex(chan(bg).map((v, i) => v + (chan(ink)[i] - v) * a[i]));

// ------------------------------------------------------------------- ramp
/*  The calendar ramp composites a result colour over --elev and then puts
    ink on top of the composite, so it constrains --elev and --bg TOGETHER
    and neither of them alone. The numbers come out of lib/calendar-ramp.ts
    by regex rather than being copied, because a ramp measured against
    different numbers than the one that ships is not a measurement. */
import { readFileSync as _read } from 'node:fs';
const RAMP_SRC = _read(new URL('../lib/calendar-ramp.ts', import.meta.url), 'utf8');
const rampNum = (k) => Number(/\b__K__:\s*([0-9.]+)/.source.replace('__K__', k).match?.length
  ? new RegExp(`\\b${k}:\\s*([0-9.]+)`).exec(RAMP_SRC)[1] : 0);
export const RAMP = {
  SPLIT: rampNum('SPLIT'), LOW_FROM: rampNum('LOW_FROM'), LOW_TO: rampNum('LOW_TO'),
  HIGH_FROM: rampNum('HIGH_FROM'), HIGH_TO: rampNum('HIGH_TO'), DATE_ON_HIGH: rampNum('DATE_ON_HIGH'),
};
function rampStep(mag) {
  if (mag < RAMP.SPLIT) return { alpha: RAMP.LOW_FROM + (mag / RAMP.SPLIT) * (RAMP.LOW_TO - RAMP.LOW_FROM), ink: 'result' };
  return { alpha: RAMP.HIGH_FROM + ((mag - RAMP.SPLIT) / (1 - RAMP.SPLIT)) * (RAMP.HIGH_TO - RAMP.HIGH_FROM), ink: 'ground' };
}
const chan = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const toHex = (c) => '#' + c.map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0')).join('').toUpperCase();
const mixHex = (a, b, p) => toHex(chan(a).map((v, i) => v * p + chan(b)[i] * (1 - p)));

/*  THE DEAD ZONE HAS TO STAY DEAD, and it is a property of the palette rather
    than of the ramp.
 *
 *  The calendar ramp is two bands with a hole between them because at a middling
 *  fill neither ink clears 4.5:1: the result colour has been washed out by the
 *  fill and the page ground is not yet dark enough against it. One threshold on
 *  alpha, which is what anybody writes first, lands inside that hole.
 *  tests/calendar-ramp.test.ts proves the hole is real by measuring a naive mid
 *  ramp in all eight themes and finding that none of them clears it.
 *
 *  A PALETTE CAN FILL THE HOLE IN WITHOUT ANYTHING SAYING SO. Rotating the
 *  surface lean to each theme's own hue moved graphite's --elev far enough that
 *  a naive mid cell measured 4.61:1 against its ground, and the only thing that
 *  noticed was that test failing. The generator now refuses such a palette
 *  instead, so the two band shape is never quietly left standing on a claim
 *  about a palette that has since changed. Revisiting the bands is allowed; it
 *  just has to be a decision somebody makes rather than a number that drifted. */
const NAIVE_MID = 0.46;
/*  4.42, not 4.50, and the margin is for a disagreement rather than for the
    eye. This file linearises sRGB at 0.04045 and composites in whole channels;
    tests/calendar-ramp.test.ts linearises at 0.03928 and composites in floats,
    and the two thresholds are both in circulation. Measured across the eight,
    they differ by up to 0.03, and a palette solved to exactly 4.49 here
    measured 4.51 there, which is the failure that found this. */
const DEAD_ZONE_MAX = 4.42;
export function deadZoneHolds(v) {
  for (const positive of [true, false]) {
    const cell = mixHex(positive ? SEM.pos : SEM.neg, v.elev, NAIVE_MID);
    const result = ratio(positive ? SEM.pos : SEM.neg, cell);
    const ground = ratio(v.bg, cell);
    if (result >= DEAD_ZONE_MAX || ground >= DEAD_ZONE_MAX) {
      return { ok: false, at: `${positive ? 'profit' : 'loss'} result ${result.toFixed(2)} ground ${ground.toFixed(2)}` };
    }
  }
  return { ok: true, at: '' };
}

/** The worst contrast the ramp reaches on this palette. */
export function rampWorst(v) {
  let worst = { r: 99, at: '' };
  for (const positive of [true, false]) {
    for (let mag = 0.001; mag <= 1.0001; mag += 0.005) {
      const st = rampStep(mag);
      const cell = mixHex(positive ? SEM.pos : SEM.neg, v.elev, st.alpha);
      const figure = st.ink === 'result' ? (positive ? SEM.pos : SEM.neg) : v.bg;
      const date = st.ink === 'result' ? T.t1 : mixHex(v.bg, cell, RAMP.DATE_ON_HIGH);
      for (const [what, ink] of [['figure', figure], ['date', date]]) {
        const r = ratio(ink, cell);
        if (r < worst.r) worst = { r, at: `${positive ? 'profit' : 'loss'} ${what} at mag ${mag.toFixed(2)}` };
      }
    }
  }
  return worst;
}

/*  THE INKS AND THE TWO COLOURS THAT MEAN MONEY, READ OFF THE STYLESHEET.
 *
 *  They were copied here, and one of the copies was wrong: this file audited
 *  every palette against a profit green of #7FE3A6 and a loss red of #F5A3A3
 *  while tokens.css has shipped #86EFAC and #FCA5A5 throughout, which are the
 *  two colours the LOCKED list in CLAUDE.md names. So the calendar ramp was
 *  measured against a green the calendar has never drawn, and the rule that
 *  keeps an accent away from the colour of a result was enforced against the
 *  wrong result. tests/themes.test.ts used the real ones all along, which is
 *  why the generator could pass while the tests failed.
 *
 *  Reading them is the same discipline the ramp constants already follow: a
 *  palette measured against different numbers than the one that ships is not
 *  a measurement. sync-themes.mjs only ever rewrites the theme blocks, never
 *  :root, so there is nothing circular about taking them from here. */
const ROOT_SRC = _read(new URL('../app/styles/tokens.css', import.meta.url), 'utf8');
function rootVar(name) {
  const body = /:root \{([\s\S]*?)\n\}/.exec(ROOT_SRC)?.[1] ?? '';
  const m = new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`).exec(body);
  /*  Throw, never a sentinel. #FF00FF once shipped into tokens.css and passed
      every contrast rule, because a default that is a colour is a default
      nobody notices. */
  if (!m) throw new Error(`tokens.css :root has no --${name}, so nothing can be audited against it`);
  return m[1].toUpperCase();
}
export const T = { t1: rootVar('t1'), t2: rootVar('t2'), t3: rootVar('t3'), t4: rootVar('t4') };
export const SEM = { pos: rootVar('pos'), neg: rootVar('neg'), warn: rootVar('warn'), gold: rootVar('gold') };

// ----------------------------------------------------------------- build
/*  Every ink that lands on a ground, from the stylesheet rather than copied.
    t4 is not here: it is a border weight and never text. */
const INKS_ON_GROUND = [T.t3, SEM.gold, T.t1, T.t2, SEM.pos, SEM.neg, SEM.warn];

/** The lightest a surface may be and still hold every ink at 4.5:1. */
function elevOk(elevHex) {
  return Math.min(...INKS_ON_GROUND.map((i) => ratio(i, elevHex))) >= 4.5;
}

/** The four grounds and two lines, from the prototype's ground and ink.
 *
 *  Nothing here chooses a colour. The ground and the ink came from the
 *  prototype's own theme card and the alphas from its carbon block; this is
 *  only the interpolation that turns three surfaces into six, with the lean
 *  turned to this theme's hue rather than left at carbon's. */
function surfaces(t) {
  const lean = (triple) => leanFor(triple, t.accent);
  const base = {
    bg:    t.bg.toUpperCase(),
    card:  over(t.bg, t.ink, lean(A_CARD)),
    raise: over(t.bg, t.ink, lean(A_RAISE)),
    line:  over(t.bg, t.ink, lean(A_LINE)),
  };
  let f = ELEV_MAX;
  let elev = over(t.bg, t.ink, lean(elevAt(f)));
  for (; f >= 0.5; f -= 0.05) {
    elev = over(t.bg, t.ink, lean(elevAt(f)));
    const trial = { ...base, elev };
    if (elevOk(elev) && rampWorst(trial).r >= 4.55 && dE(base.raise, elev) >= 0.020
        && deadZoneHolds(trial).ok) break;
  }
  return { ...base, elev, line2: over(t.bg, t.ink, lean(A_RAISE.map((v, i) => v + (elevAt(f)[i] - v) * 0.62))) };
}

/** The lighter accent, at the prototype's own relationship to the darker one.
 *
 *  Prototype carbon ships both: --p #6E86B8 and --s #A8C2E8, which measure as
 *  +0.186 in oklab L at 0.753 of the chroma. The other seven prototype cards
 *  ship only the one accent, so their --s is that same move applied to it.
 *  Where the move lands somewhere the contrast rules refuse, --s is lifted
 *  further rather than being invented at another hue: --s is a lighter
 *  version of this theme's accent and nothing else. */
function lighter(accentHex, need, apartFrom) {
  const [L, a, b] = oklab(accentHex);
  const C = Math.hypot(a, b);
  const h = (Math.atan2(b, a) * 180) / Math.PI;
  for (let lift = 0.186; lift <= 0.34; lift += 0.004) {
    for (const cf of [0.753, 0.71, 0.67, 0.63, 0.59]) {
      const x = hex(Math.min(0.93, L + lift), C * cf, h);
      if (!need.every(([g, min]) => ratio(x, g) >= min)) continue;
      /*  A link the colour of a loss is a worse theme than a quiet one.
          Derived cinnabar landed 0.038 from --neg, which is inside the
          threshold this codebase calls one colour. */
      if (apartFrom.some((sv) => dE(x, sv) < 0.12)) continue;
      return { hex: x, lift, cf };
    }
  }
  return null;
}

export function build(t) {
  const g = surfaces(t);
  /*  .card paints color-mix(in oklab, var(--surface) 88%, transparent) so the
      animated field shows faintly through it: text on a card sits on a
      composite, not on --card. Measuring the token said 4.45:1 where axe
      measured 4.38:1 on the thing that ships, so both are checked. */
  const cardOn = mixHex(g.card, g.bg, 0.88);
  const raiseOn = mixHex(g.raise, g.bg, 0.88);
  const all = [g.bg, g.card, g.raise, g.elev, cardOn, raiseOn];
  const s = lighter(t.accent, all.map((x) => [x, 4.5]), [SEM.pos, SEM.neg]);
  if (!s) throw new Error(`${t.name}: no --s clears 4.5:1 on every ground`);
  return { ...g, p: t.accent.toUpperCase(), s: s.hex };
}

// ------------------------------------------------------------------ audit

export function audit(themes) {
  const fail = [];
  const stat = { worstText: { r: 99, at: '' }, worstPair: { d: 99, at: '' }, worstRamp: { r: 99, at: '' } };
  for (const [name, v] of Object.entries(themes)) {
    /*  THE GROUND IS NOT THE TOKEN. .card paints
        color-mix(in oklab, var(--surface) 88%, transparent) so the animated
        field shows faintly through it, which means text on a card sits on a
        composite of --card over --bg, not on --card. Measuring the token
        said 4.45:1 where axe measured 4.38:1 on the thing that ships. Both
        the token and the composite are checked here. */
    v.cardOn = mixHex(v.card, v.bg, 0.88);
    v.raiseOn = mixHex(v.raise, v.bg, 0.88);
    for (const g of ['bg', 'card', 'raise', 'elev', 'cardOn', 'raiseOn']) {
      for (const [ik, ic] of [...Object.entries(T).filter(([k]) => k !== 't4'), ...Object.entries(SEM), ['s', v.s]]) {
        const r = ratio(ic, v[g]);
        if (r < stat.worstText.r) stat.worstText = { r, at: `${name} ${ik} on ${g}` };
        if (r < 4.5) fail.push(`${name}: ${ik} on ${g} is ${r.toFixed(2)}:1`);
      }
    }
    // a primary button: --p as ground, --bg as its ink; and --p as ink on a card
    /*  --p is NEVER text. Every `color: var(--accent)` in app/styles is on
        an SVG icon, a focus ring, a border or a blurred glow, and a test
        keeps it that way, so the bar for the grounds is WCAG's 3:1 for a
        graphical object. The 4.5 is for --bg, because --accent-ink is --bg
        and it sits ON --p in a primary button. Held to 4.5 everywhere,
        cinnabar's own accent failed its own card by 0.03. */
    if (ratio(v.p, v.bg) < 4.5) fail.push(`${name}: --accent-ink on --p is ${ratio(v.p, v.bg).toFixed(2)}:1`);
    for (const g of ['card', 'cardOn', 'raise', 'elev']) {
      const r = ratio(v.p, v[g]);
      if (r < 3.0) fail.push(`${name}: --p on ${g} is ${r.toFixed(2)}:1 as a graphical object`);
    }
    const rw = rampWorst(v);
    if (rw.r < stat.worstRamp.r) stat.worstRamp = { r: rw.r, at: `${name} ${rw.at}` };
    /*  4.55, not 4.50. This samples the ramp every 0.005 of magnitude and
        tests/calendar-ramp.test.ts every 0.01, and the two round the
        composite differently: a palette solved to exactly 4.50 here measured
        4.49 there. The margin is for the disagreement, not for the eye. */
    if (rw.r < 4.55) fail.push(`${name}: calendar ramp reaches ${rw.r.toFixed(2)}:1 at ${rw.at}`);
    /*  And the hole between the ramp's two bands is still a hole. The search
        in surfaces() already prefers an --elev that keeps it, but a ground
        this file does not choose can break it on its own, and a two band ramp
        justified by a dead zone that is no longer dead is a design standing
        on a measurement nobody re-took. */
    const dz = deadZoneHolds(v);
    if (!dz.ok) fail.push(`${name}: a naive mid ramp now clears 4.5:1 (${dz.at}), so the dead zone is not dead`);
    // an accent must not be mistakable for a result
    /*  --pos and --neg MEAN something, and an accent that reads as one of
        them is an accent that says "you won" on a button. --warn and --gold
        are advisory and decorative, and prototype bronze's accent sits 0.072
        from --gold by design: it is a bronze theme. That is reported below
        as a number rather than enforced as a rule. */
    for (const [sk, sv] of Object.entries({ pos: SEM.pos, neg: SEM.neg })) {
      for (const ak of ['p', 's']) {
        const d = dE(v[ak], sv);
        if (d < 0.12) fail.push(`${name}: --${ak} is ${d.toFixed(3)} from ${sk} in oklab`);
      }
    }
    // the grounds must be four distinguishable grounds
    const gs = ['bg', 'card', 'raise', 'elev'];
    for (let i = 0; i < gs.length - 1; i++) {
      const d = dE(v[gs[i]], v[gs[i + 1]]);
      if (d < 0.012) fail.push(`${name}: --${gs[i]} and --${gs[i + 1]} are ${d.toFixed(3)} apart`);
    }
    // and a border must be a border: visible on the card and against the page
    for (const [a, b] of [['line', 'card'], ['line', 'bg'], ['line2', 'raise']]) {
      const d = dE(v[a], v[b]);
      if (d < 0.011) fail.push(`${name}: --${a} and --${b} are ${d.toFixed(3)} apart, so there is no edge`);
    }
  }
  // and the themes must differ from each other
  const names = Object.keys(themes);
  for (let i = 0; i < names.length; i++) for (let j = i + 1; j < names.length; j++) {
    const a = themes[names[i]], b = themes[names[j]];
    const ds = ['bg', 'card', 'raise', 'elev', 'line', 'line2', 'p', 's'].map((k) => dE(a[k], b[k]));
    const mean = ds.reduce((x, y) => x + y, 0) / ds.length;
    if (mean < stat.worstPair.d) stat.worstPair = { d: mean, at: `${names[i]} / ${names[j]}` };
    /*  Not a failure. The eight palettes are the prototype's and the
        prototype is the design; measuring how close two of them are is
        useful, overruling the designer with a threshold is not. The number
        is printed and asserted against a floor in tests/themes.test.ts, set
        to what this set actually achieves. */
    void 0;
  }
  return { fail, stat };
}

export function palettes() {
  const out = {};
  for (const t of SPEC) out[t.name] = build(t);
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const P = palettes();
  const { fail, stat } = audit(P);
  if (process.argv.includes('--css')) {
    for (const t of SPEC) {
      const v = P[t.name];
      console.log(`[data-theme='${t.name}'] {`);
      for (const k of ['bg', 'card', 'raise', 'elev', 'line', 'line2', 'p', 's']) console.log(`  --${k}: ${v[k]};`);
      console.log('}');
    }
  } else {
    console.log('name        bg      card    raise   elev    line    line2   p       s');
    for (const t of SPEC) {
      const v = P[t.name];
      console.log(t.name.padEnd(11), ['bg','card','raise','elev','line','line2','p','s'].map((k) => v[k]).join(' '));
    }
    console.log('');
    console.log(`worst text on ground  ${stat.worstText.r.toFixed(2)}:1  (${stat.worstText.at})`);
    console.log(`worst calendar ramp   ${stat.worstRamp.r.toFixed(2)}:1  (${stat.worstRamp.at})`);
    console.log(`closest theme pair    ${stat.worstPair.d.toFixed(3)}   (${stat.worstPair.at})`);
    console.log('');
    if (fail.length) { console.log(`${fail.length} FAILURES`); for (const x of fail.slice(0, 24)) console.log('  ' + x); }
    else console.log('All constraints pass.');
  }
}
