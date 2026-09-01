'use client';

import { useEffect, useRef, useState } from 'react';
import { Icon } from '@/components/Icon';

/** The landing sequence. Scroll jacking, kept, with the five properties that
 *  are the entire difference between this and the version that was rejected:
 *
 *    1. a REAL tall track, so the scrollbar tells the truth about how far
 *       there is to go
 *    2. a position: sticky stage, not fixed, so it releases at the end
 *    3. proximity snap, not mandatory, so nobody is trapped
 *    4. NO intercepted wheel or touch events: scrolling is the browser's
 *    5. a full collapse under prefers-reduced-motion, where the track goes to
 *       auto height and the three steps simply stack
 *
 *  What was rejected was mandatory snap, which traps people. */

const STEPS = [
  {
    k: 'place',
    badge: 'The moment',
    title: 'You place the bet.',
    body: 'Wherever you already bet. Slippery is never between you and the bookmaker, and it never takes a stake.',
    icon: 'slip' as const,
  },
  {
    k: 'send',
    badge: 'Four seconds',
    title: 'You forward the slip.',
    body: 'Before the first whistle, while you still do not know. That is the part that makes the record true.',
    icon: 'telegram' as const,
  },
  {
    k: 'settle',
    badge: 'Later, on its own',
    title: 'It settles itself.',
    body: 'Ninety minute scores only. Anything uncertain asks you rather than grading it wrong.',
    icon: 'check' as const,
  },
];

export function Sequence() {
  const track = useRef<HTMLDivElement | null>(null);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setStep(2); return; }

    // A passive scroll listener that reads position and sets an index. It
    // never calls preventDefault, so the wheel and the touch belong to the
    // browser and the page can always be scrolled past.
    let frame = 0;
    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        const el = track.current;
        if (!el) return;
        const r = el.getBoundingClientRect();
        const total = r.height - window.innerHeight;
        if (total <= 0) return;
        const progress = Math.min(1, Math.max(0, -r.top / total));
        setStep(Math.min(STEPS.length - 1, Math.floor(progress * STEPS.length)));
      });
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div className="jack" ref={track}>
      <div className="jack__stage">
        <div className="wrap">
          <div className="jack__inner">
            <ol className="jack__steps">
              {STEPS.map((s, i) => (
                <li
                  key={s.k}
                  className={`jack__step${i === step ? ' jack__step--on' : ''}`}
                  aria-current={i === step ? 'step' : undefined}
                >
                  {/*  The badge used to be a pill above the title. A pill above
                       every heading is the most recognisable shape a generated
                       page has, so the words moved onto the number line: same
                       fact, no badge. */}
                  <span className="jack__num mono">
                    {String(i + 1).padStart(2, '0')}
                    <span className="jack__when">{s.badge}</span>
                  </span>
                  <span className="jack__body">
                    <span className="jack__title">{s.title}</span>
                    <span className="jack__text">{s.body}</span>
                  </span>
                  <Icon name={s.icon} size={22} className="jack__icon" />
                </li>
              ))}
            </ol>
            <div className="jack__rail" aria-hidden="true">
              {STEPS.map((s, i) => (
                <span key={s.k} className={`jack__pip${i <= step ? ' jack__pip--on' : ''}`} />
              ))}
            </div>
          </div>
        </div>
      </div>
      {/* Real snap points on a real track. Proximity, so scrolling past is
          never fought. */}
      {STEPS.map((s) => <div key={s.k} className="jack__snap" aria-hidden="true" />)}
    </div>
  );
}
