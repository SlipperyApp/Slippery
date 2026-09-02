'use client';

import { useState } from 'react';
import { closingValuePct, isPrice } from '@/lib/domain/closing';
import { formatOdds, type OddsFormat } from '@/lib/odds';
import { pct } from '@/lib/format';
import type { DemoBet } from '@/lib/data/demo';

/** The closing price on one bet, shown and recorded.
 *
 *  RECORDED, NEVER WORKED OUT. There is no price feed behind this and there
 *  is not meant to be: the number in the box is one the account holder looked
 *  up after the off and typed in. The previous attempt at this in Slippery
 *  was a module that computed nothing and explained on every account every
 *  day that it had nothing to compute, and it was deleted for it.
 *
 *  A BLANK SAYS NOTHING AND CLAIMS NOTHING. Where no price has been recorded
 *  this shows an empty box and one line telling you the box is optional. It
 *  does not show a zero, a dash in a total or a figure of any kind, because a
 *  bet nobody looked up is a bet this figure has nothing to say about. */
export function ClosingPrice({
  bet, odds, oddsFormat,
}: {
  bet: DemoBet;
  /** The price actually in force, from the fold, so a multiple with a void
   *  leg is compared at the price it settled at. */
  odds: number;
  oddsFormat: OddsFormat;
}) {
  const [text, setText] = useState(bet.closingOdds == null ? '' : String(bet.closingOdds));
  const [saving, setSaving] = useState(false);
  const [said, setSaid] = useState('');

  const typed = Number(text.trim());
  /*  The value is drawn off what is in the box, so the figure moves as you
      type and you can see what you are about to record before you press. The
      shape handed to the domain is the bet with the typed price on it, which
      is the same function the dashboard's aggregate uses: two ways of
      showing this figure would eventually be two figures. */
  const live = closingValuePct({ side: bet.side, odds, closingOdds: isPrice(typed) ? typed : null });
  const lay = bet.side === 'lay';

  async function save() {
    setSaving(true);
    setSaid('');
    try {
      const res = await fetch(`/api/bets/${bet.id}/closing`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ closingOdds: text.trim() }),
      });
      const b = await res.json().catch(() => ({}));
      setSaid(res.ok
        ? (text.trim() === '' ? 'Cleared. This bet is out of the closing figures again.' : 'Recorded.')
        : (b.message as string) || 'Nothing was written.');
    } catch {
      setSaid('That did not reach the server, so nothing was written.');
    }
    setSaving(false);
  }

  return (
    <div className="card clv" style={{ background: 'var(--surface-2)', marginBottom: 'var(--s5)' }}>
      <div className="spread">
        <p className="card__title">Closing price</p>
        {live !== null ? (
          <p className={`fig fig--s tnum ${live > 0 ? 'pos' : live < 0 ? 'neg' : ''}`}>
            {pct(live, { sign: true })}
          </p>
        ) : null}
      </div>

      {live !== null ? (
        <p className="small muted" style={{ marginTop: 'var(--s2)' }}>
          You took {formatOdds(odds, oddsFormat)} and it closed at{' '}
          {formatOdds(typed, oddsFormat)}.{' '}
          {lay
            ? 'A lay wants the shorter price, so this is worked out the other way round: a plus means you laid under the close.'
            : 'A plus means the price you took was the longer of the two.'}
        </p>
      ) : (
        <p className="small muted" style={{ marginTop: 'var(--s2)' }}>
          Optional, and left empty on most bets. Nothing here works a closing price out: put in the
          price the market actually settled at, if you know it, and leave it alone if you do not.
          A guessed one would look exactly like a real one.
        </p>
      )}

      <div className="field" style={{ marginTop: 'var(--s4)' }}>
        <label className="field__label" htmlFor={`clv-${bet.id}`}>
          Decimal price at the off
        </label>
        <div className="row" style={{ gap: 'var(--s3)', flexWrap: 'wrap' }}>
          <input
            id={`clv-${bet.id}`}
            className="input mono clv__in"
            inputMode="decimal"
            autoComplete="off"
            placeholder="2.90"
            value={text}
            onChange={(e) => { setText(e.target.value); setSaid(''); }}
          />
          <button type="button" className="btn btn--ghost" onClick={save} disabled={saving}>
            {text.trim() === '' && bet.closingOdds != null ? 'Clear it' : 'Record it'}
          </button>
        </div>
        <span className="field__hint" role="status">
          {said
            || (text.trim() !== '' && live === null
              ? 'A closing price is a decimal price above 1.00.'
              : bet.closingOdds != null
                /*  A filled box needs the opposite sentence from an empty
                    one. Under a price somebody has already recorded,
                    "empty means nobody has recorded one" reads as though
                    the product has not noticed the number above it. */
                ? 'Empty the box and press to take this bet back out of every closing figure.'
                : 'Empty means nobody has recorded one, and this bet stays out of every closing figure.')}
        </span>
      </div>
    </div>
  );
}
