'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Icon } from '@/components/Icon';
import { money, CURRENCY_SYMBOL, type Currency } from '@/lib/format';

/** Which set of books is open, in the top bar.
 *
 *  THE BOX IS THE SAME SIZE IT WAS. The top bar already carried a balance
 *  figure with the word "Balance" over it, and the word was the only thing
 *  on the whole screen that could not change: an account with a football
 *  bank, a horses bank and a euro account had one figure labelled with a
 *  category. So the label became the NAME, and the box became the control
 *  that switches it. Nothing was added to a bar that is 60px tall and has
 *  three other things in it at 390.
 *
 *  IT IS A COOKIE, NOT A QUERY PARAMETER. Which balance is open is not a
 *  filter on a page, it is which books you have in front of you, so it has
 *  to survive every link in the product the way the theme does. Never
 *  localStorage: iOS Safari is the primary target.
 *
 *  The currency is printed beside every name, because the whole reason two
 *  balances exist is that their figures are not comparable, and a list of
 *  three names with no symbols invites exactly the addition this product
 *  refuses to do. */
export function BalanceSwitch({
  balances, current, balanceMinor, currency,
}: {
  balances: { id: string; name: string; currency: Currency }[];
  current: string;
  balanceMinor: number;
  currency: Currency;
}) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const here = balances.find((b) => b.id === current);

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        wrap.current?.querySelector<HTMLButtonElement>('.balance')?.focus();
      }
    };
    document.addEventListener('mousedown', away);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', away);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);

  const choose = (id: string) => {
    /*  A year, and path=/ so the marketing side and the app agree. The
        server reads it in lib/data/session.ts and scopes the whole viewer
        to it, so the refresh is what redraws every figure on the page. */
    document.cookie = `slip_balance=${encodeURIComponent(id)}; path=/; max-age=31536000; samesite=lax`;
    setOpen(false);
    router.refresh();
  };

  return (
    <div className="balsw" ref={wrap}>
      <button
        type="button"
        className="balance"
        aria-expanded={open}
        aria-controls="balsw-pop"
        aria-label={`Balance: ${here?.name ?? 'none'}. Switch balance.`}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="balance__k">
          {here?.name ?? 'Balance'}
          <Icon name="chevronDown" size={11} className="balsw__chev" />
        </span>
        <span className="balance__v tnum">{money(balanceMinor, currency)}</span>
      </button>

      <div id="balsw-pop" className="balsw__pop" role="group" aria-label="Balances" hidden={!open}>
        <p className="label">Balances</p>
        {balances.map((b) => (
          <button
            key={b.id}
            type="button"
            className="balsw__item"
            aria-pressed={b.id === current}
            onClick={() => choose(b.id)}
          >
            <span className="balsw__name">{b.name}</span>
            <span className="balsw__cur mono">{CURRENCY_SYMBOL[b.currency]}</span>
            {b.id === current ? <Icon name="check" size={14} /> : null}
          </button>
        ))}
        {/*  The way out of the one-at-a-time view, and the only screen that
             reads more than one balance. It is a link rather than a fourth
             item in the list because it is not a balance. */}
        <Link href="/app/balances" className="balsw__all" onClick={() => setOpen(false)}>
          <Icon name="bank" size={14} /> All balances, side by side
        </Link>
      </div>
    </div>
  );
}
