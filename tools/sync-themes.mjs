/** Write the generated palettes into tokens.css and lib/themes.ts.
 *
 *  Both files hold the same eight palettes: the stylesheet paints the app,
 *  the registry paints the picker chips, and a test asserts they agree. That
 *  test can only ever say they have diverged; this is the thing that stops
 *  them diverging, by writing both from tools/palette.mjs in one pass.
 *
 *    node tools/sync-themes.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { palettes, audit, SPEC } from './palette.mjs';

const P = palettes();
const { fail, stat } = audit(P);
if (fail.length) {
  console.error(`${fail.length} failures, nothing written:`);
  for (const f of fail) console.error('  ' + f);
  process.exit(1);
}

const KEYS = ['bg', 'card', 'raise', 'elev', 'line', 'line2', 'p', 's'];
const css = new URL('../app/styles/tokens.css', import.meta.url);
let s = readFileSync(css, 'utf8');
let n = 0;
for (const t of SPEC) {
  const re = new RegExp(`(\\[data-theme='${t.name}'\\] \\{)([\\s\\S]*?)(\\n\\})`);
  const m = re.exec(s);
  if (!m) { console.error(`no block for ${t.name}`); process.exit(1); }
  let body = m[2];
  for (const k of KEYS) {
    const [next, hits] = [body.replace(new RegExp(`(--${k}:\\s*)#[0-9a-fA-F]{6}`), `$1${P[t.name][k]}`),
      new RegExp(`--${k}:\\s*#[0-9a-fA-F]{6}`).test(body)];
    if (!hits) { console.error(`${t.name} has no --${k}`); process.exit(1); }
    body = next; n += 1;
  }
  s = s.slice(0, m.index + m[1].length) + body + s.slice(m.index + m[1].length + m[2].length);
}
writeFileSync(css, s);

const reg = new URL('../lib/themes.ts', import.meta.url);
let r = readFileSync(reg, 'utf8');
for (const t of SPEC) {
  const v = P[t.name];
  const re = new RegExp(`(\\{ name: '${t.name}', label: '[^']*', blurb: '[^']*', swatch: \\[)('[^']*', '[^']*', '[^']*', '[^']*')(\\])`);
  const m = re.exec(r);
  if (!m) { console.error(`no registry row for ${t.name}`); process.exit(1); }
  r = r.slice(0, m.index + m[1].length) + `'${v.bg}', '${v.card}', '${v.p}', '${v.line}'` + r.slice(m.index + m[1].length + m[2].length);
}
writeFileSync(reg, r);

console.log(`${n} values into tokens.css, ${SPEC.length} rows into lib/themes.ts`);
console.log(`worst text on ground  ${stat.worstText.r.toFixed(2)}:1  (${stat.worstText.at})`);
console.log(`closest theme pair    ${stat.worstPair.d.toFixed(3)}   (${stat.worstPair.at})`);
