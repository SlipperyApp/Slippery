'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Icon } from '@/components/Icon';
import type { Unresolved } from '@/lib/data/importing';

type Choice = 'split' | 'one' | 'skip';

export function Resolver({ items }: { items: Unresolved[] }) {
  const [choices, setChoices] = useState<Record<string, Choice>>({});
  const done = items.filter((i) => choices[i.id]).length;

  return (
    <>
      <div className="card" style={{ marginBottom: 'var(--gap-block)' }}>
        <div className="spread">
          <span className="card__title">{done} of {items.length} decided</span>
          <span className="small dim">{items.length - done} left</span>
        </div>
        <div className="meter" style={{ marginTop: 'var(--s3)' }}>
          <span className="meter__fill" style={{ width: `${(done / items.length) * 100}%` }} />
        </div>
      </div>

      <ul style={{ display: 'grid', gap: 'var(--s4)' }}>
        {items.map((it) => {
          const c = choices[it.id];
          return (
            <li key={it.id} className="card">
              <p className="label">In your file</p>
              <p className="mono" style={{ marginTop: 'var(--s2)', wordBreak: 'break-word' }}>{it.raw}</p>
              <p className="small muted" style={{ marginTop: 'var(--s3)' }}>{it.why}</p>

              <div className="rows" style={{ marginTop: 'var(--s4)' }}>
                <button
                  type="button"
                  className={`rowcard${c === 'split' ? ' rowcard--on' : ''}`}
                  aria-pressed={c === 'split'}
                  onClick={() => setChoices({ ...choices, [it.id]: 'split' })}
                  style={{ cursor: 'pointer', textAlign: 'left' }}
                >
                  <Icon name="split" size={20} className="rowcard__i" />
                  <span className="grow">
                    <span className="rowcard__t">
                      {it.suggestion.length > 1 ? `${it.suggestion.length} selections` : 'Split it'}
                    </span>
                    <span className="rowcard__s">{it.suggestion.join('  ·  ')}</span>
                  </span>
                </button>

                <button
                  type="button"
                  className={`rowcard${c === 'one' ? ' rowcard--on' : ''}`}
                  aria-pressed={c === 'one'}
                  onClick={() => setChoices({ ...choices, [it.id]: 'one' })}
                  style={{ cursor: 'pointer', textAlign: 'left' }}
                >
                  <Icon name="slip" size={20} className="rowcard__i" />
                  <span className="grow">
                    <span className="rowcard__t">One selection</span>
                    <span className="rowcard__s">The ampersand is part of the name.</span>
                  </span>
                </button>

                <button
                  type="button"
                  className={`rowcard${c === 'skip' ? ' rowcard--on' : ''}`}
                  aria-pressed={c === 'skip'}
                  onClick={() => setChoices({ ...choices, [it.id]: 'skip' })}
                  style={{ cursor: 'pointer', textAlign: 'left' }}
                >
                  <Icon name="minus" size={20} className="rowcard__i" />
                  <span className="grow">
                    <span className="rowcard__t">Leave it out</span>
                    <span className="rowcard__s">Not imported. You can add it by hand later.</span>
                  </span>
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      <div className="row" style={{ marginTop: 'var(--s5)', gap: 'var(--s3)' }}>
        <Link
          href="/app/import/history/done"
          className={`btn grow ${done === items.length ? 'btn--primary' : 'btn--ghost'}`}
          aria-disabled={done < items.length ? true : undefined}
        >
          {done === items.length ? 'Write the import' : `${items.length - done} still to decide`}
          <Icon name="arrowRight" size={16} />
        </Link>
      </div>
      <p className="small dim" style={{ marginTop: 'var(--s3)' }}>
        Every row is written in one transaction. If any part fails, none of it lands.
      </p>
    </>
  );
}
