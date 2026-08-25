/* 19 · ONE PIECE OF ARTWORK, AT EVERY SIZE.
 *
 * The product had three different marks and none of them was a calendar:
 * `public/icon.svg` a stroked "S", the in-app MARK a different filled "S",
 * and the OG image a plain gradient square with no glyph at all. Meanwhile
 * the calendar — the most distinctive and most recognisable thing Slippery
 * draws — was buried as one module of twelve.
 *
 * This is the month grid as a pure SVG string, so the icon, the favicon, the
 * OG image and the share card are all the same artwork rather than three
 * marks that happen to ship together.
 *
 * BELOW 32px IT CHANGES SHAPE. Seven columns of 2px cells is mud at favicon
 * size, so the small cut drops to three columns and two colours. That is a
 * different drawing of the same idea, which is the point of having one place
 * to decide it.
 */

/* A real month, so the shape is the product's own rather than invented:
   August 2026, the month the demo data covers. null is a day with no bets. */
export const MONTH = [
  186, null, -58, null, 264, null, -96, 64, null, 212, null, -74, 148, null,
  -41, 238, null, 229, 112, null, null, null, null, null, null, null, null, null,
];

export const INK = {
  bg: '#0C0E13',
  empty: '#272A34',
  pos: '#7FE3A6',
  neg: '#F5A3A3',
  text: '#E6EBF3',
  muted: '#7A8598',
};

/* Intensity carries magnitude, exactly as the calendar module does — a flat
   tint made +£264 and +£64 the same green and the month had no shape until
   you read every number. */
function alpha(v, max) {
  return Math.min(1, Math.abs(v) / max) * 0.62 + 0.16;
}

export function calendarGrid({ size = 512, cols = 7, days = 28, pad = 0.14, radius = 0.28 } = {}) {
  const cells = MONTH.slice(0, days);
  const max = Math.max(...cells.filter((v) => v != null).map(Math.abs), 1);
  const rows = Math.ceil(cells.length / cols);
  const inset = size * pad;
  const gap = size * 0.018;
  /* SQUARE CELLS. Sizing height by the row count and width by the column
     count made every cell a tall rectangle whenever the two differed — four
     rows of seven came out as bars rather than a calendar. A day is a square;
     the grid's height is whatever that adds up to. */
  const cw = (size - inset * 2 - gap * (cols - 1)) / cols;
  const ch = cw;
  const r = cw * radius;

  /* CENTRED, both ways. The grid's height is the row count times a square
     cell, which is almost never the same as its width — at seven columns of
     four rows it filled the top half of the icon and left the bottom empty. */
  const gridH = rows * ch + (rows - 1) * gap;
  const top = (size - gridH) / 2;

  const rects = cells.map((v, i) => {
    const x = inset + (i % cols) * (cw + gap);
    const y = top + Math.floor(i / cols) * (ch + gap);
    const on = v != null;
    const fill = on ? (v > 0 ? INK.pos : INK.neg) : INK.empty;
    const op = on ? alpha(v, max).toFixed(3) : '1';
    return `<rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${cw.toFixed(2)}" `
      + `height="${ch.toFixed(2)}" rx="${r.toFixed(2)}" fill="${fill}" opacity="${op}"/>`;
  }).join('');

  return { rects, inset, cw, ch, gap, rows };
}

/* THE APP ICON. A rounded square of background with the grid inside it. */
export function iconSvg(size = 512) {
  /* Under 32px, seven columns of sub-2px cells stop being a grid and become
     noise, so the small cut is three columns of four and drops the loss
     colour: at that size the only job is to be recognisable in a tab strip. */
  const small = size < 32;
  /* FIVE COLUMNS FOR THE ICON, not seven. Seven of four is a wide strip in a
     square frame; five of five is the same calendar reading as a block. The
     OG image keeps seven, because there the shape is a real month beside
     text and the width is doing work. */
  const { rects } = small
    ? calendarGrid({ size, cols: 3, days: 9, pad: 0.20, radius: 0.24 })
    : calendarGrid({ size, cols: 5, days: 25, pad: 0.16 });
  const corner = size * 0.22;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">`
    + `<rect width="${size}" height="${size}" rx="${corner.toFixed(2)}" fill="${INK.bg}"/>`
    + rects
    + `</svg>`;
}

/* MASKABLE. Android crops to a circle inscribed in the middle 80%, so the
   grid has to sit inside that safe zone or the corners get cut off. */
export function maskableSvg(size = 512) {
  const { rects } = calendarGrid({ size, cols: 7, days: 28, pad: 0.22 });
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">`
    + `<rect width="${size}" height="${size}" fill="${INK.bg}"/>${rects}</svg>`;
}

export function ogSvg({ width = 1200, height = 630 } = {}) {
  const { rects } = calendarGrid({ size: 470, cols: 7, days: 28, pad: 0.02 });
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
  <rect width="${width}" height="${height}" fill="${INK.bg}"/>
  <text x="72" y="112" font-family="Schibsted Grotesk,Helvetica,Arial,sans-serif"
    font-size="40" font-weight="800" letter-spacing="-1" fill="${INK.text}">SLIPPERY</text>
  <text x="72" y="158" font-family="Schibsted Grotesk,Helvetica,Arial,sans-serif"
    font-size="22" fill="${INK.muted}">Bet tracking for UK and Irish bettors</text>
  <text x="72" y="336" font-family="Schibsted Grotesk,Helvetica,Arial,sans-serif"
    font-size="112" font-weight="800" letter-spacing="-4" fill="${INK.pos}">+18.4u</text>
  <text x="72" y="382" font-family="Schibsted Grotesk,Helvetica,Arial,sans-serif"
    font-size="24" fill="${INK.muted}">August · 96 bets · League One</text>
  <text x="72" y="566" font-family="Schibsted Grotesk,Helvetica,Arial,sans-serif"
    font-size="20" fill="${INK.muted}">slippery.app</text>
  <text x="${width - 72}" y="566" text-anchor="end"
    font-family="Schibsted Grotesk,Helvetica,Arial,sans-serif" font-size="20" fill="${INK.muted}">18+</text>
  <g transform="translate(${width - 542} 80)">${rects}</g>
</svg>`;
}
