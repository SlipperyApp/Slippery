/** A proportion, drawn as a dial.
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
 *  A semicircle rather than a ring: the two ends are the two ends of the
 *  scale, so zero and one hundred are places on the shape rather than a
 *  ring that looks the same at either. */

/** The arc's length, so the dash offset is arithmetic rather than a guess.
 *  Radius 52 over half a turn: pi times 52. */
const ARC = Math.PI * 52;

export function Radial({
  value, figure, caption, label,
}: {
  /** 0 to 100. Anything outside is clamped for the SHAPE only: the figure
   *  beside it is always the true one. */
  value: number;
  figure: string;
  caption: string;
  /** What a screen reader is told the dial is. */
  label: string;
}) {
  const share = Math.max(0, Math.min(100, value)) / 100;

  return (
    <div className="radial">
      <div className="radial__dial">
        <svg className="radial__svg" viewBox="0 0 120 64" role="img" aria-label={`${label}: ${figure}`}>
          <path className="radial__track" d="M8 58 A52 52 0 0 1 112 58" />
          <path
            className="radial__fill"
            d="M8 58 A52 52 0 0 1 112 58"
            style={{ strokeDasharray: ARC, strokeDashoffset: ARC * (1 - share) }}
          />
        </svg>
        <p className="fig tnum radial__v">{figure}</p>
      </div>
      <p className="small dim radial__cap">{caption}</p>
    </div>
  );
}
