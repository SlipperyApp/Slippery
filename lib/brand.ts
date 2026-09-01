/** The mark, as the paths the icon file actually contains.
 *
 *  Everywhere the browser renders HTML the mark is inlined by
 *  components/Mark.tsx, which takes the theme colour. The two generated
 *  images cannot: /api/share and /og go through Satori, which loads no
 *  external file and resolves no custom property, so both draw the mark from
 *  here in its fixed colours.
 *
 *  Before this they drew two DIFFERENT approximations of a mark that no
 *  longer exists: a five by five grid of coloured squares, and, on /og, three
 *  rounded squares in a row. A test parses public/app-icon.svg and asserts
 *  these paths still match it, so a redrawn icon names which image went
 *  stale instead of quietly disagreeing.
 *
 *  THE DIAGONAL is a clip path, not a second glyph: the same outline is drawn
 *  twice, once in ink and once in the accent, and the accent copy is cut by a
 *  rotated rectangle. Do not re split it per letter. */

export const MARK_TILE = '#0A0C10';
export const MARK_INK = '#E6EBF3';
export const MARK_ACCENT = '#A8C2E8';

/** viewBox 0 0 1024 1024. */
export const MARK_CLIP = "M2461.7 -1908.8 L-1320.9 2932.8 L1099.8 4824.1 L4882.4 -17.5 Z";
export const MARK_PATH = "M520.56 870.91Q443.20 870.91 374.71 848.40Q306.23 825.89 259.30 778.33Q212.38 730.77 199.70 654.68L372.18 620.43Q377.88 678.14 413.08 707.63Q448.27 737.11 513.59 737.11Q576.36 737.11 606.80 712.06Q637.24 687.02 637.24 653.41Q637.24 623.61 613.46 602.05Q589.68 580.48 531.34 571.61L469.20 561.46Q432.42 555.75 390.88 545.93Q349.35 536.10 312.57 516.12Q275.79 496.15 252.33 460.64Q228.87 425.13 228.87 369.32Q228.87 301.47 265.33 252.96Q301.79 204.45 366.47 178.77Q431.15 153.09 514.22 153.09Q590.95 153.09 654.36 175.60Q717.77 198.11 760.58 241.55Q803.38 284.98 816.06 349.03L643.58 384.54Q639.14 358.54 626.78 335.71Q614.41 312.89 589.05 298.62Q563.68 284.35 520.56 284.35Q471.73 284.35 442.88 303.37Q414.03 322.40 414.03 355.37Q414.03 379.47 430.20 394.69Q446.37 409.91 474.59 419.10Q502.81 428.30 538.32 434.64L609.34 446.69Q663.87 455.56 713.02 477.44Q762.16 499.32 793.23 539.90Q824.30 580.48 824.30 646.43Q824.30 719.36 784.67 769.45Q745.04 819.55 676.24 845.23Q607.44 870.91 520.56 870.91Z";
