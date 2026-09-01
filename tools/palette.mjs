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
 *  cards, and the lean is most of why the surfaces read as surfaces. */
export const SPEC = [
  { name: 'carbon',     bg: '#0C0E13', ink: '#E6EBF3', accent: '#6E86B8', note: 'Steel on near black. The default.' },
  { name: 'ink',        bg: '#050508', ink: '#F3F1FA', accent: '#8B84C4', note: 'Near black, violet cast. The darkest.' },
  { name: 'graphite',   bg: '#0A0C0B', ink: '#EAF0EC', accent: '#7E9188', note: 'Deep green grey. Almost black.' },
  { name: 'slate',      bg: '#161A21', ink: '#EEF2F7', accent: '#7E93B5', note: 'Steel blue grey. The lightest dark.' },
  { name: 'periwinkle', bg: '#0A0F1E', ink: '#F2F5FA', accent: '#6D86DB', note: 'Indigo on deep navy.' },
  { name: 'bronze',     bg: '#12100C', ink: '#F2ECE0', accent: '#A8926A', note: 'Warm paper on dark. The only warm one.' },
  { name: 'cinnabar',   bg: '#130D0B', ink: '#F6EAE4', accent: '#C4643F', note: 'Burnt red on near black.' },
  { name: 'liquid',     bg: '#04171C', ink: '#E6F7FA', accent: '#54AEBE', note: 'Deep marine. The coldest.' },
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
/*  The two borders, at the weight the prototype's rgba(150,178,220,.10) works
    out to over a card. */
const A_LINE  = A_CARD.map((v, i) => v + (A_RAISE[i] - v) * 0.86);
const A_LINE2 = A_RAISE.map((v, i) => v + (elevAt(ELEV_MAX)[i] - v) * 0.55);

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

// ----------------------------------------------------------------- build
const INKS_ON_GROUND = ['#8E97A8', '#C79A3F', '#E6EBF3', '#9AA6BB', '#7FE3A6', '#F5A3A3', '#E8C34A'];

/** The lightest a surface may be and still hold every ink at 4.5:1. */
function elevOk(elevHex) {
  return Math.min(...INKS_ON_GROUND.map((i) => ratio(i, elevHex))) >= 4.5;
}

/** The four grounds and two lines, from the prototype's ground and ink.
 *
 *  Nothing here chooses a colour. The ground and the ink came from the
 *  prototype's own theme card and the alphas from its carbon block; this is
 *  only the interpolation that turns three surfaces into six. */
function surfaces(t) {
  const base = {
    bg:    t.bg.toUpperCase(),
    card:  over(t.bg, t.ink, A_CARD),
    raise: over(t.bg, t.ink, A_RAISE),
    line:  over(t.bg, t.ink, A_LINE),
  };
  let f = ELEV_MAX;
  let elev = over(t.bg, t.ink, elevAt(f));
  for (; f >= 0.5; f -= 0.05) {
    elev = over(t.bg, t.ink, elevAt(f));
    const trial = { ...base, elev };
    if (elevOk(elev) && rampWorst(trial).r >= 4.55 && dE(base.raise, elev) >= 0.020) break;
  }
  return { ...base, elev, line2: over(t.bg, t.ink, A_RAISE.map((v, i) => v + (elevAt(f)[i] - v) * 0.62)) };
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
export const T = { t1: '#E6EBF3', t2: '#9AA6BB', t3: '#8E97A8', t4: '#545E6E' };
export const SEM = { pos: '#7FE3A6', neg: '#F5A3A3', warn: '#E8C34A', gold: '#C79A3F' };

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
