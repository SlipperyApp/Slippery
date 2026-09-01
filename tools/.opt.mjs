/* Hill-climb the SPEC to maximise the worst pairwise distance, subject to
   every contrast rule and to each theme staying recognisably itself. */
import { build, audit, dE, SPEC } from './palette.mjs';

const K = ['bg','card','raise','elev','line','line2','p','s'];
// name -> [hue range, ground range, tint range, step range, accent range]
const BOUND = {
  carbon:     { hue: [254, 266], ground: [0.110, 0.200], tint: [0.008, 0.020], step: [0.030, 0.044], accent: [0.075, 0.115] },
  ink:        { hue: [280, 292], ground: [0.060, 0.095], tint: [0.004, 0.016], step: [0.040, 0.056], accent: [0.100, 0.140] },
  graphite:   { hue: [256, 268], ground: [0.190, 0.240], tint: [0.000, 0.004], step: [0.026, 0.038], accent: [0.018, 0.030] },
  slate:      { hue: [226, 236], ground: [0.150, 0.240], tint: [0.026, 0.048], step: [0.024, 0.034], accent: [0.045, 0.072] },
  periwinkle: { hue: [300, 312], ground: [0.140, 0.240], tint: [0.030, 0.048], step: [0.038, 0.050], accent: [0.125, 0.160] },
  bronze:     { hue: [58, 68],   ground: [0.150, 0.195], tint: [0.018, 0.040], step: [0.028, 0.040], accent: [0.070, 0.100] },
  cinnabar:   { hue: [18, 32],   ground: [0.085, 0.115], tint: [0.024, 0.042], step: [0.044, 0.058], accent: [0.115, 0.150] },
  liquid:     { hue: [180, 196], ground: [0.080, 0.160], tint: [0.014, 0.030], step: [0.036, 0.048], accent: [0.095, 0.130] },
};

const FIELDS = ['hue','ground','tint','step','accent'];
const clamp = (v, [lo, hi]) => Math.min(hi, Math.max(lo, v));

function score(spec) {
  const P = {};
  try { for (const t of spec) P[t.name] = build(t); } catch { return { s: -1 }; }
  const { fail } = audit(P);
  if (fail.some((f) => !f.includes('apart on average'))) return { s: -1, P };
  const names = Object.keys(P);
  let worst = 9;
  let sum = 0, n = 0;
  for (let i=0;i<names.length;i++) for (let j=i+1;j<names.length;j++) {
    const a=P[names[i]], b=P[names[j]];
    const m = K.map(k=>dE(a[k],b[k])).reduce((x,y)=>x+y)/8;
    worst = Math.min(worst, m); sum += m; n++;
  }
  // worst pair dominates; the mean is a mild tie-break
  return { s: worst * 100 + (sum / n), P, worst, mean: sum / n };
}

let cur = SPEC.map((t) => ({ ...t }));
let best = score(cur);
console.log('start worst', best.worst?.toFixed(4), 'mean', best.mean?.toFixed(4));
let step = 1;
for (let iter = 0; iter < 3000; iter++) {
  const scale = 1 - iter / 3000;
  const cand = cur.map((t) => ({ ...t }));
  const t = cand[Math.floor(Math.random() * cand.length)];
  const f = FIELDS[Math.floor(Math.random() * FIELDS.length)];
  const b = BOUND[t.name][f];
  const span = (b[1] - b[0]);
  t[f] = clamp(t[f] + (Math.random() - 0.5) * span * 0.5 * scale, b);
  const got = score(cand);
  if (got.s > best.s) { best = got; cur = cand; }
}
console.log('end   worst', best.worst.toFixed(4), 'mean', best.mean.toFixed(4));
console.log('');
for (const t of cur) {
  console.log(`  { name: '${t.name}',${' '.repeat(11 - t.name.length)} ground: ${t.ground.toFixed(3)}, tint: ${t.tint.toFixed(3)}, step: ${t.step.toFixed(3)}, hue: ${Math.round(t.hue)},${String(Math.round(t.hue)).length===2?' ':''} accent: ${t.accent.toFixed(3)}, note: '${t.note}' },`);
}
