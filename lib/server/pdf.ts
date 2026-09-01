/** A PDF, written by hand, because the product promises one.
 *
 *  /pricing says "CSV, JSON and PDF export, always" and Settings offers a PDF
 *  button. What came back was a .txt with a comment in the route explaining
 *  that a real PDF needed a renderer the deployment does not carry. That is
 *  an honest comment inside a broken promise, and this product's entire
 *  argument is that a record which flatters itself is worthless. A page that
 *  promises a PDF has to hand over a PDF.
 *
 *  It does not need a renderer. A page of monospaced text is about a hundred
 *  and fifty lines of PDF 1.4: a catalogue, a page tree, one content stream
 *  per page, and Courier, which is one of the fourteen fonts every reader is
 *  required to have built in, so nothing is embedded and nothing is licensed.
 *
 *  WinAnsi is the encoding because the ledger is full of pound signs and the
 *  compliance line carries a middle dot, and WinAnsi has both at 0xA3 and
 *  0xB7. Anything outside it becomes a question mark rather than a mangled
 *  glyph: a reader can see a question mark and ask.
 */

const A4_LANDSCAPE = { w: 842, h: 595 };
const MARGIN = 36;

/** WinAnsi, not UTF-8. The base-14 fonts are single byte. */
function winAnsi(s: string): Buffer {
  const out = Buffer.alloc(s.length);
  for (let i = 0; i < s.length; i += 1) {
    const c = s.codePointAt(i)!;
    if (c === 0x2026) out[i] = 0x85;          // ellipsis
    else if (c === 0x2022) out[i] = 0x95;     // bullet
    else if (c === 0x2013) out[i] = 0x96;     // en dash
    else if (c === 0x2014) out[i] = 0x97;     // em dash
    else if (c === 0x2018) out[i] = 0x91;
    else if (c === 0x2019) out[i] = 0x92;
    else if (c === 0x201c) out[i] = 0x93;
    else if (c === 0x201d) out[i] = 0x94;
    else if (c === 0x20ac) out[i] = 0x80;     // euro
    else if (c === 0x2212) out[i] = 0x2d;     // minus sign to hyphen
    else if (c <= 0xff) out[i] = c;
    else out[i] = 0x3f;                       // '?'
  }
  return out;
}

/** ( ) and \ are the three bytes a PDF literal string cannot carry raw. */
function pdfString(s: string): Buffer {
  const bytes = winAnsi(s);
  const parts: number[] = [];
  for (const b of bytes) {
    if (b === 0x28 || b === 0x29 || b === 0x5c) parts.push(0x5c);
    parts.push(b);
  }
  return Buffer.from(parts);
}

export type TextPdf = {
  /** Shown in the reader's title bar and in the document information. */
  title: string;
  lines: string[];
  fontSize?: number;
  /** Drawn at the foot of every page, in the same face, one size smaller. */
  footer?: (page: number, of: number) => string;
};

export function textPdf({ title, lines, fontSize = 8, footer }: TextPdf): Buffer {
  const leading = Math.round(fontSize * 1.35 * 100) / 100;
  const usable = A4_LANDSCAPE.h - MARGIN * 2 - (footer ? leading * 2 : 0);
  const perPage = Math.max(1, Math.floor(usable / leading));

  const pages: string[][] = [];
  for (let i = 0; i < Math.max(1, lines.length); i += perPage) {
    pages.push(lines.slice(i, i + perPage));
  }

  /*  Object numbering, fixed up front so the page tree can name its kids
   *  before their streams exist:
   *    1  catalogue
   *    2  page tree
   *    3  font
   *    4  document information
   *    5..  page, stream, page, stream, ...  */
  const FIRST_PAGE = 5;
  const pageObj = (i: number) => FIRST_PAGE + i * 2;
  const streamObj = (i: number) => FIRST_PAGE + i * 2 + 1;

  const objects: Buffer[] = [];
  const put = (n: number, body: Buffer | string) => {
    objects[n] = Buffer.concat([
      Buffer.from(`${n} 0 obj\n`, 'latin1'),
      typeof body === 'string' ? Buffer.from(body, 'latin1') : body,
      Buffer.from('\nendobj\n', 'latin1'),
    ]);
  };

  put(1, '<< /Type /Catalog /Pages 2 0 R >>');
  put(2, `<< /Type /Pages /Count ${pages.length} /Kids [${
    pages.map((_, i) => `${pageObj(i)} 0 R`).join(' ')} ] >>`);
  put(3, '<< /Type /Font /Subtype /Type1 /BaseFont /Courier /Encoding /WinAnsiEncoding >>');
  put(4, Buffer.concat([
    Buffer.from('<< /Title (', 'latin1'),
    pdfString(title),
    Buffer.from(') /Producer (Slippery) >>', 'latin1'),
  ]));

  pages.forEach((page, i) => {
    const top = A4_LANDSCAPE.h - MARGIN - fontSize;
    const head = Buffer.from(
      `BT\n/F1 ${fontSize} Tf\n${leading} TL\n${MARGIN} ${top} Td\n`,
      'latin1',
    );
    const body = page.map((line, j) => Buffer.concat([
      j === 0 ? Buffer.alloc(0) : Buffer.from('T*\n', 'latin1'),
      Buffer.from('(', 'latin1'),
      pdfString(line),
      Buffer.from(') Tj\n', 'latin1'),
    ]));
    const foot = footer
      ? Buffer.concat([
        Buffer.from(`ET\nBT\n/F1 ${Math.max(6, fontSize - 1)} Tf\n${MARGIN} ${MARGIN - 4} Td\n(`, 'latin1'),
        pdfString(footer(i + 1, pages.length)),
        Buffer.from(') Tj\n', 'latin1'),
      ])
      : Buffer.alloc(0);
    const stream = Buffer.concat([head, ...body, foot, Buffer.from('ET\n', 'latin1')]);

    put(pageObj(i), `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${A4_LANDSCAPE.w} ${A4_LANDSCAPE.h}] `
      + `/Resources << /Font << /F1 3 0 R >> >> /Contents ${streamObj(i)} 0 R >>`);
    put(streamObj(i), Buffer.concat([
      Buffer.from(`<< /Length ${stream.length} >>\nstream\n`, 'latin1'),
      stream,
      Buffer.from('endstream', 'latin1'),
    ]));
  });

  /*  The cross reference table is byte offsets into this exact file, so it is
   *  built while the file is, not guessed at afterwards. An xref that is one
   *  byte out is a file every reader refuses. */
  const header = Buffer.from('%PDF-1.4\n%\xe2\xe3\xcf\xd3\n', 'latin1');
  const chunks: Buffer[] = [header];
  const offsets: number[] = [];
  let at = header.length;
  const count = objects.length;
  for (let n = 1; n < count; n += 1) {
    offsets[n] = at;
    chunks.push(objects[n]);
    at += objects[n].length;
  }

  const xrefAt = at;
  const rows = [`xref\n0 ${count}\n`, '0000000000 65535 f \n'];
  for (let n = 1; n < count; n += 1) {
    rows.push(`${String(offsets[n]).padStart(10, '0')} 00000 n \n`);
  }
  chunks.push(Buffer.from(rows.join(''), 'latin1'));
  chunks.push(Buffer.from(
    `trailer\n<< /Size ${count} /Root 1 0 R /Info 4 0 R >>\nstartxref\n${xrefAt}\n%%EOF\n`,
    'latin1',
  ));

  return Buffer.concat(chunks);
}
