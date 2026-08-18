/* Image formats the reader can and cannot take.
 *
 * The bug this exists for: the file inputs advertised image/heic and
 * image/heif, api/extract.js did not list them, and an unrecognised mime
 * was silently relabelled 'image/jpeg' while the bytes stayed HEIC. The
 * model API returned a 400, the catch read that as "our schema is wrong",
 * and the person uploading was told "The slip reader is misconfigured on
 * this deployment."
 *
 * HEIC is the default iPhone camera format and iOS Safari is this
 * product's primary platform, so every photo upload failed and blamed the
 * server. Nothing caught it: 423 tests passed throughout, because nothing
 * tested the client flow and the audit's stub never sends a real image.
 *
 * Three things keep it fixed and each is asserted here, because any one of
 * them alone would let it back.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const read = p => readFile(new URL(p, root), 'utf8');

test('no file input asks the browser for HEIC', async () => {
  /* This is the root cause, not a symptom. iOS Safari transcodes HEIC to
     JPEG on pick BY DEFAULT; it only hands over the raw HEIC when the page
     says it accepts it. Advertising the format was opting in to the
     failure. */
  const html = await read('src/app.html');
  const accepts = [...html.matchAll(/<input[^>]*type="file"[^>]*>/g)].map(m => m[0]);
  assert.ok(accepts.length >= 2, 'expected to find the file inputs');
  for (const el of accepts) {
    assert.equal(/heic|heif/i.test(el), false,
      'a file input still asks for HEIC, so iOS will stop transcoding it:\n  ' + el.slice(0, 120));
  }
});

test('the server refuses an unknown format instead of relabelling it', async () => {
  const src = await read('api/extract.js');
  assert.equal(/ALLOWED_MIME\.includes\(mime\)\s*\?\s*mime\s*:\s*'image\/jpeg'/.test(src), false,
    'an unrecognised mime is being coerced to image/jpeg again; the bytes ' +
    'and the declared type then disagree and the model API 400s');
  assert.match(src, /return json\(res, 415/,
    'an unreadable format should be answered with 415 and named');
});

test('the client will not spend a model call on bytes it could not decode', async () => {
  const src = await read('src/js/api.js');
  assert.match(src, /const READABLE = \[/);
  for (const t of ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']) {
    assert.ok(src.includes("'" + t + "'"), t + ' should be readable');
  }
  assert.equal(src.includes("'image/heic'"), false,
    'HEIC is not something the reader can take, so it must not be listed as readable');
});

test('the client and server agree on what is readable', async () => {
  /* Two lists in two files is how they drift. If they ever disagree the
     client either blocks something the server would have taken, or spends
     a paid model call on something it will refuse. */
  const server = await read('api/extract.js');
  const client = await read('src/js/api.js');

  const sm = /const ALLOWED_MIME = \[([^\]]*)\]/.exec(server);
  const cm = /const READABLE = \[([^\]]*)\]/.exec(client);
  assert.ok(sm && cm, 'expected both lists to be findable');

  const parse = t => [...t.matchAll(/'([^']+)'/g)].map(m => m[1]).sort();
  const serverList = parse(sm[1]).concat('application/pdf').sort();
  assert.deepEqual(parse(cm[1]), serverList,
    'the client READABLE list and the server ALLOWED_MIME list (plus PDF) must match');
});

test('the file inputs only offer formats the reader accepts', async () => {
  const html = await read('src/app.html');
  const server = await read('api/extract.js');
  const allowed = new Set(
    [...(/const ALLOWED_MIME = \[([^\]]*)\]/.exec(server)[1]).matchAll(/'([^']+)'/g)]
      .map(m => m[1]).concat('application/pdf'));

  for (const el of [...html.matchAll(/<input[^>]*type="file"[^>]*accept="([^"]*)"/g)]) {
    for (const part of el[1].split(',').map(s => s.trim())) {
      if (!part.includes('/')) continue;          // .csv and friends
      if (part.startsWith('text/')) continue;      // pasted records
      assert.ok(allowed.has(part),
        'the picker offers ' + part + ' but the reader refuses it');
    }
  }
});
