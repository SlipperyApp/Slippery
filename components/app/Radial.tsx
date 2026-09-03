/** A proportion, drawn as a ring with the figure inside it.
 *
 *  IT IS A SHARE AND NOT A SCORE. The arc is how much of the whole the
 *  figure is, so the only things that belong in one are numbers with a
 *  denominator: the win rate is wins over the bets that were decided, and
 *  the caption says both halves of that, because a rate with no denominator
 *  is the oldest way to make a record look like something it is not.
 *
 *  THE ACCENT, NEVER THE RESULT COLOURS. A win rate is not money. Painting
 *  the arc green would put the profit colour on a figure that says nothing
 *  about profit, and a 70% win rate at level stakes on odds-on shots is a
 *  losing account.
 *
 *  A RING, AND THE FIGURE SITS IN IT. It was a semicircle with the number
 *  under the arc and a caption under that, which is three stacked things in
 *  a card that is one row of a grid: the caption wrapped to three lines at
 *  1024 and the dial lost half its height to them. A closed ring holds its
 *  own figure in the middle, so the module is one shape with one number in
 *  it, and the denominator moves under the ring where it reads as the
 *  caption it is. The scale is unambiguous either way: zero is an empty ring
 *  and a hundred is a closed one. */

/** The circumference, so the dash offset is arithmetic rather than a guess.
 *  Two pi times 44. */
const R = 44;
const RING = 2 * Math.PI * R;

export function Radial({
  value, figure, caption, label,
}: {
  /** 0 to 100. Anything outside is clamped for the SHAPE only: the figure
   *  inside it is always the true one. */
  value: number;
  figure: string;
  caption: string;
  /** What a screen reader is told the ring is. */
  label: string;
}) {
  const share = Math.max(0, Math.min(100, value)) / 100;

  return (
    <div className="radial">
      <div className="radial__dial">
        <svg className="radial__svg" viewBox="0 0 104 104" role="img" aria-label={`${label}: ${figure}`}>
          {/*  Rotated so the arc starts at the top rather than at three
               o'clock, which is where a dasharray on a circle begins and is
               not where anybody reads a dial from. */}
          <g transform="rotate(-90 52 52)">
            <circle className="radial__track" cx="52" cy="52" r={R} />
            <circle
              className="radial__fill"
              cx="52" cy="52" r={R}
              style={{ strokeDasharray: RING, strokeDashoffset: RING * (1 - share) }}
            />
          </g>
        </svg>
        <p className="fig fig--m tnum radial__v">{figure}</p>
      </div>
      <p className="small dim radial__cap">{caption}</p>
    </div>
  );
}
