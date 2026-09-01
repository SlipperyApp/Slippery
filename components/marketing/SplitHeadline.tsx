'use client';

import { useState } from 'react';
import { money, pct } from '@/lib/format';

/** The headline split into money you won and money they gave you. Two
 *  states, so the difference is the point rather than a caption about it. */
export function SplitHeadline() {
  const [split, setSplit] = useState(true);
  const total = 118400;
  const promo = 89000;
  const real = total - promo;

  return (
    <div className="card">
      <div className="card__head">
        <p className="card__title">All time</p>
        <div className="seg" role="group" aria-label="Headline treatment">
          <button type="button" className="seg__btn" aria-pressed={!split} onClick={() => setSplit(false)}>One number</button>
          <button type="button" className="seg__btn" aria-pressed={split} onClick={() => setSplit(true)}>Split</button>
        </div>
      </div>

      {split ? (
        <div className="stack" style={{ ['--gap' as string]: 'var(--s4)' }}>
          <div>
            <p className="label">Money you won</p>
            <p className="fig pos">{money(real, 'GBP', { sign: true })}</p>
            <p className="small dim">Your own stakes, settled.</p>
          </div>
          <div>
            <p className="label">Money they gave you</p>
            <p className="fig fig--m">{money(promo, 'GBP', { sign: true })}</p>
            <p className="small dim">{pct((promo / total) * 100)} of the total. Sign-up offers, free bets and boosts.</p>
          </div>
        </div>
      ) : (
        <div>
          <p className="label">Net profit</p>
          <p className="fig pos">{money(total, 'GBP', { sign: true })}</p>
          <p className="small dim" style={{ marginTop: 'var(--s3)' }}>
            True, and useless. It says nothing about whether the betting worked.
          </p>
        </div>
      )}

      <p className="small muted card__foot">
        Turnover and return exclude voided stakes. A free bet stake is excluded from turnover and
        is not returned.
      </p>
    </div>
  );
}
