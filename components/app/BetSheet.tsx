'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '@/components/Icon';
import { recompute, effectiveOdds } from '@/lib/domain/fold';
import type { SettlementEvent } from '@/lib/domain/types';
import type { DemoBet } from '@/lib/data/demo';
import type { Currency } from '@/lib/domain/types';
import { formatOdds, type OddsFormat } from '@/lib/odds';
import { bookmakerName } from '@/lib/data/reference';
import { dateTime, money, units as fmtUnits, pct } from '@/lib/format';
import { OutcomePill } from './BetRow';

const EIGHTHS = [1, 2, 3, 4, 5, 6, 7, 8];

const EVENT_LABEL: Record<string, string> = {
  won: 'Won', lost: 'Lost', void: 'Void', placed: 'Placed', push: 'Push',
  half_won: 'Half won', half_lost: 'Half lost',
  cash_out_partial: 'Cashed out, part', cash_out_full: 'Cashed out, in full',
  rule4: 'Rule 4 deduction', commission: 'Commission',
  promo_refund: 'Promo refund', manual_correction: 'Correction',
};

export function BetSheet({
  bet, currency, oddsFormat, onClose,
}: {
  bet: DemoBet;
  currency: Currency;
  oddsFormat: OddsFormat;
  onClose: () => void;
}) {
  const [eighths, setEighths] = useState(4);
  const [returnText, setReturnText] = useState('');
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState('');
  const [imageGone, setImageGone] = useState(false);

  // How long ago the slip was captured, in whole days. Anything past 90 has
  // had its image deleted by the retention sweep.
  const imageAge = Math.floor((Date.now() - new Date(bet.placedAt).getTime()) / 86400000);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    ref.current?.focus();
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const odds = effectiveOdds(bet);
  const remaining = bet.state.remainingStakePence;

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

  async function cashOut() {
    setSaving(true);
    setNote('');
    try {
      const res = await fetch(`/api/bets/${bet.id}/events`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ type: 'cash_out_partial', fractionEighths: eighths, returnedPence: returnPence }),
      });
      const b = await res.json().catch(() => ({}));
      setNote(res.ok
        ? 'Written. The ledger and every figure above it were recomputed in the same transaction.'
        : (b.message as string) || 'Nothing was written.');
    } catch {
      setNote('That did not reach the server, so nothing was written.');
    }
    setSaving(false);
  }

  const open = bet.state.status !== 'settled';

  return (
    <>
      <div className="sheet__scrim" onClick={onClose} aria-hidden="true" />
      <div
        className="sheet"
        role="dialog"
        aria-modal="true"
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

        {bet.legs.length > 1 ? (
          <>
            <p className="label">Legs</p>
            <ul style={{ marginBottom: 'var(--s5)' }}>
              {bet.legs.map((l) => (
                <li key={l.id} className="brow">
                  <span style={{ minWidth: 0 }}>
                    <span className="brow__title" style={{ display: 'block' }}>{l.selection}</span>
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
          {!bet.slipBacked ? (
            <>
              <Icon name="edit" size={18} className="slipstate__i" />
              <span>
                <strong>Typed in.</strong> There is no slip behind this bet, and it is marked that
                way everywhere it appears, including a group that counts slip backed bets only.
              </span>
            </>
          ) : imageAge > 90 ? (
            <>
              <Icon name="clock" size={18} className="slipstate__i" />
              <span>
                <strong>Image removed after 90 days. The bet is unchanged.</strong> Every figure
                above was folded from the settlement events, not from the image, so nothing here
                depended on it.
              </span>
            </>
          ) : (
            <>
              <Icon name="camera" size={18} className="slipstate__i" />
              <span>
                <strong>Captured from a slip</strong> {imageAge === 0 ? 'today' : `${imageAge} days ago`}.
                The image is deleted after 90 days, or now if you ask.{' '}
                <button type="button" className="btn btn--link btn--sm" onClick={() => setImageGone(true)}>
                  {imageGone ? 'Requested' : 'Delete the image now'}
                </button>
              </span>
            </>
          )}
        </div>

        <p className="label">Settlement ledger</p>
        <ul style={{ marginBottom: 'var(--s5)' }}>
          {bet.events.length === 0 ? (
            <li className="brow"><span className="brow__sub">Nothing has settled yet.</span></li>
          ) : bet.events.map((e) => (
            <li key={e.id} className="brow">
              <span style={{ minWidth: 0 }}>
                <span className="brow__title" style={{ display: 'block' }}>{EVENT_LABEL[e.type] ?? e.type}</span>
                <span className="brow__sub">
                  {dateTime(e.occurredAt)} · by {e.enteredBy}
                  {e.afterResultKnown ? ' · after the result was known' : ''}
                  {e.fractionEighths ? ` · ${e.fractionEighths} of 8 of what remained` : ''}
                  {e.deductionPence ? ` · ${e.deductionPence}p in the pound` : ''}
                  {e.commissionPct ? ` · ${e.commissionPct}%` : ''}
                </span>
              </span>
              <span className="small mono dim">
                {e.returnedPence != null ? money(e.returnedPence, currency) : ''}
              </span>
            </li>
          ))}
        </ul>

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
              Return on this bet was {pct(bet.state.returnedPence > 0
                ? (bet.state.realisedPlPence / Math.max(1, bet.stakePence)) * 100 : 0, { sign: true })}.
              A correction is a new event rather than an edit, so the change history stays true.
            </p>
          </div>
        )}
      </div>
    </>
  );
}
