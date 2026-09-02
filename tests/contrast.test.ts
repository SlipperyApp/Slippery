import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { THEME_NAMES } from '@/lib/themes';

/** Measure every text token against every ground, in all eight themes, read
 *  from tokens.css itself, so a new theme cannot ship a palette that fails.
 *
 *  This exists because --ink-3 was used as a text colour and failed 4.5:1
 *  against every ground in every theme at once, which is exactly how --t4 went
 *  wrong in the build before this one: a token added for borders gets applied
 *  to text and nothing catches it. */

const CSS = readFileSync(new URL('../app/styles/tokens.css', import.meta.url), 'utf8');

/*  Text and the four semantic colours are declared once on :root and are the
 *  same in all eight themes. Only surfaces and the accent pair sit in a theme
 *  block, and the old names (--ink, --surface, --accent) are aliases pointing
 *  at the new ones, so resolving one level of var() is required to measure
 *  anything at all. */
const ROOT: Record<string, string> = (() => {
  const body = /:root \{([\s\S]*?)\n\}/.exec(CSS)?.[1] ?? '';
  const out: Record<string, string> = {};
  for (const m of body.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-fA-F]{6})/g)) out[m[1]] = m[2];
  return out;
})();

function block(theme: string): Record<string, string> {
  const re = theme === 'carbon'
    ? /:root,\s*\[data-theme='carbon'\]\s*\{([\s\S]*?)\n\}/
    : new RegExp(`\\[data-theme='${theme}'\\]\\s*\\{([\\s\\S]*?)\\n\\}`);
  const body = re.exec(CSS)?.[1] ?? '';
  const out: Record<string, string> = { ...ROOT };
  const alias: Record<string, string> = {};
  for (const m of body.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-fA-F]{6})/g)) out[m[1]] = m[2];
  for (const m of body.matchAll(/--([a-z0-9-]+):\s*var\(--([a-z0-9-]+)\)/g)) alias[m[1]] = m[2];
  // One pass is enough: no alias points at another alias.
  for (const [name, target] of Object.entries(alias)) if (out[target]) out[name] = out[target];
  return out;
}


function srgbToLinear(c: number) {
  const v = c / 255;
  return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string) {
  const n = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => srgbToLinear(parseInt(n.slice(i, i + 2), 16)));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string) {
  const l1 = luminance(a);
  const l2 = luminance(b);
  const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
}

/** Every ground a piece of text can land on. */
const GROUNDS = ['bg', 'card', 'raise', 'elev'];

/** Every token that is used as a text colour anywhere in the stylesheets.
 *  --t3 is included: the claim is that it clears 4.5:1 on every surface
 *  including --elev, the lightest ground there is, and a claim is not a
 *  measurement. */
const TEXT_TOKENS = ['t1', 't2', 't3', 'ink', 'ink-2'];

/** --t4, and its alias --ink-3, is a BORDER and disabled-icon token. If it
 *  ever appears as a text colour again, the second test below fails rather
 *  than this one. */
const NOT_TEXT = ['ink-3', 't4', 'line', 'line-2', 'line2'];

test('every text token clears 4.5 to 1 on every ground, in all eight themes', () => {
  const failures: string[] = [];
  for (const theme of THEME_NAMES) {
    const t = block(theme);
    for (const ground of GROUNDS) {
      for (const token of TEXT_TOKENS) {
        if (!t[token] || !t[ground]) { failures.push(`${theme}: --${token} or --${ground} is missing`); continue; }
        const ratio = contrast(t[token], t[ground]);
        if (ratio < 4.5) failures.push(`${theme}: --${token} ${t[token]} on --${ground} ${t[ground]} is ${ratio.toFixed(2)}:1`);
      }
    }
  }
  assert.deepEqual(failures, []);
});

