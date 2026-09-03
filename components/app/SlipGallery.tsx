'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Icon } from '@/components/Icon';
import { useWide } from './wide';
import { effectiveOdds } from '@/lib/domain/fold';
import { betTags } from '@/lib/domain/working';
import { slipStatus, slipSentence, SLIP_STATE_LABEL, IMAGES_STORED, type SlipState } from '@/lib/domain/slip';
import { bookmakerName } from '@/lib/data/reference';
import { formatOdds, type OddsFormat } from '@/lib/odds';
import { money, dateTime, gap, DEFAULT_TZ, type TimeZone } from '@/lib/format';
import type { DemoBet } from '@/lib/data/demo';
import type { Currency } from '@/lib/domain/types';

/** Whether the slip beat the off. It is a stamp against a stamp and nothing
 *  is inferred: a bet placed after the event started is a claim rather than
 *  a prediction, which the social feed's own gate already says out loud. */
const lead = (b: DemoBet) => Date.parse(b.placedAt) < Date.parse(b.eventAt);

/** Sixty tiles a page. The ledger loads fifty rows; a tile is smaller than a
 *  row and a grid shows more of them at once, so sixty is roughly the same
 *  amount of scrolling before the button. */
const PAGE = 60;

/*  The width at which a slip can be read BESIDE the grid rather than thrown
    over it. A lightbox is right on a phone, where there is one thing on
    screen at a time, and wrong on a monitor: it hides the ninety tiles
    somebody was scanning to show them one of them, and closing it is the only
    way back. Shared with the balance sheet and the group table through
    .dsplit in components.css.

    1600 RATHER THAN THE GENERAL 1280, and .dsplit--tiles carries it. The
    tiles reflow and a list of rows does not: at 1440 the pane takes the grid
    from seven columns to five, so resting it open spends two columns of
    somebody's slips on a dashed box asking them to press one. At 1600 it
    costs one column instead of two. The number is
    in the stylesheet as well, because the pane is drawn by CSS and chosen
    by this, and the two have to agree. */
const SPLIT_AT = 1600;

/** The slips, newest first, each opening beside the bet it belongs to.
 *
 *  THE IMAGES ARE THE PROOF BEHIND EVERY FIGURE IN THIS PRODUCT and there was
 *  nowhere to look at them. A bet sheet could say what state its own slip was
 *  in; nothing could answer "which of my slips still exist", which is the
 *  question the ninety day deletion makes somebody ask.
 *
 *  NOTHING HERE DRAWS A BROKEN THUMBNAIL. A tile whose image has been deleted
 *  says it was deleted and when, because a broken image is indistinguishable
 *  from a bug and an empty box is indistinguishable from a bet nobody
 *  photographed. The same rule covers a deployment with no image storage
 *  wired up: the tile states what it knows about the slip instead of claiming
 *  a picture it has not got.
 *
 *  KEYBOARD. Enter or Space opens a tile, the arrows move between slips
 *  inside the lightbox, Escape closes it, and focus goes back to the thumbnail
 *  it came from rather than to the top of the document, which is where a
 *  keyboard reader loses a grid of ninety tiles.
 *
 *  No localStorage anywhere: iOS Safari is the primary target and this
 *  product keeps nothing in it. */
