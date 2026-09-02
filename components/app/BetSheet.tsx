'use client';

import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '@/components/Icon';
import { recompute, effectiveOdds } from '@/lib/domain/fold';
import { working, type WorkingLine } from '@/lib/domain/working';
import { slipStatus, IMAGE_RETENTION_DAYS, IMAGES_STORED } from '@/lib/domain/slip';
import type { SettlementEvent } from '@/lib/domain/types';
import type { DemoBet } from '@/lib/data/demo';
import type { Currency } from '@/lib/domain/types';
import { formatOdds, type OddsFormat } from '@/lib/odds';
import { bookmakerName } from '@/lib/data/reference';
import { dateTime, gap, money, units as fmtUnits, pct, DEFAULT_TZ, type TimeZone } from '@/lib/format';
import { OutcomePill } from './BetRow';
import { ClosingPrice } from './ClosingPrice';
import { Settle, newWriteKey } from './Settle';

const EIGHTHS = [1, 2, 3, 4, 5, 6, 7, 8];

/** One line of the working: a label, the figure it stands for, and where the
 *  figure came from. Money and prices are formatted here and nowhere else,
 *  which is what keeps lib/domain/working.ts free of an opinion about what a
 *  pound looks like. */
function Line({ line, rule = false, currency, oddsFormat, tz = DEFAULT_TZ }: {
  line: WorkingLine; rule?: boolean; currency: Currency; oddsFormat: OddsFormat; tz?: TimeZone;
}) {
  const value = line.minor !== null
    ? money(line.minor, currency, { sign: line.sign })
    : line.odds !== null
      ? formatOdds(line.odds, oddsFormat)
      : line.units !== null
        ? fmtUnits(line.units, { sign: true })
        : (line.text ?? '');
  const tone = line.foot && line.sign && line.minor !== null
    ? (line.minor > 0 ? 'pos' : line.minor < 0 ? 'neg' : '')
    : '';

  return (
    <li className={`brow${line.foot ? ' sum__foot' : ''}${rule ? ' sum__rule' : ''}`}>
      <span style={{ minWidth: 0 }}>
        <span className="brow__title">{line.label}</span>
        {line.hint ? <span className="brow__sub">{line.hint}</span> : null}
        {line.at ? (
          <span className="brow__sub">
            {dateTime(line.at, new Date(), tz)} · by {line.by}
            {line.late ? ' · entered after the result was known' : ''}
          </span>
        ) : null}
      </span>
      <span className={`fig fig--s tnum ${tone}`}>{value}</span>
    </li>
  );
}

