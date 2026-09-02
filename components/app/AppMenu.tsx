'use client';

import Link from 'next/link';
import { useEffect, useRef } from 'react';
import { Icon, type IconName } from '@/components/Icon';

export type MenuJob = { key: string; href: string; icon: IconName; label: string; n: number; warn?: boolean };

/** The phone's menu, and the only glass surface in the product.
 *
 *  WHAT IS IN IT IS WHAT A PHONE COULD NOT REACH. The rail carries eleven
 *  things and is display:none under 1000, and the tab bar carries four of
 *  them, so on a phone the job filters, Settings and the sentence about what
 *  is at risk had nowhere to be and SIGNING OUT WAS NOT POSSIBLE AT ALL:
 *  /api/auth/logout existed and the only control that posted to it was in the
 *  rail. Nothing here repeats a tab. Two links a centimetre apart going to the
 *  same screen is the defect lib/nav.ts already records once.
 *
 *  THE GLASS IS ONE ELEMENT AND THE BUDGET IS THREE.
 *
 *  A previous build shipped 79 backdrop-filter elements and stuttered on a
 *  phone, so the product allows about three per page. On an app route at 390
 *  they are the top bar, the bottom bar and, while this is open, the panel
 *  itself: three, and only while it is open. The scrim is a flat colour, the
 *  rim highlight is a masked gradient, and not one row inside the panel has a
 *  filter of its own. That is the whole reason the rows are drawn on the
 *  panel rather than as their own little glass cards, which is what the
 *  reference shots look like and what costs seventy nine of them.
 *
 *  NOTHING ANIMATES A BLUR. The panel scales and fades, which is transform
 *  and opacity; the blur is present from the first frame and what reads as
 *  the page blurring is the scrim's own opacity coming up underneath it. A
 *  live filter: blur() is banned in this codebase because it is re-evaluated
 *  every scroll frame: 49.9ms p95 with it against 16.8ms without.
 *
 *  Under prefers-reduced-motion every animation here is absent rather than
 *  shortened, which is why the rules live inside a no-preference query. */
export function AppMenu({
  open, onClose, name, handle, sub, jobs, signedIn, returnFocusTo,
}: {
  open: boolean;
  onClose: () => void;
  name: string;
  handle: string;
  /** The line the top bar hides under 700: what is at risk, and the zone every
   *  day boundary is computed in. It is a fact, not a link. */
  sub: string;
  jobs: MenuJob[];
  signedIn: boolean;
  returnFocusTo: React.RefObject<HTMLButtonElement | null>;
}) {
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return undefined;
    const el = panel.current;
    el?.focus();

    /*  Escape closes and the focus goes back to the button that opened it,
        or the next tab lands at the top of the document behind an open
        dialog. */
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); returnFocusTo.current?.focus(); return; }
      if (e.key !== 'Tab' || !el) return;
      const stops = el.querySelectorAll<HTMLElement>('a[href], button:not([disabled])');
      if (!stops.length) return;
      const first = stops[0];
      const last = stops[stops.length - 1];
      if (e.shiftKey && (document.activeElement === first || document.activeElement === el)) {
        e.preventDefault(); last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault(); first.focus();
      }
    };
    document.addEventListener('keydown', key);

    /*  The page behind a sheet does not scroll. Restored on the way out and
        on unmount, never assumed: a value left on the documentElement by a
        component that has gone is a page that can never scroll again. */
    const had = document.documentElement.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', key);
      document.documentElement.style.overflow = had;
    };
  }, [open, onClose, returnFocusTo]);

  if (!open) return null;

  /*  Every row is numbered so the stagger is a delay per row rather than a
      selector per row. transform and opacity only. */
  let i = 0;
  const row = () => ({ '--row': String(i++) } as React.CSSProperties);

  return (
    <>
      <button
        type="button"
        className="navsheet__scrim"
        aria-label="Close the menu"
        onClick={() => { onClose(); returnFocusTo.current?.focus(); }}
      />

      <div
        className="navsheet"
        role="dialog"
        aria-modal="true"
        aria-label="Menu"
        tabIndex={-1}
        ref={panel}
      >
        <div className="navsheet__head" style={row()}>
          <span className="avatar" aria-hidden="true">{(name || handle || '?').slice(0, 1)}</span>
          <span className="navsheet__who">
            <span className="navsheet__name">{name || 'Your account'}</span>
            {handle ? <span className="small dim mono">@{handle}</span> : null}
          </span>
          <button
            type="button"
            className="iconbtn"
            aria-label="Close the menu"
            onClick={() => { onClose(); returnFocusTo.current?.focus(); }}
          >
            <Icon name="close" size={18} />
          </button>
        </div>

        <p className="small dim navsheet__sub" style={row()}>{sub}</p>

        {jobs.length ? (
          <div className="navsheet__group" style={row()}>
            <p className="label">Needs you</p>
            {jobs.map((j) => (
              <Link key={j.key} href={j.href} className="navsheet__row" onClick={onClose} style={row()}>
                <Icon name={j.icon} size={18} className="navsheet__i" />
                <span className="grow">{j.label}</span>
                <span className={`pill${j.warn ? ' pill--warn' : ''} tnum`}>{j.n}</span>
              </Link>
            ))}
          </div>
        ) : null}

        <div className="navsheet__group" style={row()}>
          <Link href="/app/settings" className="navsheet__row" onClick={onClose} style={row()}>
            <Icon name="settings" size={18} className="navsheet__i" />
            <span className="grow">Settings</span>
            <Icon name="chevronRight" size={16} className="navsheet__i" />
          </Link>

          {/*  A form and not a link, because it changes server state and a GET
               that ends a session is one a browser is free to prefetch. On a
               phone this was not reachable at all. */}
          {signedIn ? (
            <form action="/api/auth/logout" method="post" style={row()}>
              <button type="submit" className="navsheet__row">
                <Icon name="signout" size={18} className="navsheet__i" />
                <span className="grow">Sign out</span>
              </button>
            </form>
          ) : null}
        </div>
      </div>
    </>
  );
}
