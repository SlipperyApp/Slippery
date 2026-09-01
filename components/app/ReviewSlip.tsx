'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Icon } from '@/components/Icon';
import { CONFIDENCE_COPY, type Confidence, type SlipRead } from '@/lib/data/read';

/** The icon carries the confidence. The VALUE never does.
 *
 *  #86EFAC and #FCA5A5 mean profit and loss. Letting green also mean "read
 *  cleanly" and red also mean "not on the slip" puts four meanings on two
 *  colours, on a screen that is about to write money into a ledger. */
const TONE: Record<Confidence, { icon: 'check' | 'help' | 'alert' | 'minus'; cls: string }> = {
  high: { icon: 'check', cls: 'ok' },
  medium: { icon: 'help', cls: 'ask' },
  low: { icon: 'alert', cls: 'ask' },
  missing: { icon: 'minus', cls: 'gap' },
};

export function ReviewSlip({ read }: { read: SlipRead }) {
  const router = useRouter();
  const [legs, setLegs] = useState(read.legs);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [free, setFree] = useState(read.promotional.freeBet);
  const [boost, setBoost] = useState(read.promotional.boosted);
  const [bonus, setBonus] = useState(read.promotional.bonusFunds);
  const [saving, setSaving] = useState(false);
  const [flagged, setFlagged] = useState(false);
  const [note, setNote] = useState('');

  const gaps = legs.filter((l) => !l.odds).length
    + read.fields.filter((f) => f.confidence === 'missing' && !answers[f.key]).length;
  const questions = read.fields.filter((f) => f.question);

  async function confirm() {
    setSaving(true);
    setNote('');
    try {
      const res = await fetch('/api/bets', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          source: 'web_upload',
          shape: read.shape,
          bookmaker: read.bookmaker,
          legs,
          answers,
          promotional: { freeBet: free, boosted: boost, bonusFunds: bonus },
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

  async function flag() {
    setFlagged(true);
    await fetch('/api/reads/flag', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ readId: read.id }),
    }).catch(() => null);
  }

  return (
    <div className="grid">
      <div className="col-8" style={{ display: 'grid', gap: 'var(--s4)', alignContent: 'start' }}>
        <section className="card">
          <div className="card__head">
            <div>
              <h2 className="card__title">{read.shape}</h2>
              <p className="small dim">{read.bookmaker} template, matched cleanly</p>
            </div>
            <span className="pill pill--accent">{legs.length} selections</span>
          </div>

          <ul>
            {read.fields.map((f) => {
              const t = TONE[f.confidence];
              return (
                <li key={f.key} className="brow" style={{ gridTemplateColumns: '20px minmax(0,1fr) auto', gap: 'var(--s3)' }}>
                  <Icon name={t.icon} size={16} className={`readmark readmark--${t.cls}`} />
                  <span style={{ minWidth: 0 }}>
                    <span className="brow__title" style={{ display: 'block' }}>{f.label}</span>
                    {f.saw ? <span className="brow__sub" style={{ display: 'block' }}>Saw: <span className="mono">{f.saw}</span></span> : null}
                    <span className="brow__sub">{CONFIDENCE_COPY[f.confidence].note}</span>
                  </span>
                  <span className="fig fig--s tnum">{f.value}</span>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="card">
          <h2 className="card__title">Selections</h2>
          <ul style={{ marginTop: 'var(--s3)' }}>
            {legs.map((l, i) => (
              <li key={l.selection} className="brow" style={{ gridTemplateColumns: 'minmax(0,1fr) 110px', gap: 'var(--s3)' }}>
                <span style={{ minWidth: 0 }}>
                  <span className="brow__title" style={{ display: 'block' }}>{l.selection}</span>
                  <span className="brow__sub">{l.fixture}</span>
                </span>
                <span>
                  <label className="sr-only" htmlFor={`odds-${i}`}>Price for {l.selection}</label>
                  <input
                    id={`odds-${i}`}
                    className="input mono"
                    inputMode="decimal"
                    autoComplete="off"
                    value={l.odds}
                    placeholder="Not read"
                    aria-invalid={!l.odds ? true : undefined}
                    onChange={(e) => setLegs(legs.map((x, k) => (k === i ? { ...x, odds: e.target.value } : x)))}
                    style={!l.odds ? { borderColor: 'var(--neg-line)' } : undefined}
                  />
                </span>
              </li>
            ))}
          </ul>
          {legs.some((l) => !l.odds) ? (
            <p className="small muted card__foot">
              One price was not on the slip and is not being guessed. A missing price is visible;
              a wrong one is not.
            </p>
          ) : null}
        </section>

        {questions.length ? (
          <section className="card">
            <h2 className="card__title">{questions.length === 1 ? 'One question' : `${questions.length} questions`}</h2>
            <p className="small muted" style={{ marginTop: 'var(--s2)' }}>
              Targeted, not a whole form to fill in again.
            </p>
            <ul style={{ marginTop: 'var(--s3)' }}>
              {questions.map((f) => (
                <li key={f.key} style={{ borderTop: '1px solid var(--line)', paddingTop: 'var(--s3)', marginTop: 'var(--s3)' }}>
                  <p className="small">{f.question}</p>
                  <div className="row" style={{ gap: 'var(--s2)', marginTop: 'var(--s3)' }}>
                    {['Yes', 'No', 'Not sure'].map((a) => (
                      <button
                        key={a} type="button" className="seg__btn"
                        aria-pressed={answers[f.key] === a}
                        onClick={() => setAnswers({ ...answers, [f.key]: a })}
                        style={answers[f.key] === a ? { background: 'var(--surface-3)', color: 'var(--ink)' } : undefined}
                      >
                        {a}
                      </button>
                    ))}
                  </div>
                  {answers[f.key] === 'Not sure' ? (
                    <p className="small dim" style={{ marginTop: 'var(--s2)' }}>
                      Then it stays unanswered and this bet is held out of your aggregates until it
                      settles. That is the safe direction.
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>

      <div className="col-4" style={{ display: 'grid', gap: 'var(--s4)', alignContent: 'start' }}>
        <section className="card">
          <h2 className="card__title">Money you won, or money they gave you</h2>
          <p className="small muted" style={{ marginTop: 'var(--s2)' }}>
            Flagged here, at ingestion, because it is impossible to work out later.
          </p>
          <div style={{ marginTop: 'var(--s3)' }}>
            {[
              { on: free, set: setFree, t: 'Free bet', s: 'Stake is not returned, and it leaves turnover.' },
              { on: bonus, set: setBonus, t: 'Bonus funds', s: 'Counts to the promotional half of the headline.' },
              { on: boost, set: setBoost, t: 'Price boost', s: 'The uplift is promotional money.' },
            ].map((r) => (
              <div key={r.t} className="switchrow">
                <span style={{ minWidth: 0 }}>
                  <span className="brow__title" style={{ display: 'block' }}>{r.t}</span>
                  <span className="brow__sub">{r.s}</span>
                </span>
                <button
                  type="button" className="switch" aria-pressed={r.on}
                  aria-label={`${r.t}: ${r.on ? 'on' : 'off'}`}
                  onClick={() => r.set(!r.on)}
                />
              </div>
            ))}
          </div>
        </section>

        <section className="card">
          <button
            type="button"
            className="btn btn--primary btn--wide"
            onClick={confirm}
            disabled={saving || gaps > 0}
            aria-describedby="confirm-note"
          >
            {saving ? 'Writing' : gaps > 0 ? `${gaps} field${gaps === 1 ? '' : 's'} still open` : 'Confirm and add to my ledger'}
          </button>
          <p className="small dim" id="confirm-note" style={{ marginTop: 'var(--s3)' }}>
            {gaps > 0
              ? 'Confirm stays off until the gaps are filled. Nothing is written half read.'
              : 'Writes the bet and its first settlement event in one transaction.'}
          </p>
          {note ? <p className="small muted" role="status" style={{ marginTop: 'var(--s3)' }}>{note}</p> : null}
        </section>

        <section className="card">
          <h2 className="card__title">Read it wrong?</h2>
          <p className="small muted" style={{ marginTop: 'var(--s2)' }}>
            Flag it and the slip goes back for a human look. The slip returns to your allowance:
            our worst moment should not cost you one.
          </p>
          <button
            type="button"
            className={`btn btn--wide ${flagged ? 'btn--ghost' : 'btn--danger'}`}
            style={{ marginTop: 'var(--s4)' }}
            onClick={flag}
            disabled={flagged}
          >
            <Icon name="flag" size={16} />
            {flagged ? 'Flagged, and the credit is back' : 'Flag this read'}
          </button>
          <p className="small dim card__foot">
            Or <Link href="/app/import/manual">type it in yourself</Link> instead.
          </p>
        </section>
      </div>
    </div>
  );
}
