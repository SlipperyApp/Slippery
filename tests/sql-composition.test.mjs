/* No nested sql fragments anywhere in the server.
 *
 * The group directory once read:
 *
 *     WHERE ${q ? sql`g.name_lower LIKE ${...}` : sql`true`}
 *
 * postgres.js composes fragments like that. The Neon HTTP driver this
 * project actually uses does not: it treats the inner fragment as a value
 * and binds it as a query parameter, so the statement is malformed and the
 * function crashes. Every browse request 500ed in all three orderings, and
 * because the directory is a screen nobody loads while testing an API by
 * hand, it stayed broken without ever being noticed.
 *
 * The failure is invisible locally, needs a real database to reproduce, and
 * looks like an outage rather than a bug. So it is caught in the source
 * instead, the same way the audit reads delegated selectors out of the
 * handler rather than waiting to see them misbehave.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const API = path.join(process.cwd(), 'api');

async function serverFiles(dir = API, out = []) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) await serverFiles(full, out);
    else if (entry.name.endsWith('.js')) out.push(full);
  }
  return out;
}

/* Comments are where this rule gets explained, so they must not trip it. */
function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

test('no template interpolation contains a nested sql tag', async () => {
  const files = await serverFiles();
  assert.ok(files.length > 10, 'expected to find the server files');

  const offenders = [];
  for (const file of files) {
    const src = stripComments(await readFile(file, 'utf8'));
    src.split('\n').forEach((line, i) => {
      /* An interpolation that opens a tagged template of its own. */
      if (/\$\{[^}]*\bsql\s*`/.test(line)) {
        offenders.push(path.relative(process.cwd(), file) + ':' + (i + 1) + '  ' + line.trim());
      }
    });
  }

  assert.deepEqual(offenders, [],
    'The Neon driver cannot compose sql fragments. Build the whole statement in one\n' +
    'tagged template and pass values as parameters:\n  ' + offenders.join('\n  '));
});

test('the check would catch the shape that broke browse', () => {
  /* Proving the regex earns its place rather than matching nothing. */
  const bad = 'WHERE ${q ? sql`g.name_lower LIKE ${p}` : sql`true`}';
  assert.match(bad, /\$\{[^}]*\bsql\s*`/);

  const good = 'WHERE COALESCE(g.name_lower, lower(g.name)) LIKE ${like}';
  assert.doesNotMatch(good, /\$\{[^}]*\bsql\s*`/);
});