test('the four semantic colours clear 4.5 to 1 on every ground, in all eight themes', () => {
  const failures: string[] = [];
  for (const theme of THEME_NAMES) {
    const t = block(theme);
    for (const ground of GROUNDS) {
      for (const name of ['pos', 'neg', 'warn', 'gold'] as const) {
        const hex = ROOT[name];
        const ratio = contrast(hex, t[ground]);
        if (ratio < 4.5) failures.push(`${theme}: --${name} ${hex} on --${ground} ${t[ground]} is ${ratio.toFixed(2)}:1`);
      }
    }
  }
  assert.deepEqual(failures, []);
});

/*  --accent is measured at TWO bars, because it does two jobs and only one
 *  of them is reading.
 *
 *  4.5:1 against --bg, because --accent-ink IS --bg and it sits on --accent
 *  in a primary button, so that pair carries words.
 *
 *  3:1 on the other grounds, which is WCAG 1.4.11 for a graphical object,
 *  because --accent is never text: every `color: var(--accent)` in
 *  app/styles is on an SVG icon, a focus ring, a border or a blurred glow,
 *  and the test below this one keeps it that way. --accent-2 is the accent
 *  made to be read, and the two exist so that this distinction can hold.
 *
 *  This test used to demand 4.5 on --surface as well. The cost showed up
 *  when the eight palettes were replaced with the prototype's own: cinnabar's
 *  accent measured 4.47:1 against its own card, and the choice was to weaken
 *  a real colour by 0.03 to satisfy a bar nothing on that card was held to. */
test('the accent clears its two bars, in all eight themes', () => {
  const failures: string[] = [];
  for (const theme of THEME_NAMES) {
    const t = block(theme);
    // The primary button: --accent-ink on --accent, and it is --bg either way.
    const onAccent = contrast(t['accent-ink'], t.accent);
    if (onAccent < 4.5) failures.push(`${theme}: --accent-ink on --accent is ${onAccent.toFixed(2)}:1`);
    // Icons, rings and borders, on any ground.
    for (const ground of ['bg', 'surface', 'surface-2', 'surface-3']) {
      const r = contrast(t.accent, t[ground]);
      if (r < 3) failures.push(`${theme}: --accent ${t.accent} on --${ground} ${t[ground]} is ${r.toFixed(2)}:1 as a graphical object`);
    }
    // --accent-2 is the one that carries words, and it holds the full bar.
    for (const ground of ['bg', 'surface', 'surface-2', 'surface-3']) {
      const r = contrast(t['accent-2'], t[ground]);
      if (r < 4.5) failures.push(`${theme}: --accent-2 ${t['accent-2']} on --${ground} ${t[ground]} is ${r.toFixed(2)}:1`);
    }
  }
  assert.deepEqual(failures, []);
});

/*  --accent is the button GROUND. --accent-2 is the one of the two accents
 *  made to be read. The stylesheet has said so since .pill--accent was
 *  written, and a component then said color: 'var(--accent)' in an inline
 *  style, which no stylesheet rule can reach: the selected ledger facet
 *  measured 4.38:1 and axe called it serious. Inline styles are where this
 *  comes back, so this reads the components. */
test('no component paints text in the button accent', () => {
  const roots = ['components', 'app'];
  const offences: string[] = [];
  const walk = (dir: string) => {
    for (const e of readdirSync(new URL(`../${dir}/`, import.meta.url), { withFileTypes: true })) {
      if (e.isDirectory()) { walk(`${dir}/${e.name}`); continue; }
      if (!e.name.endsWith('.tsx')) continue;
      const rel = `${dir}/${e.name}`;
      const src = readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8');
      /*  color, and only color. background-color, border-color, outline-color,
          fill and accent-color are all legitimate uses of the button accent:
          accent-color paints a range slider's fill, which is a control, not
          a word. */
      for (const m of src.matchAll(/(?:^|[^A-Za-z-])color:\s*'var\(--accent\)'/gi)) {
        const line = src.slice(0, m.index).split('\n').length;
        // An icon is a graphical object at 3:1, not text.
        const around = src.slice(Math.max(0, (m.index ?? 0) - 160), m.index);
        if (/<Icon\b|<svg\b/.test(around)) continue;
        offences.push(`${rel}:${line} paints text in --accent`);
      }
    }
  };
  for (const r of roots) walk(r);
  assert.deepEqual(offences, [], offences.join('\n'));
});

