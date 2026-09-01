'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Icon } from '@/components/Icon';

const STAGES = [
  { t: 'Checking it is a slip', s: 'A photograph that is not a slip is refused rather than guessed at.' },
  { t: 'Detecting the bookmaker', s: 'The template decides how everything after this is parsed.' },
  { t: 'Reading the fields', s: 'Stake, price, selection, kick-off, and each leg on a permed bet.' },
  { t: 'Scoring each field', s: 'Per field, never per slip: one bad field must not poison nineteen good ones.' },
  { t: 'Checking for a duplicate', s: 'Selection, stake, bookmaker and kick-off. An image hash only catches identical files.' },
];

export function Analysing() {
  const router = useRouter();
  const [stage, setStage] = useState(0);

  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) { setStage(STAGES.length); return; }
    const timers = STAGES.map((_, i) => setTimeout(() => setStage(i + 1), 620 * (i + 1)));
    const done = setTimeout(() => router.push('/app/import/review'), 620 * STAGES.length + 900);
    return () => { timers.forEach(clearTimeout); clearTimeout(done); };
  }, [router]);

  return (
    <>
      <div className="card">
        <ul>
          {STAGES.map((s, i) => {
            const done = i < stage;
            const active = i === stage;
            return (
              <li key={s.t} className={`brow${done || active ? '' : ' brow--faded'}`} style={{ gridTemplateColumns: '22px minmax(0,1fr)', gap: 'var(--s3)' }}>
                <span style={{ display: 'grid', placeItems: 'center' }}>
                  {done ? <Icon name="check" size={16} className="pos" strokeWidth={2.2} />
                    : active ? <Icon name="refresh" size={16} className="spin" />
                      : <Icon name="minus" size={16} className="dim" />}
                </span>
                <span>
                  <span className="brow__title" style={{ display: 'block' }}>{s.t}</span>
                  <span className="brow__sub">{s.s}</span>
                </span>
              </li>
            );
          })}
        </ul>
        <div className="meter card__foot" style={{ marginTop: 'var(--s4)' }}>
          <span className="meter__fill" style={{ width: `${(stage / STAGES.length) * 100}%`, transition: 'width 400ms var(--ease)' }} />
        </div>
      </div>

      <p className="small dim" style={{ marginTop: 'var(--s4)' }}>
        This does not need you. If you close the tab the read finishes anyway and the result is
        waiting in <Link href="/app/import/review">Add a bet</Link>.
      </p>
    </>
  );
}
