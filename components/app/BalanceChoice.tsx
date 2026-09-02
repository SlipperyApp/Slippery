'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CURRENCY_SYMBOL, CURRENCY_WORD, money, type Currency } from '@/lib/format';

/** WHICH BOOKS THIS BET LANDS IN, said before it is written.
 *
 *  Multiple balances are done well everywhere except the entry side. A bet is
 *  filed against the balance the person has open, resolved server side from
 *  the cookie rather than taken from the request, which is the right security
 *  decision: a client that could name a balance could name somebody else's,
 *  and a stake typed into the euro account and filed against the sterling one
 *  is a wrong figure on two screens at once. What was missing is that no
 *  entry path said which one was open. Somebody running a horses bank and a
 *  football bank puts bets in the wrong one and does not find out until the
 *  balance sheet disagrees with their memory.
 *
 *  So this names it, and changing it here changes the same cookie the top bar
 *  switcher sets. The request still names no balance; the server still
 *  resolves one against the account's own. Nothing about the security
 *  decision moves, and the person can see the answer before they press.
 *
 *  THE CURRENCY AND THE UNIT COME WITH THE BALANCE, so choosing one
 *  re-denominates the form behind it. The refresh is what does that: the page
 *  is a server component, it reads the same cookie, and every figure it hands
 *  down comes back in the new balance's money. A stake box that still said
 *  pounds after somebody chose the euro account would be the same defect one
 *  layer down. */
export function BalanceChoice({
  balances, current, unitMinor, what = 'This bet',
}: {
  balances: { id: string; name: string; currency: Currency }[];
  current: string;
  /** The chosen balance's unit, already resolved by the page. Printed here
   *  because it changes with the balance and a form that quotes a stale unit
   *  is quoting the wrong money. */
  unitMinor?: number;
  /** What is about to be written. "This bet" on the manual form, "This slip"
   *  on the review screen. */
  what?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const here = balances.find((b) => b.id === current) ?? balances[0];

  if (!here) return null;

  const unit = unitMinor && unitMinor > 0
    ? <> Your unit here is {money(unitMinor, here.currency)}.</>
    : null;

  const choose = (id: string) => {
    if (id === current) return;
    setBusy(true);
    /*  A year, and path=/ so the marketing side and the app agree. The server
        reads it in lib/data/session.ts and in lib/server/balances.ts, so the
        refresh is what redraws the name and what the write will resolve. */
    document.cookie = `slip_balance=${encodeURIComponent(id)}; path=/; max-age=31536000; samesite=lax`;
    router.refresh();
    setBusy(false);
  };

  if (balances.length < 2) {
    return (
      <p className="small muted">
        {what} lands in <strong>{here.name}</strong>, in {CURRENCY_WORD[here.currency]}.{unit}
      </p>
    );
  }

  return (
    <div className="field">
      <label className="field__label" htmlFor="bal-choice">Which balance this lands in</label>
      <select
        id="bal-choice"
        className="select"
        value={current}
        disabled={busy}
        onChange={(e) => choose(e.target.value)}
        aria-describedby="bal-choice-hint"
      >
        {balances.map((b) => (
          <option key={b.id} value={b.id}>{b.name} ({CURRENCY_SYMBOL[b.currency]})</option>
        ))}
      </select>
      <span className="field__hint" id="bal-choice-hint">
        {what} lands in <strong>{here.name}</strong>, and the stake is in{' '}
        {CURRENCY_WORD[here.currency]}.{unit} Changing it here changes which books are open
        everywhere, the same as the switcher in the top bar.
      </span>
    </div>
  );
}