test('a border token is never used as a text colour', () => {
  // Reading the stylesheets rather than the browser, because this is the
  // failure that ships green through a build, a type check and axe.
  const dir = new URL('../app/styles/', import.meta.url);
  const files = readdirSync(dir).filter((f) => f.endsWith('.css') && f !== 'tokens.css');
  const offences: string[] = [];

  for (const file of files) {
    const text = readFileSync(new URL(file, dir), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    text.split('\n').forEach((line, i) => {
      for (const token of NOT_TEXT) {
        // `color:` and `fill:` are text. `border-color:` and `background` are not.
        if (new RegExp(`(^|[^-])\\b(color|fill)\\s*:\\s*var\\(--${token}\\)`).test(line)) {
          // An icon is allowed to take a border token: it is not read.
          if (/__i\b|\bicon\b|svg/i.test(line)) continue;
          offences.push(`${file}:${i + 1} ${line.trim().slice(0, 90)}`);
        }
      }
    });
  }
  assert.deepEqual(offences, []);
});

test('nothing that has to be read is faded below legibility', () => {
  const dir = new URL('../app/styles/', import.meta.url);
  const files = readdirSync(dir).filter((f) => f.endsWith('.css'));
  const offences: string[] = [];
  // Track the enclosing selector, not just the line: an opacity three lines
  // below a decorative selector is not a defect, and reading the line alone
  // says it is.
  const DECORATIVE = /bgfield|__glow|__sheen|grain|ghost|meter|barfill|blob|wave|keyframes|from|to|%|disabled|cal__cell--out|empty__|spin|live-dot|pulse/i;
  for (const file of files) {
    const text = readFileSync(new URL(file, dir), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    let selector = '';
    text.split('\n').forEach((line, i) => {
      if (line.includes('{')) selector = line.slice(0, line.indexOf('{')).trim() || selector;
      const m = /opacity:\s*(0?\.\d+)/.exec(line);
      if (!m) return;
      if (Number(m[1]) >= 0.7) return;
      if (DECORATIVE.test(selector) || DECORATIVE.test(line)) return;
      offences.push(`${file}:${i + 1} ${selector} ${line.trim().slice(0, 70)}`);
    });
  }
  assert.deepEqual(offences, []);
});

/** Every component, as lines, once. Both of the tests below read the same
 *  files, and they read them line by line because that is where the meaning
 *  is: the colour and the thing it is being applied to sit together.
 *
 *  Comments are blanked, and their newlines are kept so a reported line
 *  number is still the line. The note above a fix naming the colour it took
 *  out is not the colour coming back. */
function componentLines(): { at: string; line: string }[] {
  const out: { at: string; line: string }[] = [];
  const walk = (dir: URL, rel: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const child = new URL(entry.name + (entry.isDirectory() ? '/' : ''), dir);
      if (entry.isDirectory()) { walk(child, `${rel}${entry.name}/`); continue; }
      if (!/\.tsx$/.test(entry.name)) continue;
      readFileSync(child, 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
        .replace(/^\s*\/\/.*$/gm, ' ')
        .split('\n')
        .forEach((line, i) => {
          out.push({ at: `${rel}${entry.name}:${i + 1}`, line });
        });
    }
  };
  walk(new URL('../components/', import.meta.url), 'components/');
  walk(new URL('../app/', import.meta.url), 'app/');
  return out;
}

test('the two result colours are never used to mean anything but money', () => {
  // They mean profit and loss. Letting green also mean "read cleanly" and red
  // also mean "not on the slip" puts four meanings on two colours, on screens
  // that are about to write money into a ledger.
  const offences: string[] = [];

  // Where they legitimately appear: an outcome, a profit figure, a calendar
  // fill, the swatches that explain the two colours, and the saving on the
  // yearly plan, which the brief specifies as a green pill.
  const ALLOWED = new RegExp([
    // a real outcome
    "outcome", "'won'", "'lost'", "'void'", "legResult", "plClass", "tone",
    // a real money figure
    "pl\\(", "money\\(", "netPence", "realisedPl", "units", "profit", "loss",
    // the calendar ramp, the charts, and the swatches that explain the colours
    "cal-", "cal__key", "swatch", "#86EFAC", "#FCA5A5", "meter__fill",
    "OutcomePill", "ProfitCurve", "MonthBars", "Sparkline", "--pos\\b", "--neg\\b",
    // the saving on the yearly plan, which the brief specifies as a green pill
    "Save ",
    // the destructive block, which the brief specifies is in the loss colour
    "Destructive",
    // and the general shape of "the sign of a number picks the colour", which
    // is the correct use by definition
    "> 0 \\? '(pos|neg)'", ">= 0 \\? '(pos|neg)'", "< 0 \\? '(pos|neg)'",
    "startsWith\\('-'\\)", "startsWith\\('\\+'\\)",
    // a boolean already named for the sign of the figure it colours
    "\\bpos \\? '(pos|neg)'", "tone=\\{pos", "brk__fig",
    // a ghosted empty state is a picture of a money figure
    "ghost=", "\\+£",
  ].join('|'));

  for (const { at, line } of componentLines()) {
    if (!/\b(pos|neg)\b/.test(line)) continue;
    if (!/className|class=/.test(line)) continue;
    if (!/['"`\s](pos|neg)['"`\s]|pill--(pos|neg)|fill--(pos|neg)/.test(line)) continue;
    if (ALLOWED.test(line)) continue;
    offences.push(`${at} ${line.trim().slice(0, 84)}`);
  }
  assert.deepEqual(offences, [], offences.join('\n'));
});

/*  THE OTHER WAY A COLOUR REACHES A SCREEN.
 *
 *  The test above reads className, and only className: `if (!/className|
 *  class=/.test(line)) return`. Six components had put the two result colours
 *  on through an inline style instead, and every one of them passed. Profit
 *  green meant "that email address is well formed" on the login form, which
 *  is the second screen anybody sees; loss red meant "paused" on the billing
 *  screen, four inches from where red means a card was declined.
 *
 *  This reads the other channel: var(--pos), var(--neg) and the two hexes,
 *  which in a .tsx file means a style prop, an SVG paint attribute or a
 *  constant holding one of the colours.
 *
 *  It keeps its OWN list of legitimate uses rather than sharing the one
 *  above. That one has to allow the substring --pos so that a class named
 *  pill--pos gets through, and an allowance for --pos matches var(--pos)
 *  as well, which is exactly how these six passed. A rule that cannot see
 *  half the ways a colour is applied is a rule that passes while the defect
 *  comes back, and it cannot be fixed by widening the rule that has the
 *  hole in it. */
test('the two result colours are never applied inline to mean anything but money', () => {
  const offences: string[] = [];

  const APPLIED = /var\(--(pos|neg)\)|#86EFAC|#FCA5A5/i;

  const ALLOWED_INLINE = new RegExp([
    // the charts and the calendar ramp, which are pictures of money
    "tone", "cal__fill", "meter__fill", "ProfitCurve", "MonthBars", "Sparkline",
    // the sign of a number picking the colour, which is the correct use by
    // definition, and a boolean already named for that sign
    "[<>]=? 0 \\? 'var\\(--(pos|neg)\\)'", "\\b(up|pos) \\? 'var\\(--(pos|neg)\\)'",
    // a money figure, including the two on the share and open graph cards
    "money\\(", "netPence", "[-+]£\\d",
    // the swatches on /themes, which exist to show what the two colours are,
    // and the two constants the share card names them in
    "themecard__sw", "mono (pos|neg)", "const (POS|NEG) =",
  ].join('|'));

  for (const { at, line } of componentLines()) {
    if (!APPLIED.test(line)) continue;
    if (ALLOWED_INLINE.test(line)) continue;
    offences.push(`${at} ${line.trim().slice(0, 84)}`);
  }
  assert.deepEqual(offences, [], offences.join('\n'));
});
