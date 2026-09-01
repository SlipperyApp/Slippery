'use client';

import { useEffect, useState } from 'react';
import { Icon } from '@/components/Icon';
import { ModuleMenu } from '@/components/app/ModuleMenu';
import { ScopeBar } from '@/components/app/ScopeBar';
import { ShareButton } from '@/components/app/ShareButton';
import { money, pct, units as fmtUnits, count } from '@/lib/format';
import type { Scope, Summary } from '@/lib/data/analytics';
import type { Currency } from '@/lib/domain/types';

/** The one figure the dashboard exists to show, at the top, at size.
 *
 *  It carries the scope for every module below it, because a separate scope
 *  strip above the grid said the same thing twice: the period lives on the
 *  figure the period applies to.
 *
 *  THE TARGET is opt in and it is YOUR number. A target nobody set is a
 *  fabricated benchmark, and this product's whole argument is that a record
 *  which flatters itself is worthless. Unset, the bar is not there. It is
 *  kept in a cookie, the same way the theme and the calendar's display mode
 *  are: a display preference, no database required, and it survives a phone
 *  being closed. */

const TARGET_COOKIE = 'slip_target';

/** Whole pounds. A target of £2,000.37 is not a target anybody set. */
function readTarget(): number {
  if (typeof document === 'undefined') return 0;
  const m = document.cookie.match(new RegExp(`(?:^|; )${TARGET_COOKIE}=([^;]*)`));
  const n = m ? Number(decodeURIComponent(m[1])) : 0;
  return Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
}

export function NetHero({
  summary, scope, scopeLabel, currency, unitPence, books, handle, id = 'mod-net',
}: {
  summary: Summary;
  scope: Scope;
  scopeLabel: string;
  currency: Currency;
  unitPence: number;
  books?: string[];
  handle?: string;
  id?: string;
}) {
  const [target, setTarget] = useState(0);
  useEffect(() => { setTarget(readTarget()); }, []);

  const save = (pounds: number) => {
    setTarget(pounds);
    document.cookie = pounds > 0
      ? `${TARGET_COOKIE}=${pounds}; path=/; max-age=31536000; samesite=lax`
      : `${TARGET_COOKIE}=; path=/; max-age=0; samesite=lax`;
  };

  const net = summary.netPence;
  const targetPence = target * 100;
  const done = targetPence > 0 ? Math.max(0, Math.min(1, net / targetPence)) : 0;
  const left = targetPence - net;

  return (
    <section className="card col-12 hero-net" id={id} aria-labelledby={`${id}-t`}>
      <div className="hero-net__head">
        <p className="label" id={`${id}-t`}>Net, {scopeLabel.toLowerCase()}</p>
        <div className="hero-net__tools">
          <ShareButton
            target={id}
            name="net"
            label="Net"
            params={{
              period: scope.period,
              cur: currency,
              net: Math.round(summary.netPence),
              bets: summary.count,
              // Hundredths and tenths: the card takes integers only, so
              // there is nothing on it that could have come from a string.
              units: Math.round(summary.units * 100),
              roi: Math.round(summary.roi * 10),
              turn: Math.round(summary.turnoverPence),
              ...(handle ? { h: handle } : {}),
            }}
          />
          <ModuleMenu label="Net">
            <div className="modmenu__row">
              <label className="label" htmlFor="net-target">Target for this period</label>
              <div className="row" style={{ gap: 'var(--s2)' }}>
                <input
                  id="net-target"
                  className="input"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  step={50}
                  placeholder="None"
                  value={target || ''}
                  onChange={(e) => save(Math.max(0, Math.round(Number(e.target.value) || 0)))}
                />
              </div>
              <p className="small dim">
                Yours, and off by default.
              </p>
            </div>
          </ModuleMenu>
        </div>
      </div>

      <p className={`hero-net__fig ${net > 0 ? 'pos' : net < 0 ? 'neg' : ''}`}>
        {money(net, currency, { sign: true })}
      </p>

      <ul className="hero-net__stats">
        <li><span className="label">Bets</span><span className="tnum">{count(summary.count)}</span></li>
        <li><span className="label">Units</span><span className="tnum">{fmtUnits(summary.units, { sign: true })}</span></li>
        <li>
          <span className="label">Return</span>
          <span className={`tnum ${summary.roi > 0 ? 'pos' : summary.roi < 0 ? 'neg' : ''}`}>
            {pct(summary.roi, { sign: true })}
          </span>
        </li>
        <li><span className="label">Turnover</span><span className="tnum">{money(summary.turnoverPence, currency)}</span></li>
        <li className="hide-sm"><span className="label">Unit</span><span className="tnum">{money(unitPence, currency)}</span></li>
      </ul>

      {targetPence > 0 ? (
        <div className="hero-net__target">
          <div className="hero-net__targetline">
            <span className="small dim">Target {money(targetPence, currency)}</span>
            <span className="small tnum">
              <span className="hero-net__pctv">{Math.round(done * 100)}%</span>
              {/*  "met" is a status, not a result, so it does not get the
                   profit colour. The figure above it is already green and a
                   second green on the card meaning something else is exactly
                   what the two locked colours exist to prevent. */}
              {left > 0
                ? <span className="dim"> · {money(left, currency)} to go</span>
                : <span> · met</span>}
            </span>
          </div>
          <span className="hero-net__bar" aria-hidden="true">
            <span className="hero-net__barfill" style={{ width: `${(done * 100).toFixed(1)}%` }} />
          </span>
          <span className="sr-only">
            {Math.round(done * 100)} per cent of a {money(targetPence, currency)} target.
          </span>
        </div>
      ) : null}

      <ScopeBar scope={scope} books={books} />

      {summary.voidedStakePence > 0 ? (
        <p className="small dim hero-net__note">
          Turnover and return exclude {money(summary.voidedStakePence, currency)} of voided stakes.
        </p>
      ) : null}
    </section>
  );
}

export { TARGET_COOKIE };
