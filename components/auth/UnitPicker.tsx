'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Icon } from '@/components/Icon';
import { money, units as fmtUnits } from '@/lib/format';
import type { Currency } from '@/lib/domain/types';
import { keepAnswers, stepHref } from '@/lib/signup-draft';
import { useDraft } from '@/components/auth/useDraft';

const PRESETS = [200, 500, 1000, 2500, 5000, 10000];

/** Nothing the account can set is hardcoded anywhere else, which is why the
 *  worked examples below are computed from the chosen unit rather than
 *  written out. The previous build hardcoded a £100 unit against real £25
 *  stakes and a £2,500 target nobody set. */
export function UnitPicker() {
  const router = useRouter();
  const draft = useDraft();
  /*  A unit already chosen comes back as the chosen one, and a unit that was
      not one of the six presets comes back in the box it was typed into. */
  const chosen = draft.unitPence;
  const preset = chosen !== null && PRESETS.includes(chosen);
  const [currency, setCurrency] = useState<Currency>(draft.currency);
  const [unit, setUnit] = useState(preset ? (chosen as number) : 2500);
  const [custom, setCustom] = useState(chosen !== null && !preset);
  const [customText, setCustomText] = useState(
    chosen !== null && !preset ? (chosen / 100).toFixed(2) : '25.00',
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const effective = custom
    ? Math.round(Number(customText.replace(/[^0-9.]/g, '')) * 100) || 0
    : unit;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (effective < 10) { setError('A unit of at least 0.10, or the arithmetic stops meaning anything.'); return; }
    setError(''); setBusy(true);
    await fetch('/api/auth/profile', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ unitPence: effective, currency }),
    }).catch(() => null);
    const answered = { ...draft, unitPence: effective, currency };
    keepAnswers('/signup/unit', answered);
    router.push(stepHref('/signup/sports', answered));
  }

  return (
    <form onSubmit={submit} noValidate>
      <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
        <legend className="field__label">Currency</legend>
        <div className="seg" role="group" aria-label="Currency">
          {(['GBP', 'EUR'] as Currency[]).map((c) => (
            <button key={c} type="button" className="seg__btn" aria-pressed={currency === c} onClick={() => setCurrency(c)}>
              {c === 'GBP' ? '£ Pounds' : '€ Euro'}
            </button>
          ))}
        </div>
        <p className="field__hint">
          One per account. Pounds and euros are never summed into one figure.
        </p>
      </fieldset>

      <fieldset style={{ border: 0, padding: 0, margin: 'var(--s5) 0 0' }}>
        <legend className="field__label">Your unit</legend>
        <div className="grid" style={{ gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 'var(--s2)' }}>
          {PRESETS.map((p) => (
            <button
              key={p} type="button" className="wall__btn"
              aria-pressed={!custom && unit === p}
              onClick={() => { setCustom(false); setUnit(p); }}
              style={!custom && unit === p ? { borderColor: 'var(--accent)', background: 'color-mix(in oklab, var(--accent) 9%, var(--surface))' } : undefined}
            >
              <span className="wall__n tnum">{money(p, currency)}</span>
            </button>
          ))}
          <button
            type="button" className="wall__btn" aria-pressed={custom}
            onClick={() => setCustom(true)}
            style={custom ? { borderColor: 'var(--accent)', background: 'color-mix(in oklab, var(--accent) 9%, var(--surface))' } : undefined}
          >
            <span className="wall__n">Something else</span>
          </button>
        </div>
      </fieldset>

      {custom ? (
        <div className="field field--tight">
          <label className="field__label" htmlFor="cu">Your own unit</label>
          <input
            id="cu" className="input input--money" inputMode="decimal" autoComplete="off"
            value={customText} onChange={(e) => setCustomText(e.target.value)}
            aria-describedby="cu-hint"
          />
          <span className="field__hint" id="cu-hint">
            In {currency === 'GBP' ? 'pounds' : 'euro'}. Anything from 0.10 upwards.
          </span>
        </div>
      ) : null}

      <div className="card" style={{ marginTop: 'var(--s5)' }}>
        <p className="label">What that means</p>
        <ul style={{ marginTop: 'var(--s3)' }}>
          {[
            { s: 'A normal bet', v: money(effective, currency), u: fmtUnits(1) },
            { s: 'Half a unit, a bet you fancy less', v: money(Math.round(effective / 2), currency), u: fmtUnits(0.5) },
            { s: 'Two units, a bet you fancy a lot', v: money(effective * 2, currency), u: fmtUnits(2) },
            { s: 'A month up ten units', v: money(effective * 10, currency, { sign: true }), u: fmtUnits(10, { sign: true }) },
          ].map((r) => (
            <li key={r.s} className="brow">
              <span className="brow__title">{r.s}</span>
              <span className="row" style={{ gap: 'var(--s3)' }}>
                <span className="small dim mono">{r.u}</span>
                <span className="fig fig--s tnum">{r.v}</span>
              </span>
            </li>
          ))}
        </ul>
        <p className="small dim card__foot">
          You can change this later. Bets already logged keep the unit they had.
        </p>
      </div>

      {error ? <p className="field__err" role="alert" style={{ marginTop: 'var(--s3)' }}>{error}</p> : null}

      <button type="submit" className="btn btn--primary btn--wide" style={{ marginTop: 'var(--s5)' }} disabled={busy}>
        Continue <Icon name="arrowRight" size={16} />
      </button>
    </form>
  );
}
