/** What the app shows while the next page is being fetched.
 *
 *  WHAT WAS HERE: nothing. There was no loading.tsx anywhere in the tree, so
 *  a tap on Ledger sat on the previous page: unchanged,
 *  unmarked, with the old figures still on screen, until Postgres came back. On a cold function
 *  with a round trip to the database that is most of a second in which the
 *  only honest reading of the screen is "your tap did nothing", and the
 *  second tap is the one that makes it feel broken.
 *
 *  So this is the one place in the product where an animation is not
 *  decoration: it is the answer to "did that work". It runs only while
 *  something is genuinely in flight and it ends by being replaced, so it can
 *  neither loop at you nor outlive its reason.
 *
 *  THE SHAPE IS THE POINT, AND IT IS BORROWED, NOT COPIED. Every block wears
 *  the real component's own classes, hero-net and hero-net__fig and card
 *  col-7 h-xl, so the placeholder is laid out by the same rules as the answer and
 *  cannot drift away from it when those rules change. The first draft used
 *  h-l for the hero because it looked about right: measured, it was 408px
 *  against the real 263, so the calendar row would have dropped 145px and
 *  then jumped back up the moment the data landed. A skeleton that moves the
 *  page is worse than no skeleton.
 *
 *  The hero is the one block that cannot be exact, and it is worth saying
 *  why rather than tuning it until one screenshot agrees. The real hero
 *  carries a target bar only when the account has set a target, so it is
 *  263px tall with one and about 223 without, and nothing on the wire yet
 *  says which this account is. This matches the no-target case, which is
 *  what a new account is and therefore what a first load is most likely to
 *  become. Every other block here is exact.
 *
 *  ONE ANNOUNCEMENT, NOT FIFTY. The whole tree is aria-hidden and a single
 *  polite live region says "Loading". A screen reader should hear that the
 *  page is coming, not read out forty placeholder rectangles. */

function Bar({ w = '100%', h = 12, mt = 0 }: { w?: string; h?: number | string; mt?: number }) {
  return <span className="skel__bar" style={{ width: w, height: h, marginTop: mt }} />;
}

function Head() {
  return <div className="skel__head"><Bar w="38%" h={14} /></div>;
}

function Rows({ n }: { n: number }) {
  return (
    <div className="skel__rows">
      {Array.from({ length: n }, (_, i) => (
        <div key={i} className="skel__row">
          <span className="skel__grow">
            <Bar w={`${72 - (i % 3) * 14}%`} h={13} />
            <Bar w={`${52 - (i % 4) * 9}%`} h={10} mt={8} />
          </span>
          <Bar w="64px" h={16} />
        </div>
      ))}
    </div>
  );
}

/** The hero, in its own classes so its height follows the real one. */
function HeroBlock() {
  return (
    <section className="card col-12 hero-net skel__b">
      <div className="hero-net__head">
        <Bar w="132px" h={13} />
        {/* the ⋯ and share controls, which set the head's real height */}
        <Bar w="28px" h={25} />
      </div>
      {/*  1em inside .hero-net__fig, so the bar is exactly as tall as the
           figure it stands in for at every width the clamp passes through. */}
      <div className="hero-net__fig"><Bar w="42%" h="1em" /></div>
      {/*  A baseline row of label + figure, five across, exactly as the real
           stats are: measured at 20px tall, against 24 when they stacked. */}
      <ul className="hero-net__stats">
        {[52, 44, 56, 62, 40].map((w, i) => (
          <li key={w}>
            <Bar w={`${w}px`} h={11} />
            <Bar w={`${44 + (i % 3) * 12}px`} h={13} />
          </li>
        ))}
      </ul>
      <div className="scopebar"><Bar w="332px" h={54} /><Bar w="178px" h={54} /><Bar w="142px" h={54} /></div>
    </section>
  );
}

/** A month at the calendar's own proportions, which is to say, IN the
 *  calendar's own classes.
 *
 *  The first version was a hand-built 7 by 5 grid with a min-height on the
 *  cells, and it was wrong at both ends: 71px cells against the real 51 on a
 *  desktop, and 2px cells against the real 13 on a phone, because the real
 *  grid is a flex child inside a fixed-height card at one width and content
 *  height at the other. Rather than reproduce that rule, this wears it:
 *  calwrap, cal__ctl, cal and cal__foot are the calendar's own, so the
 *  placeholder is laid out by the same CSS as the month it stands in for. */
function CalendarBlock() {
  return (
    <div className="calwrap">
      <div className="cal__ctl">
        <span className="cal__nav"><Bar w="24px" h={24} /><Bar w="96px" h={12} /><Bar w="24px" h={24} /></span>
      </div>
      <div className="cal" style={{ ['--cal-rows' as string]: 5 }}>
        {Array.from({ length: 7 }, (_, i) => <span key={`d${i}`} className="cal__dow"><Bar w="10px" h={9} /></span>)}
        {/*  Each cell carries the same .cal__n a real one does, holding a
             non-breaking space. On a desktop the card has a fixed height and
             the rows divide it, so this changes nothing; on a phone the card
             is content-height and an empty cell collapsed to 2px against the
             real 13. The line box is the height, so the placeholder borrows
             the line box rather than guessing at thirteen pixels. */}
        {Array.from({ length: 35 }, (_, i) => (
          <span key={i} className="cal__cell skel__cell"><span className="cal__n">{'\u00a0'}</span></span>
        ))}
      </div>
      <div className="cal__foot"><Bar w="180px" h={11} /></div>
    </div>
  );
}

export type SkeletonShape = 'dashboard' | 'list' | 'page';

export function Skeleton({ shape = 'page' }: { shape?: SkeletonShape }) {
  return (
    <>
      {/*  role=status is polite by default: it does not interrupt whatever the
           reader is already saying, which on a navigation is usually the link
           that was just activated. */}
      <p className="sr-only" role="status">Loading</p>
      <div className="skel" aria-hidden="true">
        {shape === 'dashboard' ? (
          <div className="grid">
            <HeroBlock />
            <div className="card col-7 h-xl skel__b"><Head /><CalendarBlock /></div>
            <div className="card col-5 h-xl skel__b"><Head /><Rows n={6} /></div>
          </div>
        ) : shape === 'list' ? (
          <div className="grid">
            <div className="card col-12 skel__b"><Head /><Rows n={8} /></div>
          </div>
        ) : (
          <div className="grid">
            <div className="card col-12 skel__b"><Head /><Rows n={4} /></div>
          </div>
        )}
      </div>
    </>
  );
}
