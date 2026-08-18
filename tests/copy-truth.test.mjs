/* The product does not refuse a late bet, and the copy keeps saying it does.
 *
 * Slippery accepts a slip before kick off, in play, or after the result is
 * known. All three are logged identically. What it does is RECORD which,
 * in capture_stage, and report the split back as a capture rate.
 *
 * Capture at placement is still the core idea and the brief still locks it.
 * It is the thing the product measures and makes worth doing, not a gate on
 * the front door. Stating the measurement as a restriction turns an honest
 * number into a told-off, and it puts off the exact person who has a
 * backlog to import.
 *
 * This has been written the wrong way three times in this codebase: in the
 * hero, in the first landing section, and in the footer. Hence a test.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';

const root = new URL('../', import.meta.url);

async function copySources() {
  /* build.mjs is in here because the meta description and the Open Graph
     text live in it, and they said "Capture a bet when you place it, not
     when it wins" long after every visible string had been corrected. Copy
     that only search engines and link previews see is still copy. */
  const out = [
    ['src/app.html', await readFile(new URL('src/app.html', root), 'utf8')],
    ['build.mjs', await readFile(new URL('build.mjs', root), 'utf8')]
  ];
  const dir = new URL('src/js/', root);
  for (const n of await readdir(dir)) {
    if (!n.endsWith('.js')) continue;
    out.push(['src/js/' + n, await readFile(new URL(n, dir), 'utf8')]);
  }
  return out;
}

/* Phrasings that tell somebody a bet must be logged at the moment it is
   placed. Each is a real sentence that has shipped. */
const FORBIDDEN = [
  /\bas you place it\b/i,
  /\bwhen you place it\b/i,
  /\blogged before kick.?off,?\s*\n?\s*not after\b/i,
  /\bonly (?:be )?(?:logged|captured|added) (?:at|on) placement\b/i,
  /\bmust be logged (?:at|before)\b/i
];

test('no copy says a bet has to be logged at placement', async () => {
  const offenders = [];
  for (const [file, src] of await copySources()) {
    /* Comments explain why the wording was changed and must be allowed to
       quote the wording they replaced. */
    const live = src
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/^\s*\/\/.*$/gm, '');
    for (const re of FORBIDDEN) {
      const m = re.exec(live);
      if (m) offenders.push(file + ': "' + m[0] + '"');
    }
  }
  assert.deepEqual(offenders, [],
    'Slippery accepts a slip before kick off, in play, or after the result.\n' +
    'It records which; it does not refuse any of them:\n  ' + offenders.join('\n  '));
});

test('the hero states that all three stages are accepted', async () => {
  /* The landing page is four blocks now, so this sentence has nowhere to
     hide further down: if the hero does not say it, the page does not. */
  const html = await readFile(new URL('src/app.html', root), 'utf8');
  const hero = /<p class="lead-sub reveal">([\s\S]*?)<\/p>/.exec(html);
  assert.ok(hero, 'expected to find the hero sub');
  assert.match(hero[1], /before kick off, in play, or after it\s+settled/i);
});

test('the tour still teaches it too', async () => {
  /* The other place a new account is told, and the one that survives
     somebody arriving through a direct link rather than the landing. */
  const main = await readFile(new URL('src/js/main.js', root), 'utf8');
  assert.match(main, /Before kick off, in play, or after the result/i);
  assert.match(main, /All three are logged the same way/i);
});

test('the check would catch the sentences that actually shipped', () => {
  /* Proving the patterns match real regressions rather than nothing. */
  const shipped = [
    'Log the slip as you place it. Slippery reads it,',
    'Capture the slip when you place it.',
    'Forward the slip as you place it and it is read'
  ];
  for (const s of shipped) {
    assert.ok(FORBIDDEN.some(re => re.test(s)), 'should have caught: ' + s);
  }
  /* And that correct copy passes. */
  for (const ok of [
    'Send a slip before kick off, in play, or after it settled.',
    'Log it whenever. It remembers when.',
    'Placing and logging become one action'
  ]) {
    assert.ok(!FORBIDDEN.some(re => re.test(ok)), 'false positive on: ' + ok);
  }
});

/* The duplicate FAQ described a review list that flags duplicates and lets
   you keep one. The server skips them instead and reports the count, so the
   copy has to say that. */
test('the duplicate FAQ describes what the importer actually does', async () => {
  const pages = await readFile(new URL('../src/js/pages.js', import.meta.url), 'utf8');
  const server = await readFile(new URL('../api/bets.js', import.meta.url), 'utf8');
  const faq = pages.slice(pages.indexOf('How does duplicate detection work?'));
  const entry = faq.slice(0, faq.indexOf('],\n  [')); 
  assert.match(entry, /skipped rather than imported/);
  assert.doesNotMatch(entry, /flagged in the review list/);
  /* And the four fields the copy names are the four the key is built from. */
  assert.match(server, /keyOf\(dayKey\(b\.placedAt\), b\.selection, b\.stakePence, b\.book\)/);
});
