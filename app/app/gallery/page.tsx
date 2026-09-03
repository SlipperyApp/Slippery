import type { Metadata } from 'next';
import Link from 'next/link';
import { getViewer } from '@/lib/data/session';
import { SlipGallery } from '@/components/app/SlipGallery';
import { Icon } from '@/components/Icon';
import { Figure } from '@/components/app/Module';
import { slipStatus, IMAGE_RETENTION_DAYS } from '@/lib/domain/slip';
import { count, gap, plural } from '@/lib/format';

export const metadata: Metadata = {
  title: 'Slips',
  description: 'Every captured slip, newest first, with the bet it produced beside it.',
};

/** The slips, as a set.
 *
 *  The images are the proof behind every figure in this product and there was
 *  nowhere to look at them. A bet sheet could say what state its own slip was
 *  in; nothing could answer "which of my slips still exist", which is exactly
 *  the question a ninety day deletion makes somebody ask.
 *
 *  IT LISTS CAPTURED SLIPS ONLY. A bet typed in by hand is a first class bet
 *  and it is not a slip, so putting it here as an empty tile would turn a
 *  gallery of evidence into a second copy of the ledger with the evidence
 *  missing from most of it. The ledger says which bets are typed in, and the
 *  count below says how many are left out and why. */
export default async function Gallery() {
  const { data, now, source } = await getViewer();
  const { account, bets } = data;

  const captured = bets
    .filter((b) => slipStatus(b, now).state !== 'imported' && slipStatus(b, now).state !== 'typed')
    .sort((a, b) => Date.parse(b.placedAt) - Date.parse(a.placedAt));

  const held = captured.filter((b) => slipStatus(b, now).state === 'held').length;
  const unstored = captured.filter((b) => slipStatus(b, now).state === 'unstored').length;
  const expired = captured.length - held - unstored;
  const withoutSlips = bets.length - captured.length;

  /*  HOW EARLY THEY WERE CAUGHT, which is the one thing this page can prove.
      Capture at placement is the whole product, and the page that ought to
      demonstrate it was showing a hundred and sixty one identical grey cards
      instead. Every one of these was on the record before the event started,
      and the median says by how long. */
  const leads = captured
    .map((b) => Date.parse(b.eventAt) - Date.parse(b.placedAt))
    .filter((ms) => ms > 0)
    .sort((a, b) => a - b);
  const median = leads.length ? leads[Math.floor(leads.length / 2)] : 0;
  const beforeOff = captured.filter((b) => Date.parse(b.placedAt) < Date.parse(b.eventAt)).length;

  return (
    <>
      <div className="spread" style={{ marginBottom: 'var(--gap-block)', flexWrap: 'wrap' }}>
        <h1>Slips</h1>
        <div className="row row--wrap" style={{ gap: 'var(--s3)' }}>
          <Link href="/app/ledger" className="btn btn--quiet btn--sm">
            <Icon name="bets" size={16} /> Ledger
          </Link>
          <Link href="/app/import" className="btn btn--primary btn--sm">
            <Icon name="plus" size={16} /> Add a bet
          </Link>
        </div>
      </div>

      {/*  THREE FIGURES THIS PAGE CAN PROVE, before the grid: how many of
           these slips were on the record before the event started, by how
           long in the middle case, and how many bets never had a slip.

           THE THREE CAPTIONS UNDER THEM ARE GONE. "A bet recorded after the
           start is not a prediction" reads as a verdict on a bet somebody is
           allowed to send, and Slippery takes a bet at any time: how far
           ahead of its own kick off a slip landed is a fact about that slip,
           which is what the figure states and what every tile below repeats.
           "The middle slip, not the average, which one early slip would move"
           explained the product's choice of a median to somebody reading a
           duration. State the number and stop. */}
      <div className="figstrip slipstats">
        <Figure
          value={`${count(beforeOff)} of ${count(captured.length)}`}
          label="On the record before the off"
          size="md"
        />
        <Figure
          value={median > 0 ? gap(new Date(0), new Date(median)) : 'None yet'}
          label="Typical head start"
          size="md"
        />
        <Figure
          value={count(withoutSlips)}
          label="Bets with no slip"
          size="md"
          sub="Typed in or imported"
        />
      </div>

      {/*  The counts, and the reason the two numbers differ. A grid that
           silently held fewer tiles than the ledger holds bets is a page
           somebody would report as losing their bets. */}
      <p className="small muted" style={{ marginBottom: 'var(--gap-block)', maxWidth: '62ch' }}>
        {/*  "newest first" went with the ledger's sort instruction. The order
             of a grid is visible in the grid, and a line telling somebody how
             a list is sorted is the product narrating itself. */}
        {plural(captured.length, 'captured slip')}.{' '}
        {/*  THE EXAMPLE ACCOUNT IS GENERATED, so it has no slips behind its
             slips. Every tile here used to read "Image held" with a ninety
             day countdown, which was the product describing a file that had
             never existed on any deployment. */}
        {source === 'example' && unstored === captured.length
          ? 'These bets were generated as an example, so there is no image behind any of them. Your own slips show the screenshot they were read from. '
          : null}
        {held > 0
          ? `${held} still have an image, inside the ${IMAGE_RETENTION_DAYS} day retention window. `
          : ''}
        {expired > 0
          ? `${expired} were removed, on request or on the ${IMAGE_RETENTION_DAYS} day schedule, which each tile says rather than showing a broken thumbnail. `
          : ''}
        {/*  A CLAIM THIS PAGE USED TO MAKE ABOUT EVERY TILE ON IT. Each one
             read "Image held" with a countdown, worked out from the bet's
             date, over a store that held nothing at all. A bet with no image
             behind it now says so, which is the only honest thing to print
             about evidence that does not exist. */}
        {unstored > 0 && !(source === 'example' && unstored === captured.length)
          ? `${unstored} came from a slip whose image was never stored, so there is nothing to show for ${unstored === 1 ? 'it' : 'them'} and nothing to delete. `
          : ''}
        {/*  THE BETS WITH NO SLIP ARE THE THIRD FIGURE ABOVE, with the same
             reason under them in the same words. A caption that restates the
             figure it is under is one thing; a sentence four inches lower
             restating a caption is another, and this page had both. */}
      </p>

      {/*  THE GRID SCROLLS AND THE THREE FIGURES ABOVE IT DO NOT. Measured
           at 1440 by 900 this page was 2,186 pixels against the 824 the
           window leaves, so how many slips landed before the off went off
           the top of the screen at the first flick through the slips it is
           counting. */}
      <div className="fitcol fitcol--scroll">
        <SlipGallery
          bets={captured}
          currency={account.currency}
          oddsFormat={account.oddsFormat}
          tz={account.timeZone}
          now={now.toISOString()}
        />
      </div>
    </>
  );
}
