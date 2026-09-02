'use client';

import { useMemo, useState } from 'react';
import { recompute, effectiveOdds } from '@/lib/domain/fold';
import { money, units as fmtUnits, type TimeZone } from '@/lib/format';
import { formatOdds, type OddsFormat } from '@/lib/odds';
import { bookmakerName } from '@/lib/data/reference';
import type { DemoBet } from '@/lib/data/demo';
import type { Currency, EventType, SettlementEvent } from '@/lib/domain/types';
import { Icon } from '@/components/Icon';

/** SETTLING A BET, which nothing in this product could do.
 *
 *  The endpoint accepted thirteen event types, the fold handled every one of
 *  them and the tests pinned the arithmetic. The only thing the browser could
 *  send was cash_out_partial, so the single terminal action available on a
 *  match that finished yesterday was a cash out no bookmaker would have
 *  offered, and pressing it wrote a false record. Won, lost, void, placed,
 *  push, half won, half lost, a full cash out, a Rule 4, commission, a promo
 *  refund and a manual correction had no control anywhere.
 *
 *  THE ARITHMETIC IS SHOWN BEFORE THE COMMIT, not after. The preview runs the
 *  SAME fold production runs, over this bet's real events with the pending
 *  one appended, so what is on the screen before the press is what gets
 *  written. Nothing here grades a bet: rule 2 of the codebase is that
 *  lib/settlement/engine.ts is the only grader, and this is a person saying
 *  what happened rather than the product inferring it.
 *
 *  A WRONG GRADE IS WORSE THAN NO GRADE, so nothing is preselected, no
 *  default is offered, and a multiple whose legs have not all graded says so
 *  before it lets the whole bet be settled. */

type Needs = 'none' | 'money' | 'signed' | 'deduction' | 'pct';

type Choice = {
  id: string;
  type: EventType;
  label: string;
  hint: string;
  needs: Needs;
};

/*  THE SIX OUTCOMES ARE WON, LOST, CASH-PROFIT, CASH-LOSS, CASH-FLAT AND
    VOID. Void means stake returned and zero profit, which is why it sits
    beside won and lost rather than behind a disclosure: it is a result a
    bettor gets several times a month, not an edge case. */
const RESULTS: Choice[] = [
  { id: 'won', type: 'won', label: 'Won', hint: 'The whole remaining stake wins at the price.', needs: 'none' },
  { id: 'lost', type: 'lost', label: 'Lost', hint: 'The remaining stake is gone and nothing comes back.', needs: 'none' },
  { id: 'void', type: 'void', label: 'Void', hint: 'Stake returned, zero profit, and the stake leaves turnover.', needs: 'none' },
];

const PLACED: Choice = {
  id: 'placed', type: 'placed', label: 'Placed', hint: 'The place part paid. A place is its own result, never a win and never a loss.', needs: 'none',
};

const OTHER: Choice[] = [
  { id: 'push', type: 'push', label: 'Push', hint: 'A whole line landed exactly on the number. Stake back, no profit.', needs: 'none' },
  { id: 'half_won', type: 'half_won', label: 'Half won', hint: 'A quarter line split: half wins at the price, half is returned.', needs: 'none' },
  { id: 'half_lost', type: 'half_lost', label: 'Half lost', hint: 'A quarter line split: half is gone, half is returned.', needs: 'none' },
  { id: 'cash_out_full', type: 'cash_out_full', label: 'Cashed out in full', hint: 'The whole bet was taken back at an agreed figure.', needs: 'money' },
];

const ADJUSTMENTS: Choice[] = [
  { id: 'rule4', type: 'rule4', label: 'Rule 4 deduction', hint: 'Pence in the pound off net winnings only. It never touches the price or the result.', needs: 'deduction' },
  { id: 'commission', type: 'commission', label: 'Commission', hint: 'Per bookmaker, on net winnings only, never on turnover. A losing bet pays none.', needs: 'pct' },
  { id: 'promo_refund', type: 'promo_refund', label: 'Promo refund', hint: 'A refund that landed after the result. It adjusts profit and nothing else.', needs: 'money' },
  { id: 'manual_correction', type: 'manual_correction', label: 'Manual correction', hint: 'A correction is a new event rather than an edit, so the change history stays true.', needs: 'signed' },
];

