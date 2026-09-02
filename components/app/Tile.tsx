import { RowSpark } from '@/components/app/Charts';

/** A compact figure with its own shape beside it.
 *
 *  FOUR OF THESE REPLACED A HERO 234 PIXELS TALL. The dashboard opened with
 *  one figure at 34px, three small ones beside it and a scope bar, in a card
 *  that took a quarter of the screen to say one number. The row says four,
 *  each with the line that got it there, in less height than the one did.
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
  spark: number[];
  sparkTone?: 'pos' | 'neg' | 'ink';
  accent?: boolean;
}) {
  return (
    <div className={`card tile col-3${accent ? ' tile--on' : ''}`}>
      <p className="label">{label}</p>
      <div className="tile__row">
        <p className={`fig fig--m tnum tile__v ${accent ? '' : (tone ?? '')}`}>{value}</p>
        <span className={`tile__spark${sparkTone === 'ink' ? ' tile__spark--ink' : ''}`}>
          <RowSpark values={spark} tone={sparkTone} width={78} height={26} />
        </span>
      </div>
      <p className="small tile__sub">{sub}</p>
    </div>
  );
}
