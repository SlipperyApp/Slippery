'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Icon } from '@/components/Icon';
import { money, units as fmtUnits, CURRENCY_WORD } from '@/lib/format';
import { accaOdds, formatOdds } from '@/lib/odds';
import { BalanceChoice } from '@/components/app/BalanceChoice';
import type { Currency } from '@/lib/domain/types';

type Leg = { selection: string; eventName: string; market: string; odds: string };

const SHAPES = [
  { id: 'single', label: 'Single', legs: 1 },
  { id: 'double', label: 'Double', legs: 2 },
  { id: 'treble', label: 'Treble', legs: 3 },
  { id: 'acca', label: 'Accumulator', legs: 4 },
  { id: 'each_way', label: 'Each way', legs: 1 },
  { id: 'lucky15', label: 'Lucky 15', legs: 4 },
  { id: 'yankee', label: 'Yankee', legs: 4 },
  { id: 'trixie', label: 'Trixie', legs: 3 },
  { id: 'patent', label: 'Patent', legs: 3 },
  { id: 'heinz', label: 'Heinz', legs: 6 },
  { id: 'lucky63', label: 'Lucky 63', legs: 6 },
  { id: 'goliath', label: 'Goliath', legs: 8 },
];

/** How many lines a permed bet actually is. A Lucky 15 is fifteen bets from
 *  four selections, and the stake box means stake PER LINE. */
const LINES: Record<string, number> = {
  single: 1, double: 1, treble: 1, acca: 1, each_way: 2,
  trixie: 4, patent: 7, yankee: 11, lucky15: 15,
  heinz: 57, lucky63: 63, goliath: 247,
};

const blankLeg = (): Leg => ({ selection: '', eventName: '', market: 'Match result', odds: '' });

