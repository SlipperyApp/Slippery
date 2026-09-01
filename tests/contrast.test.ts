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

function block(theme: string): Record<string, string> {
  const re = theme === 'carbon'
    ? /:root,\s*\[data-theme='carbon'\]\s*\{([\s\S]*?)\n\}/
    : new RegExp(`\\[data-theme='${theme}'\\]\\s*\\{([\\s\\S]*?)\\n\\}`);
  const body = re.exec(CSS)?.[1] ?? '';
  const out: Record<string, string> = {};
  for (const m of body.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-fA-F]{6})/g)) out[m[1]] = m[2];
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
const GROUNDS = ['bg', 'bg-2', 'surface', 'surface-2', 'surface-3'];

/** Every token that is used as a text colour anywhere in the stylesheets. */
const TEXT_TOKENS = ['ink', 'ink-2'];

/** --ink-3 is a BORDER and disabled-icon token. If it ever appears as a text
 *  colour again, the second test below fails rather than this one. */
const NOT_TEXT = ['ink-3', 'line', 'line-2'];

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

test('the two result colours clear 4.5 to 1 on every ground, in all eight themes', () => {
  const failures: string[] = [];
  for (const theme of THEME_NAMES) {
    const t = block(theme);
    for (const ground of GROUNDS) {
      for (const [name, hex] of [['pos', '#86EFAC'], ['neg', '#FCA5A5']] as const) {
        const ratio = contrast(hex, t[ground]);
        if (ratio < 4.5) failures.push(`${theme}: --${name} ${hex} on --${ground} ${t[ground]} is ${ratio.toFixed(2)}:1`);
      }
    }
  }
  assert.deepEqual(failures, []);
});

test('the accent clears 4.5 to 1 on the page ground, in all eight themes', () => {
  const failures: string[] = [];
  for (const theme of THEME_NAMES) {
    const t = block(theme);
    for (const ground of ['bg', 'surface']) {
      const ratio = contrast(t.accent, t[ground]);
      if (ratio < 4.5) failures.push(`${theme}: --accent ${t.accent} on --${ground} ${t[ground]} is ${ratio.toFixed(2)}:1`);
    }
    // And text ON the accent, for a primary button.
    const onAccent = contrast(t['accent-ink'], t.accent);
    if (onAccent < 4.5) failures.push(`${theme}: --accent-ink on --accent is ${onAccent.toFixed(2)}:1`);
  }
  assert.deepEqual(failures, []);
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

test('the two result colours are never used to mean anything but money', () => {
  // They mean profit and loss. Letting green also mean "read cleanly" and red
  // also mean "not on the slip" puts four meanings on two colours, on screens
  // that are about to write money into a ledger.
  const roots = [new URL('../components/', import.meta.url), new URL('../app/', import.meta.url)];
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
    // a ghosted empty state is a picture of a money figure
    "ghost=", "\\+£",
  ].join('|'));

  const walk = (dir: URL) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const child = new URL(entry.name + (entry.isDirectory() ? '/' : ''), dir);
      if (entry.isDirectory()) { walk(child); continue; }
      if (!/\.tsx$/.test(entry.name)) continue;
      readFileSync(child, 'utf8').split('\n').forEach((line, i) => {
        if (!/\b(pos|neg)\b/.test(line)) return;
        if (!/className|class=/.test(line)) return;
        if (!/['"`\s](pos|neg)['"`\s]|pill--(pos|neg)|fill--(pos|neg)/.test(line)) return;
        if (ALLOWED.test(line)) return;
        offences.push(`${entry.name}:${i + 1} ${line.trim().slice(0, 84)}`);
      });
    }
  };
  roots.forEach(walk);
  assert.deepEqual(offences, []);
});
