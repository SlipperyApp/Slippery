'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

/** The one thing to do, kept within thumb reach on a phone.
 *
 *  It appears only after the hero's own call to action has scrolled away, so
 *  it is never a second copy of a button already on screen: two of the same
 *  control at once is what makes a sticky bar feel like an advert instead of
 *  a convenience.
 *
 *  Phones only. On a desktop the header is always visible and already carries
 *  it. It sits above the safe area, and it adds bottom padding to the page so
 *  it can never cover the last line of the footer. */
export function StickyCta({ href = '/signup', label = 'Start free for 14 days' }: { href?: string; label?: string }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const hero = document.querySelector('.hero__cta');
    if (!hero) return;
    const io = new IntersectionObserver(
      ([e]) => setShow(!e.isIntersecting && e.boundingClientRect.top < 0),
      { threshold: 0 },
    );
    io.observe(hero);
    return () => io.disconnect();
  }, []);

  return (
    <div className={`stickycta${show ? ' stickycta--on' : ''}`} aria-hidden={!show}>
      <Link href={href} className="btn btn--primary btn--wide" tabIndex={show ? undefined : -1}>
        {label}
      </Link>
    </div>
  );
}
