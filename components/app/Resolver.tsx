'use client';

import { useState } from 'react';
import { plural } from '@/lib/format';
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

              {/*  ONE LIST, NOT THREE BORDERED BOXES INSIDE A CARD. These
                   are three answers to one question, and drawn as three
                   separately outlined cards inside the card that asks it
                   they read as three unrelated things. The settings list
                   found this first, and .navlist is the treatment: one
                   frame, a rule between the rows, and the chosen row filled
                   with a bar on its leading edge. The pressed state comes
                   from aria-pressed, which these buttons already carry. */}
              <div className="navlist" style={{ marginTop: 'var(--s4)' }}>
                <button
                  type="button"
                  className="rowcard"
                  aria-pressed={c === 'split'}
                  onClick={() => setChoices({ ...choices, [it.id]: 'split' })}
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
                  className="rowcard"
                  aria-pressed={c === 'one'}
                  onClick={() => setChoices({ ...choices, [it.id]: 'one' })}
                >
                  <Icon name="slip" size={20} className="rowcard__i" />
                  <span className="grow">
                    <span className="rowcard__t">One selection</span>
                    <span className="rowcard__s">The ampersand is part of the name.</span>
                  </span>
                </button>

                <button
                  type="button"
                  className="rowcard"
                  aria-pressed={c === 'skip'}
                  onClick={() => setChoices({ ...choices, [it.id]: 'skip' })}
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

      {/*  A GATE, NOT A COSTUME.
           This was a <Link> with aria-disabled on it, and aria-disabled is a
           promise to a screen reader, not a lock: an anchor with an href
           still navigates on click no matter what it announces. The
           stylesheet dimmed it and set cursor:not-allowed, which made it
           LOOK locked, and a real click at its box walked past five
           undecided rows into the one screen that writes the import. The
           only page in the product whose entire job is to force a decision
           did not force it.

           So while there is a decision outstanding this is a <button
           disabled>, which cannot be clicked, cannot be focused and cannot
           be activated by keyboard. It becomes a link only when there is
           somewhere legitimate for it to go. */}
      <div className="row" style={{ marginTop: 'var(--s5)', gap: 'var(--s3)' }}>
        {done === items.length ? (
          <Link href="/app/import/history/done" className="btn btn--primary grow">
            Write the import
            <Icon name="arrowRight" size={16} />
          </Link>
        ) : (
          <button type="button" className="btn btn--ghost grow" disabled aria-describedby="resolve-gate">
            {plural(items.length - done, 'row')} still to decide
          </button>
        )}
      </div>
      {done < items.length ? (
        <p className="small dim" id="resolve-gate" style={{ marginTop: 'var(--s2)' }}>
          Answer every row and this becomes the write step. Nothing is written until it does.
        </p>
      ) : null}
      <p className="small dim" style={{ marginTop: 'var(--s3)' }}>
        Every row is written in one transaction. If any part fails, none of it lands.
      </p>
    </>
  );
}
