'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Icon } from '@/components/Icon';
import { CONFIDENCE_COPY, type Confidence, type SlipRead } from '@/lib/data/read';
import { useSlipFlow } from '@/components/app/SlipFlow';
import { BalanceChoice } from '@/components/app/BalanceChoice';
import { currencyAgrees } from '@/lib/domain/balances';
import { CURRENCY_WORD, dateTime, money, parseMoneyMinor, type Currency } from '@/lib/format';

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

/** The stake is the one field with a shape of its own: it is money, so it is
 *  integer minor units or it is nothing. A stake typed as 19.99 that reaches
 *  a ledger as 1998.9999999999998 pence is the reason this does not go
 *  through Number(). */
function stakeOf(read: SlipRead, typed: string): number | null {
  if (read.stakeMinor !== null) return read.stakeMinor;
  return parseMoneyMinor(typed)?.minor ?? null;
}

export function ReviewSlip({ fallback, balances, balanceId, unitMinor }: {
  fallback: SlipRead;
  /** Every balance on the account, and which one is open. A slip lands in the
   *  open one, so the screen that writes it has to say which that is and let
   *  it be changed before the write rather than after. */
  balances: { id: string; name: string; currency: Currency }[];
  balanceId: string;
  unitMinor: number;
}) {
  const router = useRouter();
  const flow = useSlipFlow();
  const read = flow.read ?? fallback;
  const balance = balances.find((b) => b.id === balanceId) ?? balances[0] ?? null;

  const [legs, setLegs] = useState(read.legs);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [free, setFree] = useState(read.promotional.freeBet);
  const [boost, setBoost] = useState(read.promotional.boosted);
  const [bonus, setBonus] = useState(read.promotional.bonusFunds);
  const [saving, setSaving] = useState(false);
  const [flagged, setFlagged] = useState(false);
  const [flagNote, setFlagNote] = useState('');
  const [note, setNote] = useState('');
  /*  A duplicate is ASKED ABOUT, never decided here. Silently skipping loses
   *  a real second bet and silently saving is how one slip became two rows in
   *  the ledger and two of everything in the aggregates. Confirm stays off
   *  until this is answered, and answering it is one press. */
  const [duplicateOk, setDuplicateOk] = useState(false);
  const duplicate = read.duplicateOf;

  /*  WHAT THE FIGURES ON THIS SCREEN ARE IN. It defaulted to GBP whenever the
   *  reader had not found a currency on the slip, on a screen that then wrote
   *  the stake into whichever balance was open: on a euro balance the review
   *  showed a sterling total for a stake the ledger recorded in euro.
   *
   *  The slip's own currency comes first, because these figures are what was
   *  READ and a stake seen as £1.00 is one pound whatever balance is open.
   *  Where the reader found none, the balance decides, because the balance is
   *  what the write will be denominated in. Where the two DISAGREE the write
   *  is held rather than converted: see `wrongCurrency` below. */
  const currency: Currency = read.currency ?? balance?.currency ?? 'GBP';
  const wrongCurrency = !currencyAgrees(read.currency, balance?.currency ?? null);
  const stakeMinor = stakeOf(read, answers.stake ?? '');
  /*  THE ID GOES TO THE SERVER, NOT THE NAME. bookmaker_id is a key: the
      commission rate, the handicap convention and the breakdown row are all
      looked up from it, and "Betfair Exchange" as an id looks like a
      bookmaker on the row and behaves as one nowhere else. The template
      detector returns an id or the word unknown, and when it is unknown the
      person answers the question and the server resolves what they typed. */
  const bookmaker = read.bookmakerId !== 'unknown'
    ? read.bookmakerId
    : (answers.bookmaker ?? '');
  /*  What to SHOW, which is a name. The two were one variable and the name
      was the one that travelled. */
  const bookmakerLabel = read.bookmaker || (answers.bookmaker ?? '');

  /*  What is still open. A question with a required flag holds the write; one
   *  without it is worth asking and not worth blocking on, and the difference
   *  is whether a wrong answer would put a wrong number in the ledger. */
  const openFields = read.fields.filter(
    (f) => f.confidence !== 'high' && f.required && !(answers[f.key] ?? '').trim(),
  );
  const openStake = stakeMinor === null || stakeMinor < 1;
  const openLegs = legs.filter((l) => !(Number(l.odds) > 1) || !l.selection.trim());
  const open = openFields.length + openLegs.length + (openStake && !openFields.some((f) => f.key === 'stake') ? 1 : 0);

  const questions = read.fields.filter((f) => f.confidence !== 'high');
  const totalMinor = stakeMinor === null ? null : stakeMinor * Math.max(1, read.lines);
  const heldOnDuplicate = Boolean(duplicate) && !duplicateOk;

  async function confirm() {
    if (open > 0 || stakeMinor === null || heldOnDuplicate || wrongCurrency) return;
    setSaving(true);
    setNote('');
    try {
      const res = await fetch('/api/bets', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          source: 'web_upload',
          shape: read.eachWay ? 'each_way' : 'single',
          bookmaker: bookmaker || undefined,
          // Integer minor units per line, and the line count beside it. The
          // server multiplies; nothing here sends a total it worked out
          // itself from a float.
          stakePence: stakeMinor,
          lines: Math.max(1, read.lines),
          placedAt: read.placedAt ?? undefined,
          sha256: flow.sha256 ?? undefined,
          /*  WHAT THE SLIP SAID IT WAS IN, so the route can refuse a euro
              slip confirmed against a sterling balance rather than record
              fifty euro as fifty pounds. It is not a request to write in that
              currency: the balance decides that and always has. */
          currency: read.currency ?? undefined,
          legs: legs.map((l) => ({
            selection: l.selection,
            eventName: l.fixture,
            market: l.market,
            odds: Number(l.odds),
          })),
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
    /*  THE SERVER SAYS WHETHER THE CREDIT WENT BACK, and this prints what it
        said. The button used to relabel itself "Flagged, and the credit is
        back" the instant it was pressed, whatever happened at the other end,
        and the route it called refunded a slip on every press against a read
        id it never checked existed. Both halves of that were a claim nothing
        kept. */
    try {
      const res = await fetch('/api/reads/flag', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ readId: read.id }),
      });
      const b = await res.json().catch(() => ({}));
      setFlagNote((b.message as string) || 'Nothing came back, so nothing was flagged.');
    } catch {
      setFlagNote('That did not reach the server, so nothing was flagged.');
    }
  }

  return (
    <div className="grid">
      {read.example ? (
        <div className="banner col-12">
          <Icon name="info" size={18} className="banner__icon" />
          <span>
            This is the worked example, not a read of one of your slips. Nothing here is yours and
            Confirm has nothing to write. <Link href="/app/import">Send a slip</Link> to see your own.
          </span>
        </div>
      ) : null}

      {/*  A EURO SLIP CANNOT BE CONFIRMED INTO A STERLING BALANCE. The
           balance decides what a stake is denominated in, so writing this one
           here would record the number off the slip as pounds and the person
           would have no way of seeing it. Held rather than converted: nothing
           in this product carries an exchange rate, and a rate would make the
           figure change overnight without a bet being placed. */}
      {wrongCurrency && balance && read.currency ? (
        <div className="banner banner--neg col-12">
          <Icon name="alert" size={18} className="banner__icon" />
          <span>
            This slip is in {CURRENCY_WORD[read.currency]} and <strong>{balance.name}</strong> is
            kept in {CURRENCY_WORD[balance.currency]}. Confirm is off, because writing it here would
            record the stake as {CURRENCY_WORD[balance.currency]} and nothing on any screen would
            say otherwise. Open a {CURRENCY_WORD[read.currency]} balance below and confirm it there.
          </span>
        </div>
      ) : null}

      {duplicate ? (
        <div className="banner banner--neg col-12">
          <Icon name="alert" size={18} className="banner__icon" />
          <span>
            This looks like a bet you already have, saved {dateTime(duplicate.when)}. It was matched
            on the bet itself, {duplicate.matchedOn === 'image' ? 'as well as on the image file' : 'not on the image'},
            so a second screenshot of one slip is caught even when the two files differ. Nothing has
            been written. {' '}
            <Link href={`/app/ledger?bet=${duplicate.id}`}>See the one you have</Link>, or say this is
            a different bet and Confirm turns back on.
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              style={{ marginTop: 'var(--s3)', display: duplicateOk ? 'none' : undefined }}
              onClick={() => setDuplicateOk(true)}
            >
              This is a different bet
            </button>
            {duplicateOk ? (
              <span className="small dim" style={{ display: 'block', marginTop: 'var(--s2)' }}>
                Taken as a different bet. It will be written as its own row.
              </span>
            ) : null}
          </span>
        </div>
      ) : null}

      <div className="col-8" style={{ display: 'grid', gap: 'var(--s4)', alignContent: 'start' }}>
        <section className="card">
          <div className="card__head">
            <div>
              <h2 className="card__title">{read.shape}{read.eachWay ? ', each way' : ''}</h2>
              <p className="small dim">
                {bookmakerLabel ? `${bookmakerLabel} slip` : 'Bookmaker not read'}
                {read.lines > 1 ? `, ${read.lines} lines` : ''}
              </p>
            </div>
            <span className="pill pill--accent">{legs.length} selections</span>
          </div>

          <ul>
            {read.fields.map((f) => {
              const t = TONE[f.confidence];
              return (
                <li key={f.key} className="brow brow--field">
                  <Icon name={t.icon} size={16} className={`readmark readmark--${t.cls}`} />
                  <span style={{ minWidth: 0 }}>
                    <span className="brow__title">{f.label}</span>
                    {f.saw ? <span className="brow__sub">Saw: <span className="mono">{f.saw}</span></span> : null}
                    {/*  Only where it says something. "Saved without asking.
                         Nothing here was in doubt." under every clean field is
                         one sentence repeated fifteen times, and the tick beside
                         it already said it. The ones that need an explanation
                         still get one. */}
                    {f.confidence === 'high' ? null : (
                      <span className="brow__sub">{CONFIDENCE_COPY[f.confidence].note}</span>
                    )}
                  </span>
                  <span className="fig fig--s tnum">
                    {f.confidence === 'high'
                      ? f.value
                      : (answers[f.key] ?? '').trim() || <span className="pending">Asked below</span>}
                  </span>
                </li>
              );
            })}
          </ul>
          {totalMinor !== null ? (
            <p className="small muted card__foot">
              {read.lines > 1
                ? `${money(stakeMinor as number, currency)} a line across ${read.lines} lines is ${money(totalMinor, currency)} of stake.`
                : `${money(totalMinor, currency)} of stake, in ${currency}.`}
            </p>
          ) : null}
        </section>

        <section className="card">
          <h2 className="card__title">Selections</h2>
          <p className="small muted" style={{ marginTop: 'var(--s2)' }}>
            A price that was not legible is empty, never a plausible number. A missing price is
            visible; a wrong one is not.
          </p>
          <ul style={{ marginTop: 'var(--s3)' }}>
            {legs.map((l, i) => (
              <li key={`${l.selection}-${i}`} className="brow" style={{ gridTemplateColumns: 'minmax(0,1fr) 110px', gap: 'var(--s3)' }}>
                <span style={{ minWidth: 0 }}>
                  {l.selection ? (
                    <span className="brow__title">{l.selection}</span>
                  ) : (
                    <>
                      <label className="sr-only" htmlFor={`sel-${i}`}>Selection {i + 1}</label>
                      <input
                        id={`sel-${i}`}
                        className="input"
                        autoComplete="off"
                        placeholder="Selection not read"
                        value={l.selection}
                        aria-invalid={!l.selection.trim() ? true : undefined}
                        onChange={(e) => setLegs(legs.map((x, k) => (k === i ? { ...x, selection: e.target.value } : x)))}
                      />
                    </>
                  )}
                  <span className="brow__sub">
                    {l.fixture || 'Fixture not read'}{l.saw ? ` · saw ${l.saw}` : ''}
                  </span>
                </span>
                <span>
                  <label className="sr-only" htmlFor={`odds-${i}`}>Price for {l.selection || `selection ${i + 1}`}</label>
                  <input
                    id={`odds-${i}`}
                    className="input mono"
                    inputMode="decimal"
                    autoComplete="off"
                    value={l.odds}
                    placeholder="Not read"
                    aria-invalid={!(Number(l.odds) > 1) ? true : undefined}
                    onChange={(e) => setLegs(legs.map((x, k) => (k === i ? { ...x, odds: e.target.value } : x)))}
                    style={!(Number(l.odds) > 1) ? { borderColor: 'var(--neg-line)' } : undefined}
                  />
                </span>
              </li>
            ))}
          </ul>
        </section>

        {questions.length ? (
          <section className="card">
            <h2 className="card__title">{questions.length === 1 ? 'One question' : `${questions.length} questions`}</h2>
            <p className="small muted" style={{ marginTop: 'var(--s2)' }}>
              Targeted, not a whole form to fill in again. Nothing here arrived with an answer
              already in the box.
            </p>
            <ul style={{ marginTop: 'var(--s3)' }}>
              {questions.map((f) => (
                <li key={f.key} className="askrow">
                  <p className="small">
                    {f.question ?? `What is the ${f.label.toLowerCase()} on this slip?`}
                    {f.required ? null : <span className="dim"> Optional.</span>}
                  </p>
                  {f.options ? (
                    <div className="row row--wrap" style={{ gap: 'var(--s2)', marginTop: 'var(--s3)' }}>
                      {f.options.map((a) => (
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
                  ) : (
                    <div style={{ marginTop: 'var(--s3)' }}>
                      <label className="sr-only" htmlFor={`ask-${f.key}`}>{f.label}</label>
                      <input
                        id={`ask-${f.key}`}
                        className="input"
                        autoComplete="off"
                        inputMode={f.key === 'stake' ? 'decimal' : undefined}
                        placeholder={f.key === 'stake' ? `Stake per line in ${currency}` : f.label}
                        value={answers[f.key] ?? ''}
                        aria-invalid={f.required && !(answers[f.key] ?? '').trim() ? true : undefined}
                        onChange={(e) => setAnswers({ ...answers, [f.key]: e.target.value })}
                      />
                    </div>
                  )}
                  {f.key === 'stake' && (answers.stake ?? '').trim() && stakeMinor === null ? (
                    <p className="small" role="alert" style={{ marginTop: 'var(--s2)' }}>
                      That is not an amount this can read. Two decimal places at most, and no range.
                    </p>
                  ) : null}
                  {answers[f.key] === 'Not sure' ? (
                    <p className="small dim" style={{ marginTop: 'var(--s2)' }}>
                      It stays unanswered, and this bet is held out of your aggregates until it settles.
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>

      <div className="col-4" style={{ display: 'grid', gap: 'var(--s4)', alignContent: 'start' }}>
        {/*  WHICH BOOKS THIS SLIP LANDS IN, above the button that writes it.
             A slip is filed against the balance that is open, and this screen
             said nothing about which one that was: somebody keeping a matched
             betting float apart from a football bank confirmed into whichever
             one they last looked at. */}
        <section className="card">
          <h2 className="card__title">Where it lands</h2>
          <BalanceChoice
            balances={balances}
            current={balanceId}
            unitMinor={unitMinor}
            /*  "Lands" is only true if it can be confirmed. With the banner
                above saying Confirm is off, a line underneath saying the slip
                lands here would be the screen contradicting itself. */
            what={wrongCurrency ? 'A slip confirmed here' : 'This slip'}
          />
        </section>

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
                  <span className="brow__title">{r.t}</span>
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
            disabled={saving || open > 0 || heldOnDuplicate || wrongCurrency}
            aria-describedby="confirm-note"
          >
            {saving ? 'Writing'
              : wrongCurrency ? 'The balance is in the wrong currency'
                : heldOnDuplicate ? 'One question about a duplicate'
                  : open > 0 ? `${open} field${open === 1 ? '' : 's'} still open`
                    : balance ? `Confirm and add to ${balance.name}` : 'Confirm and add to my ledger'}
          </button>
          <p className="small dim" id="confirm-note" style={{ marginTop: 'var(--s3)' }}>
            {wrongCurrency
              ? 'A stake is denominated by the balance it lands in, so this one is held until a balance in the slip’s own currency is open.'
              : heldOnDuplicate
                ? 'A bet like this one is already in your ledger. Saving it again would count it twice in every figure, so this asks first.'
                : open > 0
                  ? 'Confirm stays off until the gaps are filled. Nothing is written half read.'
                  : 'Writes the bet and its first settlement event in one transaction.'}
          </p>
          {note ? <p className="small muted" role="status" style={{ marginTop: 'var(--s3)' }}>{note}</p> : null}
        </section>

        <section className="card">
          <h2 className="card__title">Read it wrong?</h2>
          <p className="small muted" style={{ marginTop: 'var(--s2)' }}>
            {/*  It said the slip "goes back for a human look". There is no
                 queue, no notification and no admin screen, so what it now
                 promises is what the code keeps: the read is kept, marked as
                 misread, and the slip goes back to your allowance once. */}
            Flag it and the read is kept and marked as misread. The slip goes back to your
            allowance, once per read rather than once per press.
          </p>
          <button
            type="button"
            className={`btn btn--wide ${flagged ? 'btn--ghost' : 'btn--danger'}`}
            style={{ marginTop: 'var(--s4)' }}
            onClick={flag}
            disabled={flagged}
          >
            <Icon name="flag" size={16} />
            {flagged ? 'Flagged' : 'Flag this read'}
          </button>
          {flagNote ? (
            <p className="small muted" role="status" style={{ marginTop: 'var(--s3)' }}>{flagNote}</p>
          ) : null}
          <p className="small dim card__foot">
            Or <Link href="/app/import/manual">type it in yourself</Link> instead.
          </p>
        </section>
      </div>
    </div>
  );
}