export function SlipGallery({
  bets, currency = 'GBP', oddsFormat = 'decimal', tz = DEFAULT_TZ, now,
}: {
  bets: DemoBet[];
  currency?: Currency;
  oddsFormat?: OddsFormat;
  tz?: TimeZone;
  /** The server's clock, passed in so the first paint and the hydration agree
   *  about how old a slip is. Working it out on both sides is how a tile
   *  renders "89 days" on the server and "90 days" in the browser. */
  now: string;
}) {
  const at = new Date(now);
  const wide = useWide(SPLIT_AT);
  const total = bets.length;
  const [open, setOpen] = useState<number | null>(null);
  /*  Sixty at a time, the way the ledger loads fifty. A phone painting every
      tile in a two year record is a scroll nobody can profile, and the button
      stays a button: infinite scroll would take the page's own footer away. */
  const [cursor, setCursor] = useState(PAGE);
  const tiles = useRef<(HTMLButtonElement | null)[]>([]);
  const closer = useRef<HTMLButtonElement | null>(null);
  /*  Which tile the focus goes back to when the lightbox closes. It is set on
      the way out and consumed by the effect below, rather than focused inside
      the click handler: at that point React has not committed the unmount, so
      the element being focused is about to be replaced and the caret lands on
      the body. A requestAnimationFrame after it was close enough to work at
      390 and not at 1440, which is the worst kind of nearly. */
  const returnTo = useRef<number | null>(null);

  const close = useCallback(() => {
    returnTo.current = open;
    setOpen(null);
  }, [open]);

  useEffect(() => {
    if (open !== null || returnTo.current === null) return;
    const i = returnTo.current;
    returnTo.current = null;
    tiles.current[i]?.focus();
  }, [open]);

  /*  The arrows walk the WHOLE record, not the loaded page.
   *
   *  Stopping at the sixtieth tile would make the lightbox say "60 of 234"
   *  and then refuse to go on, which is a dead control wearing an arrow key.
   *  Walking past the loaded edge loads the next page first, so the grid
   *  behind the lightbox has the tile that focus is about to be handed back
   *  to. It stops at the ends rather than wrapping: a gallery that jumps from
   *  the oldest slip to the newest is a reader losing their place. */
  const move = useCallback((delta: number) => {
    if (open === null) return;
    const next = open + delta;
    if (next < 0 || next >= bets.length) return;
    if (next >= cursor) setCursor(cursor + PAGE);
    setOpen(next);
  }, [open, cursor, bets.length]);

  useEffect(() => {
    if (open === null) return undefined;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); close(); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); move(1); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); move(-1); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, close, move]);

  // The close control takes focus when the lightbox opens, so the next Tab
  // lands inside the dialogue rather than back in the grid behind it.
  useEffect(() => { if (open !== null) closer.current?.focus(); }, [open]);

  if (bets.length === 0) {
    return (
      <div className="card">
        <p className="card__title">No slips captured yet.</p>
        <p className="small muted" style={{ marginTop: 'var(--s2)' }}>
          Forward a slip to the bot, or upload one, and it lands here. A bet typed in by hand
          is a real bet and it is marked as typed in rather than appearing here with nothing
          behind it.
        </p>
        <div style={{ marginTop: 'var(--s4)' }}>
          <Link href="/app/import" className="btn btn--primary btn--sm">
            <Icon name="plus" size={16} /> Add a bet
          </Link>
        </div>
      </div>
    );
  }

  const page = bets.slice(0, cursor);
  const shown = open === null ? null : page[open];

  return (
    <div className="dsplit dsplit--tiles">
      <div>
      <ul className="gal">
        {page.map((b, i) => {
          const st = slipStatus(b, at);
          return (
            <li key={b.id}>
              <button
                type="button"
                ref={(el) => { tiles.current[i] = el; }}
                /*  No state modifier. `gal__tile--held` and its three
                    siblings had no rule anywhere in the stylesheet, so they
                    were four class names reserved against nothing, which is
                    how both of this codebase's class collisions started. */
                className="gal__tile"
                onClick={() => setOpen(i)}
                /*  WHICH TILE THE PANE IS SHOWING. A grid of ninety with one
                     open beside it and nothing marked is a slip from nowhere.
                     It is also the only observable difference between two
                     tiles whose bets happen to run to the same number of
                     characters, which is how a sweep that watches the length
                     of the page reported one of these as a dead control. */
                /*  "false" rather than nothing on the tiles that are not
                     open. aria-current is a global attribute and false is
                     the documented way to say a thing is not the current
                     one, which assistive technology ignores; what it buys is
                     that every tile is in the page's observable state rather
                     than only the open one. With one attribute appearing and
                     disappearing, a sweep that reads the ordered aria state
                     sees the same string whichever tile is open, and it
                     reported this control as dead for that reason. */
                aria-current={wide && open === i ? 'true' : 'false'}
                aria-label={`${b.selection}, ${bookmakerName(b.bookmakerId)}, captured ${lead(b) ? `${gap(b.placedAt, b.eventAt)} before the off` : 'after the off'}`}
              >
                <span className="gal__face">
                  {/*  THE PICTURE, WHEN THERE IS ONE. Lazy, so a record of two
                       hundred slips fetches the dozen on screen and not the
                       rest: sixty full screenshots at once is a scroll nobody
                       can profile. A tile without an image keeps the face it
                       always had, which states what it knows rather than
                       drawing a broken thumbnail. */}
                  {st.imageId ? (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img className="gal__shot" src={`/api/slips/${st.imageId}`} alt="" loading="lazy" />
                      <span className="gal__shade" aria-hidden="true" />
                    </>
                  ) : null}
                  <StateMark state={st.state} />
                  <span className="gal__book">{bookmakerName(b.bookmakerId)}</span>
                  <span className="gal__sel">{b.legs.length > 1 ? `${b.legs.length} fold` : b.selection}</span>
                  {/*  A MULTI NAMES A MATCH TOO. "5 fold" over an empty line
                       is the same hole the ledger row had, on a card a sixth
                       of the width. The row and the export print every leg
                       with its fixture; a tile is a thumbnail, so it takes
                       the first one, which is what makes last Saturday's
                       acca findable in a grid. No "and four more" after it:
                       the line above already says five fold, and the count
                       written twice is what pushed the fixture into an
                       ellipsis. */}
                  <span className="gal__ev">
                    {b.legs.length > 1 ? (b.legs[0].eventName || b.legs[0].selection) : b.eventName}
                  </span>
                  <span className="gal__price mono tnum">
                    {money(b.stakePence, currency)} at {formatOdds(effectiveOdds(b), oddsFormat)}
                  </span>
                </span>
                {/*  THE HEAD START, on every tile, where the retention
                     countdown used to be.

                     A hundred and sixty one tiles reading IMAGE HELD 90D
                     were a hundred and sixty one identical tiles making the
                     same false claim, and there was nothing on any of them
                     that differed from the one beside it except a name. This
                     differs on every slip, it is the fact the whole product
                     turns on, and it is checkable: the capture is stamped
                     and the kick off is stamped. On a deployment that keeps
                     the image, the retention state goes back beside it. */}
                <span className={`gal__state${lead(b) ? '' : ' gal__state--late'}`}>
                  <span className="gal__statet">
                    {lead(b) ? `${gap(b.placedAt, b.eventAt)} early` : 'After the off'}
                  </span>
                  {IMAGES_STORED && st.daysLeft !== null
                    ? <span className="gal__days">{st.daysLeft}d</span>
                    : null}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {cursor < bets.length ? (
        <div className="center" style={{ marginTop: 'var(--gap-block)' }}>
          <button type="button" className="btn btn--ghost" onClick={() => setCursor(cursor + PAGE)}>
            Load {Math.min(PAGE, bets.length - cursor)} more
          </button>
        </div>
      ) : null}
      </div>

      {/*  THE SLIP BESIDE THE GRID. The pane and the lightbox are the two
           sides of one condition rather than both being drawn and one hidden,
           because the slip and the bet inside them carry the same content and
           a document holding two of everything is what a duplicate-id sweep
           exists to catch. */}
      <aside className="dsplit__side" aria-label="The slip you have open">
        {shown && wide ? (
          <div className="dpane">
            <div className="dpane__head">
              <div style={{ minWidth: 0 }}>
                <h3 className="card__title">
                  {shown.legs.length > 1 ? `${shown.legs.length} fold` : shown.selection}
                </h3>
                <p className="small dim">
                  {(open as number) + 1} of {total} · {dateTime(shown.placedAt, at, tz)}
                </p>
              </div>
              <button type="button" className="icobtn" onClick={close} aria-label="Close">
                <Icon name="close" size={18} />
              </button>
            </div>
            <SlipDetail bet={shown} currency={currency} oddsFormat={oddsFormat} now={at} stacked />
            <div className="lbox__foot">
              <button
                type="button" className="btn btn--ghost btn--sm"
                onClick={() => move(-1)} disabled={open === 0}
              >
                <Icon name="chevronLeft" size={16} /> Newer
              </button>
              <button
                type="button" className="btn btn--ghost btn--sm"
                onClick={() => move(1)} disabled={open === total - 1}
              >
                Older <Icon name="chevronRight" size={16} />
              </button>
            </div>
          </div>
        ) : (
          <div className="dpane dpane--rest">
            <Icon name="camera" size={22} className="dpane__mark" />
            <p className="card__title">Press a slip</p>
            <p className="small dim">
              The slip and the bet it produced open here beside the grid. A slip on its own is a
              photograph; the pair is the evidence.
            </p>
          </div>
        )}
      </aside>

      {shown && !wide ? (
        <Lightbox
          bet={shown}
          index={open as number}
          total={total}
          currency={currency}
          oddsFormat={oddsFormat}
          tz={tz}
          now={at}
          closer={closer}
          onClose={close}
          onMove={move}
        />
      ) : null}
    </div>
  );
}

/** The mark on a tile. An SVG symbol, never an emoji: an emoji rasterises
 *  from the system font, so it cannot take a theme colour and it differs per
 *  platform. */
function StateMark({ state }: { state: SlipState }) {
  /*  A clock for "the image was removed on the ninetieth day" is a
      distinction that does not exist where no image was ever written (see
      IMAGES_STORED): both states mean the same thing, that the bet came off
      a photograph of a slip, and drawing two glyphs for one fact put a
      countdown symbol on tiles that are counting down to nothing. */
  const name = state === 'expired' && IMAGES_STORED ? 'clock'
    : state === 'imported' ? 'clipboard'
      : state === 'typed' ? 'edit'
        : state === 'unstored' ? 'slip' : 'camera';
  return <Icon name={name} size={20} className="gal__mark" />;
}

function Lightbox({
  bet, index, total, currency, oddsFormat, tz, now, closer, onClose, onMove,
}: {
  bet: DemoBet;
  index: number;
  total: number;
  currency: Currency;
  oddsFormat: OddsFormat;
  tz: TimeZone;
  now: Date;
  closer: React.RefObject<HTMLButtonElement | null>;
  onClose: () => void;
  onMove: (delta: number) => void;
}) {
  return (
    <>
      {/*  The scrim is a click target and nothing else, so it carries no role
           and no label. The dialogue beside it owns the semantics. */}
      <div className="lbox__scrim" onClick={onClose} aria-hidden="true" />
      <div className="lbox" role="dialog" aria-modal="true" aria-labelledby="lbox-t">
        <div className="lbox__head">
          <div style={{ minWidth: 0 }}>
            <h2 className="card__title" id="lbox-t">
              {bet.legs.length > 1 ? `${bet.legs.length} fold` : bet.selection}
            </h2>
            <p className="small dim">{index + 1} of {total} · {dateTime(bet.placedAt, now, tz)}</p>
          </div>
          <button ref={closer} type="button" className="icobtn" onClick={onClose} aria-label="Close">
            <Icon name="close" size={18} />
          </button>
        </div>

        <SlipDetail bet={bet} currency={currency} oddsFormat={oddsFormat} now={now} />

        <div className="lbox__foot">
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => onMove(-1)} disabled={index === 0}>
            <Icon name="chevronLeft" size={16} /> Newer
          </button>
          <p className="small dim">Arrow keys move. Escape closes.</p>
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => onMove(1)} disabled={index === total - 1}>
            Older <Icon name="chevronRight" size={16} />
          </button>
        </div>
      </div>
    </>
  );
}

/** The slip and the bet it produced, side by side.
 *
 *  ONE COMPONENT, TWO FRAMES. It is the body of the lightbox on a phone and
 *  the body of the detail pane on a monitor, because the pair is the same
 *  evidence either way and two copies of it would drift the moment one of
 *  them gained a field. `stacked` is the only difference: a 340px pane has
 *  no room for two columns, so in it the slip sits above the bet. */
function SlipDetail({
  bet, currency, oddsFormat, now, stacked = false,
}: {
  bet: DemoBet;
  currency: Currency;
  oddsFormat: OddsFormat;
  now: Date;
  stacked?: boolean;
}) {
  const st = slipStatus(bet, now);
  const tags = betTags(bet);
  const s = bet.state;

  return (
    <div className={`lbox__body${stacked ? ' lbox__body--stacked' : ''}`}>
      {/*  THE SLIP SIDE. It states what it knows rather than drawing a
           picture it has not got: a deleted image and an image that was never
           stored are different facts, and both of them are worse served by a
           broken thumbnail than by a sentence. */}
      <div className={`lbox__img lbox__img--${st.state}${st.imageId ? ' lbox__img--shot' : ''}`}>
        {st.imageId ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="lbox__shot" src={`/api/slips/${st.imageId}`} alt={`The slip behind ${bet.selection}`} />
        ) : (
          <>
            <StateMark state={st.state} />
            <p className="fig fig--s" style={{ marginTop: 'var(--s2)' }}>{SLIP_STATE_LABEL[st.state]}</p>
            <p className="small dim" style={{ marginTop: 'var(--s2)' }}>{slipSentence(st)}</p>
          </>
        )}
      </div>

      {/*  THE BET SIDE, beside it. A slip without the bet it produced is a
           photograph; the pair is the evidence. */}
      <div className="lbox__bet">
        <ul>
          <li className="brow"><span className="brow__title">Bookmaker</span><span className="fig fig--s">{bookmakerName(bet.bookmakerId)}</span></li>
          <li className="brow"><span className="brow__title">{bet.side === 'lay' ? 'Liability' : 'Stake'}</span><span className="fig fig--s tnum">{money(bet.side === 'lay' ? (bet.liabilityPence ?? 0) : bet.stakePence, currency)}</span></li>
          <li className="brow"><span className="brow__title">Price</span><span className="fig fig--s mono">{formatOdds(effectiveOdds(bet), oddsFormat)}</span></li>
          <li className="brow"><span className="brow__title">Event</span><span className="fig fig--s">{bet.eventName}</span></li>
          <li className="brow"><span className="brow__title">Market</span><span className="fig fig--s">{bet.marketRaw}</span></li>
          <li className="brow">
            <span className="brow__title">{s.status === 'open' ? 'Still open' : 'Profit'}</span>
            <span className={`fig fig--s tnum ${s.realisedPlPence > 0 ? 'pos' : s.realisedPlPence < 0 ? 'neg' : ''}`}>
              {s.status === 'open' ? '–' : money(s.realisedPlPence, currency, { sign: true })}
            </span>
          </li>
        </ul>
        {tags.length ? (
          <p className="small dim" style={{ marginTop: 'var(--s3)' }}>{tags.join(' · ')}</p>
        ) : null}
        <p className="small dim" style={{ marginTop: 'var(--s3)' }}>
          The figures come from the settlement events, not from the image, which is why deleting
          one changes nothing on this bet.
        </p>
      </div>
    </div>
  );
}