export function ManualEntry({
  bookmakers, sports, unitPence, currency, balances, balanceId, balanceName,
}: {
  bookmakers: { id: string; name: string }[];
  sports: { id: string; name: string }[];
  /** The OPEN BALANCE'S unit and currency, not the account's. The page reads
   *  them off the viewer, which is already scoped to one balance, so choosing
   *  another one re-denominates every figure in this form on the refresh. */
  unitPence: number;
  currency: Currency;
  balances: { id: string; name: string; currency: Currency }[];
  balanceId: string;
  balanceName: string;
}) {
  const router = useRouter();
  const [shape, setShape] = useState('single');
  const [side, setSide] = useState<'back' | 'lay'>('back');
  const [legs, setLegs] = useState<Leg[]>([blankLeg()]);
  const [stakeText, setStakeText] = useState('');
  const [bookmaker, setBookmaker] = useState('bet365');
  const [sport, setSport] = useState('football');
  const [placedAt, setPlacedAt] = useState('');
  const [freeBet, setFreeBet] = useState(false);
  const [boosted, setBoosted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  const wanted = SHAPES.find((s) => s.id === shape)?.legs ?? 1;
  const lines = LINES[shape] ?? 1;
  const stakePence = Math.round(Number(stakeText.replace(/[^0-9.]/g, '')) * 100) || 0;
  const totalPence = stakePence * lines;

  function setShapeAndLegs(next: string) {
    setShape(next);
    const n = SHAPES.find((s) => s.id === next)?.legs ?? 1;
    setLegs((cur) => {
      const out = [...cur];
      while (out.length < n) out.push(blankLeg());
      return out.slice(0, Math.max(n, out.length > n ? n : out.length));
    });
  }

  const priced = legs.filter((l) => Number(l.odds) > 1).map((l) => Number(l.odds));
  const combined = useMemo(() => (priced.length ? accaOdds(priced) : 0), [priced.join(',')]);

  const complete = legs.slice(0, wanted).every((l) => l.selection.trim() && Number(l.odds) > 1);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!complete) { setError('Every selection needs a name and a price above 1.00.'); return; }
    if (stakePence < 1) { setError('A stake is needed. For a permed bet it is the stake per line.'); return; }
    setError(''); setSaving(true); setNote('');
    try {
      const res = await fetch('/api/bets', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          source: 'manual', shape, side, bookmaker, sport,
          stakePence, lines, placedAt: placedAt || null,
          legs: legs.slice(0, wanted),
          promotional: { freeBet, boosted, bonusFunds: false },
        }),
      });
      const b = await res.json().catch(() => ({}));
      if (res.ok) { router.push('/app/ledger'); return; }
      setNote((b.message as string) || 'Nothing was written.');
    } catch {
      setNote('That did not reach the server, so nothing was written.');
    }
    setSaving(false);
  }

  return (
    <form onSubmit={submit} noValidate className="grid">
      <div className="col-8" style={{ display: 'grid', gap: 'var(--s4)', alignContent: 'start' }}>
        <section className="card">
          <h2 className="card__title">What kind of bet</h2>
          <div className="seg" role="group" aria-label="Bet type" style={{ marginTop: 'var(--s3)', flexWrap: 'wrap' }}>
            {SHAPES.map((s) => (
              <button key={s.id} type="button" className="seg__btn" aria-pressed={shape === s.id} onClick={() => setShapeAndLegs(s.id)}>
                {s.label}
              </button>
            ))}
          </div>
          <p className="small dim" style={{ marginTop: 'var(--s3)' }}>
            {lines > 1
              ? `${SHAPES.find((s) => s.id === shape)?.label} is ${lines} lines from ${wanted} selections. The stake below is per line.`
              : 'One line, one stake.'}
          </p>

          <div className="seg" role="group" aria-label="Side" style={{ marginTop: 'var(--s4)' }}>
            {(['back', 'lay'] as const).map((s) => (
              <button key={s} type="button" className="seg__btn" aria-pressed={side === s} onClick={() => setSide(s)}>
                {s === 'back' ? 'Back' : 'Lay'}
              </button>
            ))}
          </div>
          {side === 'lay' ? (
            <p className="small dim" style={{ marginTop: 'var(--s2)' }}>
              A lay risks its liability, and the liability is what the return is measured
              against. It is never averaged into your back-bet prices.
            </p>
          ) : null}
        </section>

        <section className="card">
          <div className="card__head">
            <h2 className="card__title">Selections</h2>
            <p className="card__note">{wanted} needed</p>
          </div>
          <ul style={{ display: 'grid', gap: 'var(--s4)' }}>
            {legs.slice(0, Math.max(wanted, legs.length)).map((l, i) => (
              <li key={i} style={{ borderTop: i ? '1px solid var(--line)' : undefined, paddingTop: i ? 'var(--s4)' : 0 }}>
                <p className="label" style={{ marginBottom: 'var(--s2)' }}>Selection {i + 1}{i >= wanted ? ' (spare)' : ''}</p>
                <div className="field" style={{ marginTop: 0 }}>
                  <label className="field__label" htmlFor={`sel-${i}`}>What you backed</label>
                  <input id={`sel-${i}`} className="input" autoComplete="off" value={l.selection}
                    onChange={(e) => setLegs(legs.map((x, k) => (k === i ? { ...x, selection: e.target.value } : x)))}
                    placeholder="Arsenal to win" />
                </div>
                <div className="field">
                  <label className="field__label" htmlFor={`ev-${i}`}>Fixture or race</label>
                  <input id={`ev-${i}`} className="input" autoComplete="off" value={l.eventName}
                    onChange={(e) => setLegs(legs.map((x, k) => (k === i ? { ...x, eventName: e.target.value } : x)))}
                    placeholder="Arsenal v Brentford" />
                </div>
                <div className="row" style={{ gap: 'var(--s3)', alignItems: 'flex-end' }}>
                  <div className="field grow" style={{ marginTop: 'var(--s4)' }}>
                    <label className="field__label" htmlFor={`mk-${i}`}>Market</label>
                    <input id={`mk-${i}`} className="input" autoComplete="off" value={l.market}
                      onChange={(e) => setLegs(legs.map((x, k) => (k === i ? { ...x, market: e.target.value } : x)))} />
                  </div>
                  <div className="field" style={{ marginTop: 'var(--s4)', width: '120px' }}>
                    <label className="field__label" htmlFor={`od-${i}`}>Price</label>
                    <input id={`od-${i}`} className="input mono" inputMode="decimal" autoComplete="off" value={l.odds}
                      onChange={(e) => setLegs(legs.map((x, k) => (k === i ? { ...x, odds: e.target.value } : x)))}
                      placeholder="2.50" />
                  </div>
                </div>
              </li>
            ))}
          </ul>
          {shape === 'acca' ? (
            <div className="card__foot row" style={{ gap: 'var(--s3)' }}>
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => setLegs([...legs, blankLeg()])}>
                <Icon name="plus" size={15} /> Another leg
              </button>
              {legs.length > 4 ? (
                <button type="button" className="btn btn--quiet btn--sm" onClick={() => setLegs(legs.slice(0, -1))}>
                  Remove the last
                </button>
              ) : null}
            </div>
          ) : null}
        </section>
      </div>

      <div className="col-4" style={{ display: 'grid', gap: 'var(--s4)', alignContent: 'start' }}>
        <section className="card">
          <h2 className="card__title">The bet</h2>

          {/*  WHICH BALANCE, FIRST, above the stake it denominates. The stake
               box below is in this balance's currency and the unit beside it
               is this balance's unit, so the choice has to be made before the
               figure is read rather than discovered after it is written. */}
          <BalanceChoice
            balances={balances}
            current={balanceId}
            unitMinor={unitPence}
          />

          <div className="field">
            <label className="field__label" htmlFor="mn-stake">
              {lines > 1 ? 'Stake per line' : side === 'lay' ? 'Backer’s stake' : 'Stake'}
            </label>
            <input id="mn-stake" className="input input--money" inputMode="decimal" autoComplete="off"
              value={stakeText} onChange={(e) => setStakeText(e.target.value)} placeholder="25.00" />
            <span className="field__hint">
              {stakePence > 0 ? (
                <>
                  {lines > 1 ? <>{money(totalPence, currency)} in total across {lines} lines. </> : null}
                  {unitPence > 0
                    ? <>{fmtUnits(totalPence / unitPence)} at your unit of {money(unitPence, currency)}.</>
                    : <>Set a unit in Settings and this says what the stake is worth in units.</>}
                </>
              ) : (
                /*  IT SAID "In pounds and pence" ON A EURO BALANCE. The stake
                    is denominated by the balance, so the sentence naming the
                    money has to come from the balance too. */
                <>In {CURRENCY_WORD[currency]}, into {balanceName}.</>
              )}
            </span>
          </div>

          <div className="field">
            <label className="field__label" htmlFor="mn-book">Bookmaker</label>
            <select id="mn-book" className="select" value={bookmaker} onChange={(e) => setBookmaker(e.target.value)}>
              {bookmakers.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>

          <div className="field">
            <label className="field__label" htmlFor="mn-sport">Sport</label>
            <select id="mn-sport" className="select" value={sport} onChange={(e) => setSport(e.target.value)}>
              {sports.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>

          <div className="field">
            <label className="field__label" htmlFor="mn-when">When it kicks off</label>
            <input id="mn-when" className="input" type="datetime-local" value={placedAt}
              onChange={(e) => setPlacedAt(e.target.value)} />
            <span className="field__hint">
              UK time. This is what every period total is worked out from, not when you placed it.
            </span>
          </div>
        </section>

        <section className="card">
          <h2 className="card__title">Promotional</h2>
          <div className="switchrow">
            <span className="brow__title">Free bet</span>
            <button type="button" className="switch" aria-pressed={freeBet} aria-label={`Free bet: ${freeBet ? 'on' : 'off'}`} onClick={() => setFreeBet(!freeBet)} />
          </div>
          <div className="switchrow">
            <span className="brow__title">Price boost</span>
            <button type="button" className="switch" aria-pressed={boosted} aria-label={`Price boost: ${boosted ? 'on' : 'off'}`} onClick={() => setBoosted(!boosted)} />
          </div>
          <p className="small dim card__foot">
            Flagged now because it is impossible to separate later, and it is the difference between
            money you won and money they gave you.
          </p>
        </section>

        <section className="card">
          {combined > 1 && wanted > 1 ? (
            <>
              <p className="label">Combined price</p>
              <p className="fig fig--m tnum">{formatOdds(combined, 'decimal')}</p>
              <p className="small dim" style={{ marginTop: 4 }}>
                {priced.length} of {wanted} priced. A void leg would drop out and this would
                recalculate.
              </p>
            </>
          ) : (
            <>
              <p className="label">To return</p>
              <p className="fig fig--m tnum">
                {money(Math.round(stakePence * (Number(legs[0]?.odds) || 0)), currency)}
              </p>
            </>
          )}
          {error ? <p className="field__err" role="alert" style={{ marginTop: 'var(--s3)' }}>{error}</p> : null}
          <button type="submit" className="btn btn--primary btn--wide" style={{ marginTop: 'var(--s4)' }} disabled={saving}>
            {saving ? 'Writing' : 'Add to my ledger'}
          </button>
          {note ? <p className="small muted" role="status" style={{ marginTop: 'var(--s3)' }}>{note}</p> : null}
        </section>
      </div>
    </form>
  );
}
