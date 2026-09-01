import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { textPdf } from '@/lib/server/pdf';

/*  A PDF is only a PDF if a reader opens it. The structural assertions here
 *  are cheap and always run; where the poppler tools are installed the file
 *  is also parsed and its text extracted, which is the assertion that
 *  actually matters. A hand written xref that is one byte out produces a file
 *  every reader refuses and every string test still passes. */

const LINES = [
  'SLIPPERY LEDGER',
  'Account @tester123',
  '364 bets, +£3,249.14 net',
  '',
  '2026-08-31  Arsenal (each way)  bet365  £25.00  2.42  won  +£35.50',
  'A line with (brackets) and a \\ backslash, which are the three bytes a',
  '18+ · BeGambleAware.org · National Gambling Helpline 0808 8020 133',
];

test('the file is a PDF, with one page per screenful and a correct xref', () => {
  const pdf = textPdf({ title: 'Slippery ledger', lines: LINES });
  const s = pdf.toString('latin1');

  assert.ok(s.startsWith('%PDF-1.4\n'), 'no header');
  assert.ok(s.trimEnd().endsWith('%%EOF'), 'no trailer');
  assert.equal((s.match(/\/Type \/Page[^s]/g) ?? []).length, 1);

  // startxref must point at the byte where "xref" begins. One byte out and
  // every reader refuses the file while every other assertion still passes.
  const startxref = Number(/startxref\n(\d+)\n/.exec(s)![1]);
  assert.equal(s.slice(startxref, startxref + 4), 'xref');

  // Every in-use offset must land on the start of the object it claims. The
  // free entry at index 0 is not an object, so the first "n" row is object 1.
  const used = [...s.slice(startxref).matchAll(/^(\d{10}) 00000 n $/gm)].map((m) => Number(m[1]));
  assert.ok(used.length >= 5, `${used.length} objects in the xref`);
  used.forEach((offset, i) => {
    assert.ok(
      s.slice(offset).startsWith(`${i + 1} 0 obj`),
      `xref row ${i} points at "${s.slice(offset, offset + 12)}", not object ${i + 1}`,
    );
  });
});

test('long ledgers paginate', () => {
  const many = Array.from({ length: 300 }, (_, i) => `row ${i}`);
  const pdf = textPdf({ title: 't', lines: many });
  const pages = (pdf.toString('latin1').match(/\/Type \/Page[^s]/g) ?? []).length;
  assert.ok(pages >= 6 && pages <= 9, `${pages} pages for 300 lines`);
});

test('a reader can open it and read the ledger back out', (t) => {
  /*  The absence of a tool and the failure of a tool are two different
   *  things, and wrapping both in one try/catch turns the second into the
   *  first. It did: with a deliberately broken xref this test SKIPPED,
   *  because qpdf --check exits non-zero on a damaged file. A test that skips
   *  when it should fail is worse than no test. Presence is checked first,
   *  and after that an exception is a defect. */
  try {
    execFileSync('qpdf', ['--version'], { stdio: 'ignore' });
    execFileSync('pdftotext', ['-v'], { stdio: 'ignore' });
  } catch {
    return t.skip('no qpdf or pdftotext in this environment');
  }

  const dir = mkdtempSync(join(tmpdir(), 'slip-pdf-'));
  const file = join(dir, 'x.pdf');
  writeFileSync(file, textPdf({
    title: 'Slippery ledger',
    lines: LINES,
    footer: (p, of) => `page ${p} of ${of}`,
  }));
  execFileSync('qpdf', ['--check', file], { stdio: 'ignore' });
  const out = execFileSync('pdftotext', ['-layout', file, '-'], { encoding: 'utf8' });

  assert.match(out, /SLIPPERY LEDGER/);
  assert.match(out, /Account @tester123/);
  // The pound sign and the middle dot are the reason the encoding is WinAnsi
  // rather than plain ASCII, and both are in every ledger this product makes.
  assert.match(out, /\+£3,249\.14 net/);
  assert.match(out, /18\+ · BeGambleAware\.org/);
  // Brackets and a backslash are the three bytes a PDF literal string cannot
  // carry raw, so they prove the escaping rather than the encoding.
  assert.match(out, /\(brackets\) and a \\ backslash/);
  assert.match(out, /page 1 of 1/);
});
