'use client';

import { useState } from 'react';
import { Icon } from '@/components/Icon';

export function Faq({ items }: { items: { q: string; a: string }[] }) {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <ul>
      {items.map((it, i) => (
        <li key={it.q} style={{ borderTop: '1px solid var(--line)' }}>
          <button
            type="button"
            className="faq__q"
            aria-expanded={open === i}
            aria-controls={`faq-a-${i}`}
            id={`faq-q-${i}`}
            onClick={() => setOpen(open === i ? null : i)}
          >
            <span>{it.q}</span>
            <Icon name="plus" size={18} className="faq__i" />
          </button>
          <div id={`faq-a-${i}`} role="region" aria-labelledby={`faq-q-${i}`} hidden={open !== i}>
            <p className="faq__a">{it.a}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}
