/* All four outputs in one go, into ../public/video/.
 *
 * Build-time only. This never runs on Vercel: the rendered files are
 * committed, because a video render needs ffmpeg and several minutes and a
 * deploy needs neither.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';

/* The rendering browser. Remotion downloads its own by default; this machine
   already has a headless shell, and the full Chrome binary no longer supports
   the old headless mode Remotion asks for. */
const CHROME = process.env.REMOTION_CHROME_EXECUTABLE
  || '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell';

mkdirSync('../public/video', { recursive: true });

const jobs = [
  ['render', 'Explainer', '../public/video/explainer.mp4', '--codec=h264'],
  ['render', 'Explainer', '../public/video/explainer.webm', '--codec=vp8'],
  ['render', 'ExplainerVertical', '../public/video/explainer-9x16.mp4', '--codec=h264'],
  ['still', 'Explainer', '../public/video/explainer-poster.jpg', '--frame=45'],
];

for (const [verb, id, out, ...flags] of jobs) {
  console.log('→', out);
  execFileSync('npx', ['remotion', verb, 'src/index.ts', id, out, ...flags, '--browser-executable=' + CHROME], { stdio: 'inherit' });
}
console.log('done');