export function BetSheet({
  bet, ewSibling = null, currency, oddsFormat, onClose, onChanged, tz = DEFAULT_TZ, mode = 'sheet',
}: {
  bet: DemoBet;
  /** The other half of an each way bet, so the sheet can show the whole sum
   *  rather than half of it. */
  ewSibling?: DemoBet | null;
  currency: Currency;
  oddsFormat: OddsFormat;
  /** The account's zone, so a settlement stamp reads in the account's day. */
  tz?: TimeZone;
  /** SHEET OR PANE, and the difference is whether the list survives.
   *
   *  A sheet is modal: a scrim, aria-modal, and the thirty rows underneath
   *  hidden behind it. That is right on a phone, where there is room for one
   *  thing. On a monitor it hides the list to show one row of it, so from
   *  1280 the same content renders as a pane beside the list instead, which
   *  is not modal, traps nothing, and leaves the ledger on screen. The
   *  ledger mounts exactly one of the two, so nothing in here appears
   *  twice. */
  mode?: 'sheet' | 'pane';
  onClose: () => void;
  /** A settlement event landed. The ledger behind this sheet is refetched
   *  rather than patched, so there is still exactly one fold. */
  onChanged?: () => void;
}) {
  const [eighths, setEighths] = useState(4);
  const [returnText, setReturnText] = useState('');
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState('');
  const [imageGone, setImageGone] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [imageNote, setImageNote] = useState('');
  /*  A write has landed, so the rows behind this sheet are one event out of
      date. Saying so is better than silently refreshing under somebody who
      is still reading the working. */
  const [written, setWritten] = useState(false);
  const [cashKey, setCashKey] = useState(newWriteKey);

  /*  What state the slip behind this bet is in. Through lib/domain/slip.ts,
      which the gallery reads too: this was worked out here from placedAt and
      a literal 90, and the day the retention window moves, one of the two
      surfaces keeps saying 90 and describes an image as held after it has
      been deleted. */
  const slip = slipStatus(bet);
  const capturedBefore = Date.parse(bet.placedAt) < Date.parse(bet.eventAt);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    ref.current?.focus();
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const odds = effectiveOdds(bet);
  const remaining = bet.state.remainingStakePence;
  const settled = bet.state.status === 'settled';

  /*  THE MATHS, from the fold rather than from this component. One tap on a
      settled bet has to reveal the working or every other figure in the
      product is asking to be taken on trust. What it revealed before was the
      settlement events by their type names, which is the database talking. */
  const sum = working(bet, ewSibling);

  // Eighths of REMAINING stake, never of the original, which is what makes a
  // second pull land on the right base.
  const portion = Math.round((remaining * eighths) / 8);
  const suggested = Math.round(portion * (1 + (odds - 1) * 0.6));
  const returnPence = returnText === ''
    ? suggested
    : Math.round(Number(returnText.replace(/[^0-9.]/g, '')) * 100) || 0;

  /** The preview goes through the SAME fold production uses, so what you see
   *  before you press is what gets written. */
  const preview = useMemo(() => {
    const next: SettlementEvent = {
      id: 'preview', betId: bet.id,
      seq: (bet.events[bet.events.length - 1]?.seq ?? 0) + 1,
      type: 'cash_out_partial',
      fractionEighths: eighths, returnedPence: returnPence,
      deductionPence: null, commissionPct: null,
      occurredAt: new Date().toISOString(), enteredBy: 'you',
      afterResultKnown: false, note: null, createdAt: new Date().toISOString(),
    };
    return recompute(bet, [...bet.events, next], new Date().toISOString());
  }, [bet, eighths, returnPence]);

  async function deleteImage(imageId: string) {
    setDeleting(true);
    setImageNote('');
    try {
      const res = await fetch(`/api/slips/${imageId}`, { method: 'DELETE' });
      const b = await res.json().catch(() => ({}));
      setImageNote((b.message as string) || 'Nothing came back, so nothing was deleted.');
      if (res.ok) { setImageGone(true); onChanged?.(); }
    } catch {
      setImageNote('That did not reach the server, so the image was not deleted.');
    }
    setDeleting(false);
  }

  async function cashOut() {
    setSaving(true);
    setNote('');
    try {
      const res = await fetch(`/api/bets/${bet.id}/events`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          type: 'cash_out_partial', fractionEighths: eighths, returnedPence: returnPence,
          /*  A pull is append only and there is no edit to undo a second one
              with, so a retry carries the key of the first attempt and lands
              once. It is regenerated after a write, because a SECOND pull on
              the same bet is a real thing somebody does. */
          idempotencyKey: cashKey,
        }),
      });
      const b = await res.json().catch(() => ({}));
      if (res.ok) {
        setNote('Written. The ledger and every figure above it were recomputed in the same transaction.');
        setCashKey(newWriteKey());
        setWritten(true);
        onChanged?.();
      } else {
        setNote((b.message as string) || 'Nothing was written.');
      }
    } catch {
      setNote('That did not reach the server, so nothing was written.');
    }
    setSaving(false);
  }

  const open = bet.state.status !== 'settled';

  const pane = mode === 'pane';

  return (
    <>
      {pane ? null : <div className="sheet__scrim" onClick={onClose} aria-hidden="true" />}
      <div
        className={pane ? 'dpane' : 'sheet'}
        role={pane ? 'region' : 'dialog'}
        aria-modal={pane ? undefined : true}
        aria-labelledby="sheet-title"
        tabIndex={-1}
        ref={ref}
      >
        <div className="sheet__head">
          <div style={{ minWidth: 0 }}>
            <OutcomePill bet={bet} />
            <h2 id="sheet-title" style={{ marginTop: 'var(--s2)', fontSize: 'var(--t-h2)' }}>
              {bet.legs.length > 1 ? `${bet.legs.length} fold` : bet.selection}
            </h2>
            <p className="small dim">{bet.eventName} · {bookmakerName(bet.bookmakerId)}</p>
          </div>
          <button type="button" className="iconbtn" onClick={onClose} aria-label="Close this bet">
            <Icon name="close" size={18} />
          </button>
        </div>

        {written ? (
          <p className="small muted" role="status" style={{ marginBottom: 'var(--s4)' }}>
            This bet has moved. The figures on this sheet are the ones before the write; close it
            and the ledger behind is rebuilt from the events.
          </p>
        ) : null}

        {/*  The glance, for a bet that is still live. On a settled bet these
             five figures are the last five lines of the working below, and
             printing them twice three inches apart is what made this sheet
             read as a dump rather than an explanation. */}
        {settled ? null : (
          <div className="row row--wrap" style={{ gap: 'var(--s6)', marginBottom: 'var(--s5)' }}>
            <div>
              <p className="label">{bet.side === 'lay' ? 'Liability' : 'Stake'}</p>
              <p className="fig fig--s tnum">{money(bet.side === 'lay' ? (bet.liabilityPence ?? 0) : bet.stakePence, currency)}</p>
            </div>
            <div>
              <p className="label">Price</p>
              <p className="fig fig--s tnum">{formatOdds(odds, oddsFormat)}</p>
            </div>
            <div>
              <p className="label">Returned</p>
              <p className="fig fig--s tnum">{money(bet.state.returnedPence, currency)}</p>
            </div>
            <div>
              <p className="label">Profit</p>
              <p className={`fig fig--s tnum ${bet.state.realisedPlPence > 0 ? 'pos' : bet.state.realisedPlPence < 0 ? 'neg' : ''}`}>
                {money(bet.state.realisedPlPence, currency, { sign: true })}
              </p>
            </div>
            <div>
              <p className="label">Units</p>
              <p className="fig fig--s tnum">{fmtUnits(bet.state.units, { sign: true })}</p>
            </div>
          </div>
        )}

        {bet.legs.length > 1 ? (
          <>
            <p className="label">Legs</p>
            <ul style={{ marginBottom: 'var(--s5)' }}>
              {bet.legs.map((l) => (
                <li key={l.id} className="brow">
                  <span style={{ minWidth: 0 }}>
                    <span className="brow__title">{l.selection}</span>
                    <span className="brow__sub">{l.eventName}</span>
                  </span>
                  <span className="row" style={{ gap: 'var(--s3)' }}>
                    <span className="small mono dim">{formatOdds(l.legOdds, oddsFormat)}</span>
                    <span className={`pill ${l.legResult === 'won' ? 'pill--pos' : l.legResult === 'lost' ? 'pill--neg' : ''}`}>
                      {l.legResult === 'open' ? 'Running' : l.legResult.replace('_', ' ')}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
            {bet.legs.some((l) => l.legResult === 'void') ? (
              <p className="small muted" style={{ marginBottom: 'var(--s5)' }}>
                A void leg dropped out and the price recalculated to {formatOdds(odds, oddsFormat)}.
              </p>
            ) : null}
          </>
        ) : null}

        {/* The slip. Images are deleted 90 days after upload, or immediately
            on request, and the bet stays. This says so rather than showing a
            broken thumbnail, which is the only honest way to render a record
            whose evidence has been deleted on purpose. */}
        <p className="label">The slip</p>
        <div className="slipstate" style={{ marginBottom: 'var(--s5)' }}>
          {slip.state === 'imported' ? (
            /*  Imported history is not slip backed, and so read as "Typed
                in" here while the row two inches above it said Imported.
                Two words for one bet on one screen, and neither of them the
                one that says where the bet actually came from. */
            <>
              <Icon name="clipboard" size={18} className="slipstate__i" />
              <span>
                <strong>Imported.</strong> This came in from a file rather than from a slip, so
                there is no image behind it and it never counts as slip backed, including in a
                group that ranks slip backed bets only.
              </span>
            </>
          ) : slip.state === 'typed' ? (
            <>
              <Icon name="edit" size={18} className="slipstate__i" />
              <span>
                <strong>Typed in.</strong> There is no slip behind this bet, and it is marked that
                way everywhere it appears, including a group that counts slip backed bets only.
              </span>
            </>
          ) : slip.state === 'expired' && IMAGES_STORED ? (
            <>
              <Icon name="clock" size={18} className="slipstate__i" />
              <span>
                <strong>
                  {slip.removedEarly
                    ? 'Image deleted at your request. The bet is unchanged.'
                    : `Image removed after ${IMAGE_RETENTION_DAYS} days. The bet is unchanged.`}
                </strong>{' '}
                Every figure above was folded from the settlement events, not from the image, so
                nothing here depended on it.
              </span>
            </>
          ) : slip.state === 'unstored' ? (
            /*  IT USED TO SAY "IMAGE HELD" HERE FOR EVERY SLIP BACKED BET,
                and count down ninety days to the deletion of a file that was
                never stored anywhere. A bet from before images were kept, or
                on a deployment that cannot keep one, says so. */
            <>
              <Icon name="camera" size={18} className="slipstate__i" />
              <span>
                <strong>Captured from a slip, and no image was kept.</strong>{' '}
                Every figure above was folded from the settlement events, not from a picture, so
                nothing here depended on one.
              </span>
            </>
          ) : (
            <>
              <Icon name="camera" size={18} className="slipstate__i" />
              <span>
                {/*  HOW FAR AHEAD OF THE OFF, not just how long ago. The
                     age of the capture is a fact about the file; the head
                     start is the fact the product is about, and it is the
                     one thing a screenshot can prove that a typed row
                     cannot. */}
                <strong>
                  Captured {capturedBefore ? `${gap(bet.placedAt, bet.eventAt)} before the off` : 'after the off'}
                </strong>{' '}
                {slip.ageDays === 0 ? 'today' : `${slip.ageDays} days ago`}.
                The image is deleted after {IMAGE_RETENTION_DAYS} days, or now if you ask.{' '}
                {/*  A REAL REQUEST. This used to set a React state variable
                     and nothing else: it relabelled itself "Requested", sent
                     nothing anywhere, and sat beside a privacy commitment the
                     policy repeats. Pressing it is somebody exercising a data
                     right, and it now makes the request that discharges it. */}
                {slip.imageId ? (
                  <button
                    type="button"
                    className="btn btn--link btn--sm"
                    onClick={() => deleteImage(slip.imageId as string)}
                    disabled={imageGone || deleting}
                  >
                    {deleting ? 'Deleting' : imageGone ? 'Deleted' : 'Delete the image now'}
                  </button>
                ) : null}
              </span>
            </>
          )}
        </div>
        {slip.state === 'held' && slip.imageId ? (
          <figure className="slipshot">
            {/*  A plain img, not next/image: the bytes are served by
                 /api/slips behind a session check and the optimiser would
                 need to fetch them itself, without one. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/api/slips/${slip.imageId}`} alt="The slip this bet was read from" loading="lazy" />
          </figure>
        ) : null}
        {imageNote ? (
          <p className="small muted" role="status" style={{ marginBottom: 'var(--s5)' }}>{imageNote}</p>
        ) : null}

        {/*  HOW THE FIGURE WAS ARRIVED AT. Every line comes from the fold
             itself, so this cannot be a second opinion about the number it
             is explaining. */}
        <p className="label">How this was worked out</p>
        <ul style={{ marginBottom: 'var(--s3)' }}>
          {sum.lines.map((line, i) => (
            <Fragment key={`${line.groupKey}-${line.label}-${i}`}>
              {line.group && line.groupKey !== sum.lines[i - 1]?.groupKey ? (
                <li className="sum__group"><p className="label">{line.group}</p></li>
              ) : null}
              <Line
                line={line}
                /*  The rule goes above the FIRST summary line only. One
                    above each of them would draw four rules under a total
                    and make the sum look like four sums. */
                rule={line.foot && !sum.lines[i - 1]?.foot}
                currency={currency}
                oddsFormat={oddsFormat}
                tz={tz}
              />
            </Fragment>
          ))}
        </ul>

        {sum.halfOnly ? (
          <p className="small muted" style={{ marginBottom: 'var(--s3)' }}>
            This is one half of an each way bet. The other half is its own row in the ledger,
            with its own price and its own result.
          </p>
        ) : null}

        {sum.notes.length ? (
          <ul className="small muted" style={{ marginBottom: 'var(--s5)' }}>
            {sum.notes.map((n) => <li key={n}>{n}</li>)}
          </ul>
        ) : <div style={{ marginBottom: 'var(--s5)' }} />}

        {/*  THE CLOSING PRICE, under the working rather than in it. It is not
             part of how the money was arrived at: it moves no stake, no
             return and no profit, so putting it among the lines of the sum
             would make it look like one of them. It sits below, where a
             separate question about the same bet belongs. */}
        <ClosingPrice bet={bet} odds={odds} oddsFormat={oddsFormat} />

        {/*  SETTLING THE BET, which this sheet could not do.
             It offered three controls on a match that finished yesterday and
             the only terminal one was Cash out, which no bookmaker would have
             offered on a finished event, so the single available action wrote
             a false record. Won, lost, void, placed and the rest are here,
             above the cash out rather than beside it, because a result is
             what somebody opened this sheet to record. */}
        <Settle
          bet={bet}
          currency={currency}
          oddsFormat={oddsFormat}
          tz={tz}
          onWritten={() => { setWritten(true); onChanged?.(); }}
        />

        {open ? (
          <div className="card" style={{ background: 'var(--surface-2)' }}>
            <p className="card__title">Cash out</p>
            <p className="small muted" style={{ marginTop: 'var(--s2)' }}>
              A cash out is invisible from a results feed, so it is always your action. The slider
              is in eighths of the <strong>{money(remaining, currency)}</strong> still standing,
              never of the original stake.
            </p>

            <div className="field">
              <label className="field__label" htmlFor="co-eighths">
                How much of what is left: {eighths} of 8
              </label>
              <input
                id="co-eighths" type="range" min={1} max={8} step={1} value={eighths}
                onChange={(e) => setEighths(Number(e.target.value))}
                style={{ width: '100%', minHeight: '44px', accentColor: 'var(--accent)' }}
                aria-describedby="co-portion"
              />
              <div className="row" style={{ justifyContent: 'space-between' }} aria-hidden="true">
                {EIGHTHS.map((n) => <span key={n} className="small dim mono">{n}</span>)}
              </div>
              <span className="field__hint" id="co-portion">
                {money(portion, currency)} of stake leaves {money(remaining - portion, currency)} running.
              </span>
            </div>

            <div className="field">
              <label className="field__label" htmlFor="co-return">What the bookmaker offered</label>
              <input
                id="co-return" className="input input--money" inputMode="decimal" autoComplete="off"
                value={returnText} onChange={(e) => setReturnText(e.target.value)}
                placeholder={(suggested / 100).toFixed(2)}
              />
              <span className="field__hint">
                Left blank it uses {money(suggested, currency)}, which is the mid price for this
                stage. Type the real figure and it uses that.
              </span>
            </div>

            <div className="hr" />
            <p className="label">After this pull</p>
            <div className="row row--wrap" style={{ gap: 'var(--s5)', marginTop: 'var(--s2)' }}>
              <div>
                <p className="label">Still standing</p>
                <p className="fig fig--s tnum">{money(preview.remainingStakePence, currency)}</p>
              </div>
              <div>
                <p className="label">Banked</p>
                <p className={`fig fig--s tnum ${preview.realisedPlPence > 0 ? 'pos' : preview.realisedPlPence < 0 ? 'neg' : ''}`}>
                  {money(preview.realisedPlPence, currency, { sign: true })}
                </p>
              </div>
              <div>
                <p className="label">Status</p>
                <p className="fig fig--s">{preview.status === 'settled' ? 'Settled' : 'Part settled'}</p>
              </div>
            </div>

            <button type="button" className="btn btn--primary btn--wide" style={{ marginTop: 'var(--s4)' }}
              onClick={cashOut} disabled={saving}>
              {saving ? 'Writing' : `Cash out ${eighths} of 8 for ${money(returnPence, currency)}`}
            </button>
            {note ? <p className="small muted" role="status" style={{ marginTop: 'var(--s3)' }}>{note}</p> : null}
          </div>
        ) : (
          <div className="card" style={{ background: 'var(--surface-2)' }}>
            <p className="card__title">Settled</p>
            <p className="small muted" style={{ marginTop: 'var(--s2)' }}>
              {/*  Off turnover, and only when there is turnover to divide by.
                   It divided by the stake and printed 0.0% whenever nothing
                   came back, so the half of an each way bet that lost read
                   "Return on this bet was +0.0%" directly under a working
                   that says it lost the lot. A wrong figure under the sum
                   that explains it costs more than a missing one. */}
              {sum.turnoverPence > 0
                ? `Return on this bet was ${pct((sum.netPence / sum.turnoverPence) * 100, { sign: true })}. `
                : 'Nothing was at risk on this bet in the end, so it has no return to report. '}
              A correction is a new event rather than an edit, so the change history stays true.
            </p>
          </div>
        )}
      </div>
    </>
  );
}
