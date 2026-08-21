/* Every output in one go, into ../public/video/.
 *
 * Build-time only. This never runs on Vercel: the rendered files are
 * committed, because a render needs ffmpeg and several minutes and a deploy
 * needs neither.
 *
 * Two cuts of every film. The wide one is what a laptop gets; the tall one
 * is what a phone gets, and it is a different composition rather than a crop
 * — see Root.tsx. VP9 in a webm carries these at roughly a third of the
 * h264 size, and the mp4 is the fallback for Safari versions that will not
 * take it.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';

const CHROME = process.env.REMOTION_CHROME_EXECUTABLE
  || '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell';

const OUT = '../public/video';
mkdirSync(OUT, { recursive: true });

/* [composition id, output basename] */
const FILMS = [
  ['InAction', 'in-action'],
  ['Bot', 'bot'],
  ['Importing', 'import'],
  ['Social', 'social'],
  ['Settling', 'settling'],
];

const jobs = [];

/* The explainer is now one of the six rather than a special case, so it
   renders in the same two cuts with the same codecs. The old 9:16 h264 stays
   as the social asset it was always for. */
FILMS.unshift(['Explainer', 'explainer']);
jobs.push(['render', 'ExplainerVertical', `${OUT}/explainer-9x16.mp4`, '--codec=h264']);

for (const [id, name] of FILMS) {
  jobs.push(['render', id, `${OUT}/${name}.webm`, '--codec=vp9', '--crf=40']);
  jobs.push(['render', id, `${OUT}/${name}.mp4`, '--codec=h264', '--crf=30']);
  jobs.push(['render', id + 'Vertical', `${OUT}/${name}-tall.webm`, '--codec=vp9', '--crf=40']);
  jobs.push(['render', id + 'Vertical', `${OUT}/${name}-tall.mp4`, '--codec=h264', '--crf=30']);
  /* One poster per shape, so nothing loads until somebody presses play and
     the space is never empty while it waits. */
  jobs.push(['still', id, `${OUT}/${name}-poster.jpg`, '--frame=40']);
  jobs.push(['still', id + 'Vertical', `${OUT}/${name}-tall-poster.jpg`, '--frame=40']);
}

for (const [verb, id, out, ...flags] of jobs) {
  console.log('→', out);
  execFileSync('npx', ['remotion', verb, 'src/index.ts', id, out, ...flags,
    '--browser-executable=' + CHROME], { stdio: 'inherit' });
}
console.log('done:', jobs.length, 'outputs');
