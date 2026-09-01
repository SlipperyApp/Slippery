/** The mark, as data, because three surfaces have to draw the same one.
 *
 *  Everywhere the browser renders HTML, the mark is public/icon.svg. The two
 *  places that cannot load an SVG file are the two generated images:
 *  /api/share and /og both go through Satori, which draws a subset of CSS and
 *  no external file, so each has to rebuild the mark out of divs.
 *
 *  They had rebuilt it differently. The share card drew a five by five grid
 *  of a pattern nobody had checked against the icon, and /og drew three
 *  rounded squares in a row, which is not the mark at all. So the largest,
 *  most shared surface the product has carried a logo the product does not
 *  use.
 *
 *  This is the grid the icon actually contains, and a test parses
 *  public/icon.svg and asserts they still agree. Change the icon and the test
 *  tells you which of the two images went stale.
 *
 *    p  the profit colour        n  the loss colour        space  the ground
 */
export const MARK_GRID = [
  'p n p',
  ' np p',
  ' np n',
  'p pp ',
  '     ',
] as const;

/** The opacity of each cell, in the same order. The icon is not a flat
 *  pattern: the coloured squares sit at a range of opacities, which is what
 *  keeps it from reading as a checkerboard. */
export const MARK_ALPHA = [
  [0.597, 1, 0.296, 1, 0.78],
  [1, 0.385, 0.31, 1, 0.658],
  [1, 0.334, 0.508, 1, 0.256],
  [0.719, 1, 0.698, 0.423, 1],
  [1, 1, 1, 1, 1],
] as const;

/** The three colours in the icon file, which are NOT the two locked semantic
 *  colours: the mark is a mark, and it uses its own softer pair so that a
 *  logo is never mistaken for a result. */
export const MARK_POS = '#7FE3A6';
export const MARK_NEG = '#F5A3A3';
export const MARK_GROUND = '#272A34';
