import { RowSpark } from '@/components/app/Charts';

/** A compact figure, with a shape beside it only where one is passed.
 *
 *  FOUR OF THESE REPLACED A HERO 234 PIXELS TALL. The dashboard opened with
 *  one figure at 34px, three small ones beside it and a scope bar, in a card
 *  that took a quarter of the screen to say one number.
 *
 *  NOW THERE ARE TWO OF THEM ON THE DASHBOARD AND NEITHER HAS A SHAPE IN IT.
 *  Turnover and Against the close are gone: the first is a denominator rather
 *  than an answer and is stated under every breakdown row that uses it, and
 *  the second printed a figure over a coverage caption on the minority of
 *  accounts that record a closing price at all. The sparkline went with them,
 *  because the module beside the two survivors now draws six labelled periods
 *  against a zero line: a 78 by 26 pixel line with no axis, no scale and no
 *  labels, beside a chart with all three, is the same fact drawn twice and
 *  only one of the two can be read. The prop stays because the demo page
 *  draws four tiles of its own and wants them.
 *
 *  EXACTLY ONE IS FILLED. The accent marks the figure the product is about,
 *  which is net profit and loss, and every other tile stays on the card
 *  ground. Two filled tiles would be two answers to "which number is the
 *  one", which is the same failure as eight figures at one size.
 *
 *  THE LINE IS NOT ALWAYS A RESULT COLOUR. Profit green and loss red mean
 *  money that has been won or lost. A running turnover is neither, so it
 *  draws in ink; a running return is a profit measure, so it draws in the
 *  colour of its own sign. */
export function Tile({
  label, value, sub, tone, spark, sparkTone, accent = false,
}: {
  label: string;
  value: string;
  sub: string;
  /** The figure's own colour. Never set on the filled tile: its ground is
   *  the accent and its ink is the one colour that reads on it. */
  tone?: '' | 'pos' | 'neg';
  spark?: number[];
  sparkTone?: 'pos' | 'neg' | 'ink';
  accent?: boolean;
}) {
  const shape = spark && spark.length > 1;
  return (
    <div className={`card tile col-3${accent ? ' tile--on' : ''}`}>
      <p className="label">{label}</p>
      <div className="tile__row">
        <p className={`fig fig--m tnum tile__v ${accent ? '' : (tone ?? '')}`}>{value}</p>
        {shape ? (
          <span className={`tile__spark${sparkTone === 'ink' ? ' tile__spark--ink' : ''}`}>
            <RowSpark values={spark} tone={sparkTone} width={78} height={26} />
          </span>
        ) : null}
      </div>
      <p className="small tile__sub">{sub}</p>
    </div>
  );
}
