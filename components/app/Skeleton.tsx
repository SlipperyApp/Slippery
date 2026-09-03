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
 *  the real component's own classes, tile and card col-5 and grid dash, so
 *  the placeholder is laid out by the same rules as the answer and cannot
 *  drift away from it when those rules change. An earlier draft picked a
 *  height token for the hero because it looked about right: measured, it was
 *  408px against the real 263, so the calendar row dropped 145px and jumped
 *  back the moment the data landed. A skeleton that moves the page is worse
 *  than no skeleton.
 *
 *  The dashboard is now sized from the WINDOW rather than from height
 *  tokens, which is what makes this exact for the first time: .dash gives
 *  the three rows their heights, so the placeholder and the page it stands
 *  in for are the same three rows whatever the window is.
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

/** One tile, in the tile's own classes so its height follows the real one.
 *  The label, the figure and the caption are the three lines a tile has. */
function TileBlock({ w }: { w: string }) {
  return (
    <div className="card tile col-3 skel__b">
      <Bar w="46%" h={11} />
      <div className="tile__row">
        <Bar w={w} h={24} />
        <span className="tile__spark"><Bar w="78px" h={26} /></span>
      </div>
      <Bar w="58%" h={12} />
    </div>
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
          /*  THE SHAPE OF THE DASHBOARD THAT IS COMING, and it was the shape
               of the one before it: four tiles, a wide block, two thirds and
               then a calendar row, which is nine cards over four rows against
               the seven over three the page has had since the overhaul. .dash
               gives three rows their heights, so a fourth had nowhere to go
               and the placeholder measured 1,135 pixels at 1440 by 900 for a
               page that fits 824. A loading state a different height from the
               page it stands in for moves everything the moment it is
               replaced, which is the one thing it exists to prevent. */
          <div className="grid dash">
            {['58%', '64%'].map((w) => <TileBlock key={w} w={w} />)}
            <div className="card col-6 skel__b"><Head /><Bar w="100%" h="58%" /></div>
            <div className="card col-5 skel__b"><Head /><CalendarBlock /></div>
            <div className="card col-7 skel__b"><Head /><Rows n={4} /></div>
            <div className="card col-8 skel__b"><Head /><Bar w="100%" h="52%" /></div>
            <div className="card col-4 skel__b"><Head /><Bar w="100%" h="52%" /></div>
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
