import Link from 'next/link';
import { Mark } from '@/components/Mark';
import { Wordmark, WORD_BOX, WORD_CAP } from '@/components/Wordmark';

/** The lockup, at the proportions the brand pack draws it.
 *
 *  WHY THIS EXISTS. The mark was size 26 and the wordmark height 17 in six
 *  separate files, and the two numbers had no relationship to each other
 *  beyond having been typed on the same day. public/lockup.svg is the
 *  authority, so it was rendered at full size and MEASURED rather than
 *  reasoned about, because the numbers in the file are about the icon TILE
 *  and the header has no tile: what has to line up here is the glyph.
 *
 *    S glyph        x 198 to 441, y 180 to 460   ->  281 tall
 *    wordmark cap   y 236 to 409                 ->  174 tall
 *    gap between    441 to 680                   ->  238 wide
 *
 *    cap / glyph = 174 / 281 = 0.619
 *    gap / glyph = 238 / 281 = 0.847
 *
 *  Both are then expressed against the Mark's BOX, which is what a caller
 *  passes, using the glyph's known place inside the 1024 viewBox: it runs
 *  153.09 to 870.91 vertically, so the glyph is 0.7010 of the box, and
 *  199.70 to 824.30 horizontally, so the box already carries 0.1950 of
 *  empty space to the right of the S. The wordmark's own left bearing
 *  (x 28 of a 983.9 by 285.4 box) comes off the gap too, which is why the
 *  CSS gap is barely a third of the optical one.
 *
 *  The shipped lockup had the word at 0.338 of the icon against a true
 *  0.434, so it was a fifth too small beside its own mark in every header,
 *  footer and sidebar on the site. One number goes in here now and the other
 *  two follow from it, which is the only way three numbers stay in a fixed
 *  ratio across six call sites. */

const GLYPH = 0.7010;          // the S's height as a fraction of the mark's box
const TRAIL = 0.1950;          // empty box to the right of the S
const CAP_ON_GLYPH = 0.619;    // measured
const GAP_ON_GLYPH = 0.847;    // measured

/** Wordmark box height that puts its cap at the measured ratio. */
const BOX_FROM_ICON = CAP_ON_GLYPH * GLYPH * (WORD_BOX.h / WORD_CAP);
/** Left bearing of the drawn word, as a fraction of its own box height. */
const WORD_BEARING = 28 / WORD_BOX.h;
/** CSS gap: the optical gap, less the space both boxes already contribute. */
const GAP_FROM_ICON = GAP_ON_GLYPH * GLYPH - TRAIL - WORD_BEARING * BOX_FROM_ICON;

export function Brand({
  size = 34, href = '/', word = true, className = 'brand', label = 'Slippery, home',
}: {
  /** The icon's edge in px. Everything else is derived from it. */
  size?: number;
  href?: string;
  word?: boolean;
  className?: string;
  /*  Two of these can be on one page, going to different places: the app's
      sidebar goes to the marketing home and its top bar goes to the
      dashboard. Two links with one name and two destinations is a real
      defect for anybody navigating by a list of links, and it is also what
      made a keyboard traversal look like it had wrapped after nine stops. */
  label?: string;
}) {
  return (
    <Link
      href={href}
      className={className}
      aria-label={label}
      style={{ gap: Math.round(size * GAP_FROM_ICON) }}
    >
      <Mark className="brand__mark" size={size} />
      {word ? <Wordmark height={Math.round(size * BOX_FROM_ICON)} /> : null}
      <span className="sr-only">{label}</span>
    </Link>
  );
}