/** A key for one intended write, generated once and reused across a retry.
 *  randomUUID is not present on every runtime this could be opened in, and a
 *  missing key would silently turn the retry guard off, so there is a
 *  fallback rather than a throw. */
export function newWriteKey(): string {
  const c = typeof crypto !== 'undefined' ? crypto : undefined;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  return `k${Date.now().toString(36)}${Math.random().toString(36).slice(2, 14)}`;
}

const toPence = (text: string, signed = false): number => {
  const negative = signed && text.trim().startsWith('-');
  const n = Math.round(Number(text.replace(/[^0-9.]/g, '')) * 100) || 0;
  return negative ? -n : n;
};

export function Settle({
  bet, currency, oddsFormat, onWritten,
}: {
  bet: DemoBet;
  currency: Currency;
  oddsFormat: OddsFormat;
  /** Fired after a write lands, so the sheet can say the ledger moved. */
  onWritten?: () => void;
  tz?: TimeZone;
}) {
  const settled = bet.state.status === 'settled';
  const [choiceId, setChoiceId] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [openMore, setOpenMore] = useState(false);
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState('');
  const [done, setDone] = useState(false);
  const [writeKey, setWriteKey] = useState(newWriteKey);

  const odds = effectiveOdds(bet);
  const remaining = bet.state.remainingStakePence;

  /*  A settled bet can still take an adjustment: a Rule 4, the commission
      the exchange took, a promo refund landing a week later, a correction.
      It cannot take a second result, because the fold ignores one and a
      control that writes an ignored row is a control that lies. */
  const choices: Choice[] = settled
    ? ADJUSTMENTS
    : [...RESULTS, ...(bet.isEachWay ? [PLACED] : [])];
  const more: Choice[] = settled ? [] : [...OTHER, ...ADJUSTMENTS];
  const choice = [...choices, ...more].find((c) => c.id === choiceId) ?? null;

  const pick = (id: string) => {
    setChoiceId(id === choiceId ? null : id);
    setAmount('');
    setNote('');
    setDone(false);
    // A different intended write is a different key, or a retry guard would
    // swallow the second, deliberate one.
    setWriteKey(newWriteKey());
  };

  const deduction = Math.max(0, Math.min(90, Math.round(Number(amount.replace(/[^0-9]/g, '')) || 0)));
  const pct = Math.max(0, Number(amount.replace(/[^0-9.]/g, '')) || bet.commissionPct || 0);

  const pending: SettlementEvent | null = useMemo(() => {
    if (!choice) return null;
    return {
      id: 'preview', betId: bet.id,
      seq: (bet.events[bet.events.length - 1]?.seq ?? 0) + 1,
      type: choice.type,
      fractionEighths: null,
      returnedPence: choice.needs === 'money' ? toPence(amount)
        : choice.needs === 'signed' ? toPence(amount, true) : null,
      deductionPence: choice.needs === 'deduction' ? deduction : null,
      commissionPct: choice.needs === 'pct' ? pct : null,
      occurredAt: new Date().toISOString(), enteredBy: 'you',
      afterResultKnown: settled, note: null, createdAt: new Date().toISOString(),
    };
  }, [choice, amount, bet, deduction, pct, settled]);

  /*  THE SAME FOLD PRODUCTION USES. Deriving the preview any other way would
      put a second implementation of settlement in the browser, which rule 2
      exists to prevent, and would let the figure on the button disagree with
      the figure that lands. */
  const preview = useMemo(
    () => (pending ? recompute(bet, [...bet.events, pending], new Date().toISOString()) : null),
    [bet, pending],
  );

  async function write() {
    if (!choice || !pending) return;
    setSaving(true);
    setNote('');
    try {
      const res = await fetch(`/api/bets/${bet.id}/events`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          type: choice.type,
          returnedPence: pending.returnedPence,
          deductionPence: pending.deductionPence,
          commissionPct: pending.commissionPct,
          idempotencyKey: writeKey,
        }),
      });
      const b = await res.json().catch(() => ({}));
      if (res.ok) {
        setDone(true);
        setNote('Written. The event was appended and every figure above it was recomputed in the same transaction.');
        setWriteKey(newWriteKey());
        onWritten?.();
      } else {
        setNote((b.message as string) || 'Nothing was written.');
      }
    } catch {
      setNote('That did not reach the server, so nothing was written.');
    }
    setSaving(false);
  }

  /*  AN EVENT THAT WOULD CHANGE NOTHING IS NOT OFFERED.
   *
   *  A Rule 4 and a commission both come off NET WINNINGS, so both take
   *  exactly nothing on a bet that has not produced any yet, and the button
   *  would have written a row into an append only ledger that moved no
   *  figure and could not be removed. The order matters and it is not
   *  guessable from the screen, so the screen says it: record the result,
   *  then the deduction lands on it.
   *
   *  The same guard catches an empty amount box on a refund or a correction,
   *  which would otherwise write a zero. */
  const needsAmount = (choice?.needs === 'money' || choice?.needs === 'signed') && amount.trim() === '';
  const changesNothing = Boolean(preview)
    && bet.state.remainingStakePence === preview!.remainingStakePence
    && bet.state.returnedPence === preview!.returnedPence
    && bet.state.realisedPlPence === preview!.realisedPlPence
    && bet.state.status === preview!.status;
  const blocked = needsAmount || changesNothing;
  const blockedWhy = needsAmount
    ? 'Type the amount and this will say what it does before it writes anything.'
    : choice?.type === 'rule4'
      ? 'A Rule 4 comes off net winnings, and this bet has none yet. Record the result first and the deduction lands on it.'
      : choice?.type === 'commission'
        ? 'Commission is charged on net winnings only, and this bet has none yet. A losing bet pays none at all.'
        : 'This would write an event that moves no figure, so there is nothing to record.';

  const ungraded = bet.legs.filter((l) => l.legResult === 'open').length;
  const outcomeWord = preview?.outcome
    ? preview.outcome.replace('cash-', 'cash out, ').replace('profit', 'a profit').replace('loss', 'a loss').replace('flat', 'level')
    : 'still open';

  return (
    <div className="card" style={{ background: 'var(--surface-2)', marginBottom: 'var(--s5)' }}>
      <p className="card__title">{settled ? 'Something else happened' : 'Settle this bet'}</p>
      <p className="small muted" style={{ marginTop: 'var(--s2)' }}>
        {settled
          ? `This bet has a result. A correction, a Rule 4, the commission ${bookmakerName(bet.bookmakerId)} took or a refund that landed later is a new event on top of it, never an edit.`
          : `${money(remaining, currency)} is still standing at ${formatOdds(odds, oddsFormat)}. Nothing here is guessed: pick what actually happened and the figures below are what will be written.`}
      </p>

      {ungraded > 0 && !settled ? (
        <p className="small muted" style={{ marginTop: 'var(--s3)' }}>
          <Icon name="alert" size={15} className="dim" />{' '}
          {ungraded === bet.legs.length
            ? `None of the ${bet.legs.length} legs has graded yet.`
            : `${ungraded} of the ${bet.legs.length} legs has not graded yet.`}{' '}
          Settling here settles the whole bet at the price shown.
        </p>
      ) : null}

      <div className="row row--wrap" style={{ gap: 'var(--s2)', marginTop: 'var(--s4)' }}>
        {choices.map((c) => (
          <button
            key={c.id}
            type="button"
            className={`btn btn--sm ${choiceId === c.id ? 'btn--primary' : 'btn--ghost'}`}
            aria-pressed={choiceId === c.id}
            onClick={() => pick(c.id)}
          >
            {c.label}
          </button>
        ))}
      </div>

      {more.length ? (
        <div style={{ marginTop: 'var(--s3)' }}>
          <button
            type="button"
            className="btn btn--link btn--sm"
            aria-expanded={openMore}
            onClick={() => setOpenMore(!openMore)}
          >
            {openMore ? 'Fewer options' : 'Something else happened'}
          </button>
          {openMore ? (
            <div className="row row--wrap" style={{ gap: 'var(--s2)', marginTop: 'var(--s3)' }}>
              {more.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className={`btn btn--sm ${choiceId === c.id ? 'btn--primary' : 'btn--quiet'}`}
                  aria-pressed={choiceId === c.id}
                  onClick={() => pick(c.id)}
                >
                  {c.label}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {choice ? (
        <>
          <p className="small muted" style={{ marginTop: 'var(--s4)' }}>{choice.hint}</p>

          {choice.needs === 'money' || choice.needs === 'signed' ? (
            <div className="field">
              <label className="field__label" htmlFor="settle-amount">
                {choice.type === 'cash_out_full' ? 'What the bookmaker paid'
                  : choice.type === 'promo_refund' ? 'What came back'
                    : 'The correction, minus to take money off'}
              </label>
              <input
                id="settle-amount" className="input input--money" inputMode="decimal" autoComplete="off"
                value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00"
              />
            </div>
          ) : null}

          {choice.needs === 'deduction' ? (
            <div className="field">
              <label className="field__label" htmlFor="settle-r4">Pence in the pound</label>
              <input
                id="settle-r4" className="input" inputMode="numeric" autoComplete="off"
                value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="25"
                aria-describedby="settle-r4-hint"
              />
              <span className="field__hint" id="settle-r4-hint">
                Between 0 and 90. It comes off the net winnings, never off the stake and never off
                the price you took.
              </span>
            </div>
          ) : null}

          {choice.needs === 'pct' ? (
            <div className="field">
              <label className="field__label" htmlFor="settle-pct">Commission, per cent</label>
              <input
                id="settle-pct" className="input" inputMode="decimal" autoComplete="off"
                value={amount} onChange={(e) => setAmount(e.target.value)}
                placeholder={String(bet.commissionPct || 0)}
                aria-describedby="settle-pct-hint"
              />
              <span className="field__hint" id="settle-pct-hint">
                {bet.commissionPct > 0
                  ? `Left blank it uses ${bet.commissionPct}%, the rate frozen on this bet when it was placed.`
                  : 'This bet was placed with no commission rate on it, so this is only worth using if the bookmaker took one.'}
              </span>
            </div>
          ) : null}

          {/*  WHAT THIS WOULD DO TO THE FIGURES, before the press. Both
               columns come out of the same fold, so the "now" is the stored
               state and the "after" is what will replace it. */}
          {preview ? (
            <>
              <div className="hr" />
              <p className="label">What this writes</p>
              <ul style={{ marginTop: 'var(--s2)' }}>
                <li className="brow">
                  <span className="brow__title">Stake still standing</span>
                  <span className="fig fig--s tnum">
                    {money(bet.state.remainingStakePence, currency)} to {money(preview.remainingStakePence, currency)}
                  </span>
                </li>
                <li className="brow">
                  <span className="brow__title">Returned</span>
                  <span className="fig fig--s tnum">
                    {money(bet.state.returnedPence, currency)} to {money(preview.returnedPence, currency)}
                  </span>
                </li>
                <li className="brow sum__foot sum__rule">
                  <span className="brow__title">Profit on this bet</span>
                  <span className={`fig fig--s tnum ${preview.realisedPlPence > 0 ? 'pos' : preview.realisedPlPence < 0 ? 'neg' : ''}`}>
                    {money(preview.realisedPlPence, currency, { sign: true })}
                  </span>
                </li>
                <li className="brow sum__foot">
                  <span className="brow__title">Units</span>
                  <span className="fig fig--s tnum">{fmtUnits(preview.units, { sign: true })}</span>
                </li>
                <li className="brow sum__foot">
                  <span className="brow__title">It reads as</span>
                  <span className="fig fig--s">{outcomeWord}</span>
                </li>
              </ul>

              <button
                type="button"
                className="btn btn--primary btn--wide"
                style={{ marginTop: 'var(--s4)' }}
                onClick={write}
                disabled={saving || done || blocked}
                aria-describedby={blocked ? 'settle-blocked' : undefined}
              >
                {saving ? 'Writing' : done ? 'Written' : `Record it as ${choice.label.toLowerCase()}`}
              </button>
              {blocked ? (
                <p className="small muted" id="settle-blocked" style={{ marginTop: 'var(--s3)' }}>
                  {blockedWhy}
                </p>
              ) : null}
            </>
          ) : null}
        </>
      ) : null}

      {note ? <p className="small muted" role="status" style={{ marginTop: 'var(--s3)' }}>{note}</p> : null}
    </div>
  );
}
